import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const MODE_PROMPTS: Record<string, string> = {
  refine: `You are a GRC instruction editor. The user has written instructions for an autonomous GRC agent. Your job is to REFINE these instructions:
- Make them clearer, more specific, and more actionable
- Structure them as numbered steps
- Do NOT change the scope or intent — only improve clarity and specificity
- Ensure each step produces a concrete action (create a risk, create a control, create a policy, etc.)
- Remove vague language and replace with specific GRC terminology
Return ONLY the improved instructions text, no commentary.`,

  augment: `You are a GRC subject matter expert. The user has written instructions for an autonomous GRC agent. Your job is to AUGMENT these instructions:
- Keep everything the user wrote
- Add additional GRC tasks the agent should perform that the user may not have thought of
- For every research/analysis step, add corresponding write actions (create risks, create controls, create policies, create evidence)
- Add at least 3-5 additional write-focused tasks
- Structure as numbered steps
Return ONLY the augmented instructions text, no commentary.`,

  expert: `You are a senior GRC consultant with 20+ years of experience. Generate comprehensive instructions for an autonomous GRC agent. The instructions should:
- Be structured as clear numbered steps
- Maximize write output: create risks, controls, policies, evidence items, and incidents
- Follow the pattern: Research → Identify gaps → Create risks → Create controls → Create policies → Create evidence
- Be specific about what to search for, what frameworks to reference, and what artifacts to create
- Include at least 5-7 write actions
- Reference specific frameworks (SOC 2, ISO 27001, NIST CSF) where applicable
Return ONLY the instructions text, no commentary.`,
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { instructions, mode, skills, agentDescription } = body as {
      instructions?: string;
      mode: string;
      skills?: string[];
      agentDescription?: string;
    };

    if (!mode || !MODE_PROMPTS[mode]) {
      return Response.json({ error: "Invalid mode. Use: refine, augment, or expert" }, { status: 400 });
    }

    if (mode !== "expert" && (!instructions || !instructions.trim())) {
      return Response.json({ error: "Instructions are required for refine and augment modes" }, { status: 400 });
    }

    const systemPrompt = MODE_PROMPTS[mode];

    let userMessage = "";
    if (mode === "expert") {
      userMessage = `Generate comprehensive GRC agent instructions.${
        agentDescription ? `\nAgent purpose: ${agentDescription}` : ""
      }${
        skills?.length ? `\nAvailable skills: ${skills.join(", ")}` : ""
      }${
        instructions?.trim() ? `\nUser's starting idea: ${instructions.trim()}` : ""
      }`;
    } else {
      userMessage = `${mode === "refine" ? "Refine" : "Augment"} these agent instructions:\n\n${instructions}${
        skills?.length ? `\n\nAvailable skills: ${skills.join(", ")}` : ""
      }`;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const enhanced = textBlock ? textBlock.text.trim() : "";

    return Response.json({ enhanced });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
