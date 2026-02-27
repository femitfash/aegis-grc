import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { logAudit } from "@/shared/lib/audit";
import { SKILL_MAP } from "./skills";

const WRITE_SKILLS = new Set(["create_risk", "create_incident", "create_policy", "update_requirement"]);

// ─── Schedule helpers ────────────────────────────────────────────────────────

function calculateNextRun(schedule: string): Date | null {
  if (schedule === "manual") return null;

  const now = new Date();

  if (schedule === "hourly") {
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next;
  }

  const targetHour = schedule === "daily_6am" ? 6 : 9;

  if (schedule === "daily_6am" || schedule === "daily_9am") {
    const next = new Date(now);
    next.setUTCHours(targetHour, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (schedule === "weekly_monday") {
    const next = new Date(now);
    next.setUTCHours(9, 0, 0, 0);
    const day = next.getUTCDay(); // 0=Sun, 1=Mon
    const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7;
    next.setUTCDate(next.getUTCDate() + daysUntilMonday);
    return next;
  }

  return null;
}

// ─── Claude tool definitions per skill ──────────────────────────────────────

function buildToolDefinitions(skillIds: string[]): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [];

  for (const skillId of skillIds) {
    switch (skillId) {
      case "web_search":
        tools.push({
          name: "web_search",
          description: "Search the internet for GRC-related information using Tavily",
          input_schema: {
            type: "object",
            properties: {
              query: { type: "string", description: "The search query" },
            },
            required: ["query"],
          },
        });
        break;

      case "risk_analysis":
        tools.push({
          name: "risk_analysis",
          description: "Analyze the organization's current risk register and surface key insights",
          input_schema: {
            type: "object",
            properties: {
              focus: { type: "string", description: "Optional focus area (e.g., 'high severity open risks')" },
            },
          },
        });
        break;

      case "compliance_check":
        tools.push({
          name: "compliance_check",
          description: "Check compliance status across active frameworks and surface gaps",
          input_schema: {
            type: "object",
            properties: {
              framework_code: { type: "string", description: "Optional: specific framework to check (e.g., SOC2, ISO27001)" },
            },
          },
        });
        break;

      case "send_report":
        tools.push({
          name: "send_report",
          description: "Generate and save a GRC summary report",
          input_schema: {
            type: "object",
            properties: {
              report_type: { type: "string", enum: ["risk", "compliance", "incident"], description: "Type of report to generate" },
              summary: { type: "string", description: "The report content/summary" },
            },
            required: ["report_type", "summary"],
          },
        });
        break;

      case "create_risk":
        tools.push({
          name: "create_risk",
          description: "Propose creating a new risk in the risk register (requires user approval)",
          input_schema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short risk title" },
              description: { type: "string", description: "Detailed risk description" },
              likelihood: { type: "number", description: "Likelihood score 1-5" },
              impact: { type: "number", description: "Impact score 1-5" },
            },
            required: ["title", "description", "likelihood", "impact"],
          },
        });
        break;

      case "create_incident":
        tools.push({
          name: "create_incident",
          description: "Propose logging a new security incident (requires user approval)",
          input_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
            },
            required: ["title", "description", "severity"],
          },
        });
        break;

      case "create_policy":
        tools.push({
          name: "create_policy",
          description: "Propose creating a new policy (requires user approval)",
          input_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              category: { type: "string" },
            },
            required: ["title", "description"],
          },
        });
        break;

      case "update_requirement":
        tools.push({
          name: "update_requirement",
          description: "Propose updating a compliance requirement status (requires user approval)",
          input_schema: {
            type: "object",
            properties: {
              framework_code: { type: "string" },
              requirement_id: { type: "string" },
              new_status: { type: "string", enum: ["implemented", "in_progress", "not_started", "not_applicable"] },
              notes: { type: "string" },
            },
            required: ["framework_code", "requirement_id", "new_status"],
          },
        });
        break;
    }
  }

  return tools;
}

// ─── Read skill executors ────────────────────────────────────────────────────

async function executeWebSearch(input: Record<string, unknown>): Promise<object> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return { error: "TAVILY_API_KEY not configured", results: [] };
  }
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: input.query as string,
        search_depth: "advanced",
        max_results: 5,
        include_answer: true,
      }),
    });
    if (!res.ok) {
      return { error: `Tavily returned ${res.status}`, results: [] };
    }
    const data = await res.json() as { answer?: string; results?: unknown[] };
    return { answer: data.answer, results: data.results ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), results: [] };
  }
}

async function executeRiskAnalysis(
  organizationId: string,
  input: Record<string, unknown>
): Promise<object> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: risks } = await admin
    .from("risks")
    .select("id, title, status, inherent_likelihood, inherent_impact, residual_likelihood, residual_impact, owner_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  const focus = input.focus as string | undefined;
  const all = (risks || []) as Array<{
    id: string; title: string; status: string;
    inherent_likelihood: number; inherent_impact: number;
    residual_likelihood: number; residual_impact: number;
  }>;

  const scored = all.map((r) => ({
    ...r,
    inherent_score: r.inherent_likelihood * r.inherent_impact,
    residual_score: r.residual_likelihood * r.residual_impact,
  }));

  const high = scored.filter((r) => r.inherent_score >= 15);
  const open = scored.filter((r) => r.status === "identified" || r.status === "assessed");

  return {
    total_risks: scored.length,
    high_severity: high.length,
    open_risks: open.length,
    focus_query: focus ?? null,
    top_risks: high.slice(0, 5).map((r) => ({ id: r.id, title: r.title, score: r.inherent_score, status: r.status })),
  };
}

async function executeComplianceCheck(
  organizationId: string,
  input: Record<string, unknown>
): Promise<object> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: org } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .single();

  const reqStatuses: Record<string, string> = (org?.settings?.requirement_statuses as Record<string, string>) ?? {};

  const { data: frameworks } = await admin
    .from("compliance_frameworks")
    .select("id, code, name, structure")
    .eq("is_active", true);

  const frameworkCode = input.framework_code as string | undefined;
  const toCheck = frameworkCode
    ? (frameworks || []).filter((f: { code: string }) => f.code === frameworkCode)
    : (frameworks || []);

  type Framework = { id: string; code: string; name: string; structure?: { domains?: Array<{ requirements?: Array<{ id: string }> }> } };

  const results = (toCheck as Framework[]).map((fw) => {
    const domains = fw.structure?.domains ?? [];
    let total = 0, implemented = 0, notStarted = 0;

    for (const domain of domains) {
      for (const req of domain.requirements ?? []) {
        total++;
        const key = `${fw.code}:${req.id}`;
        const status = reqStatuses[key] ?? "not_started";
        if (status === "implemented") implemented++;
        if (status === "not_started") notStarted++;
      }
    }

    return {
      code: fw.code,
      name: fw.name,
      total_requirements: total,
      implemented,
      not_started: notStarted,
      progress_pct: total > 0 ? Math.round((implemented / total) * 100) : 0,
      gaps: notStarted,
    };
  });

  return { frameworks: results, checked_at: new Date().toISOString() };
}

// ─── Main executor ───────────────────────────────────────────────────────────

export async function runAgent(agentId: string, organizationId: string): Promise<{ tasksCreated: number; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // 1. Fetch agent + agent type
  const { data: agent, error: agentErr } = await admin
    .from("agents")
    .select("*, agent_type:agent_types(id, name, skills)")
    .eq("id", agentId)
    .eq("organization_id", organizationId)
    .single();

  if (agentErr || !agent) {
    return { tasksCreated: 0, error: "Agent not found" };
  }

  type AgentType = { id: string; name: string; skills: string[] };
  const agentType = agent.agent_type as AgentType;
  const skillIds: string[] = Array.isArray(agentType?.skills) ? agentType.skills : [];

  if (skillIds.length === 0) {
    return { tasksCreated: 0, error: "Agent has no skills configured" };
  }

  // 2. Setup
  const runId = crypto.randomUUID();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools = buildToolDefinitions(skillIds);
  const tasksCreated: number[] = [];

  async function createTask(params: {
    title: string;
    description: string;
    skillUsed: string;
    actionType: "read" | "write";
    status: "completed" | "pending_approval" | "failed";
    result?: object;
    errorMessage?: string;
  }): Promise<string> {
    const taskId = `TASK-${Date.now().toString(36).toUpperCase()}`;
    const requiresApproval = WRITE_SKILLS.has(params.skillUsed);

    await admin.from("agent_tasks").insert({
      organization_id: organizationId,
      agent_id: agentId,
      task_id: taskId,
      run_id: runId,
      title: params.title,
      description: params.description,
      skill_used: params.skillUsed,
      action_type: params.actionType,
      status: params.status,
      result: params.result ?? null,
      error_message: params.errorMessage ?? null,
      requires_approval: requiresApproval,
    });

    tasksCreated.push(1);
    return taskId;
  }

  // 3. Build Claude messages
  const systemPrompt = `You are ${agent.name}, a GRC (Governance, Risk & Compliance) agent for an organization.
Your job: ${agent.description || agentType.name}
Your allowed skills: ${skillIds.join(", ")}
Agent config: ${JSON.stringify(agent.config)}

Rules:
- Only use the tools provided to you — no other actions
- Be concise and focused on GRC tasks
- For write tools (create_risk, create_incident, etc.), only propose actions that are clearly justified by your research
- Limit yourself to 1-3 tool calls per run`;

  const userMessage = `Run your scheduled tasks now. Use your skills to complete your mission based on your configuration.`;

  type MessageParam = Anthropic.MessageParam;
  const messages: MessageParam[] = [{ role: "user", content: userMessage }];

  // 4. Agentic loop (max 3 iterations)
  let iterations = 0;
  const MAX_ITERATIONS = 3;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    });

    // Add assistant response to messages
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") break;

    // Process tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      const toolUse = block as Anthropic.ToolUseBlock;
      const input = toolUse.input as Record<string, unknown>;
      const skill = getSkillMeta(toolUse.name);

      if (WRITE_SKILLS.has(toolUse.name)) {
        // Write skill → queue for approval
        await createTask({
          title: buildWriteTaskTitle(toolUse.name, input),
          description: JSON.stringify(input, null, 2),
          skillUsed: toolUse.name,
          actionType: "write",
          status: "pending_approval",
          result: input,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify({ status: "queued_for_approval", message: "This action requires user approval before execution." }),
        });
      } else {
        // Read skill → execute now
        let result: object = {};
        let taskStatus: "completed" | "failed" = "completed";
        let errorMsg: string | undefined;

        try {
          result = await executeReadSkill(toolUse.name, input, organizationId);
        } catch (err) {
          taskStatus = "failed";
          errorMsg = err instanceof Error ? err.message : String(err);
          result = { error: errorMsg };
        }

        await createTask({
          title: `${skill?.name ?? toolUse.name}: ${buildReadTaskTitle(toolUse.name, input)}`,
          description: `Agent executed ${toolUse.name}`,
          skillUsed: toolUse.name,
          actionType: "read",
          status: taskStatus,
          result,
          errorMessage: errorMsg,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  // 5. Update agent timestamps
  const nextRun = calculateNextRun(agent.schedule as string);
  await admin
    .from("agents")
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: nextRun?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId);

  // 6. Audit
  void logAudit({
    organizationId,
    userId: agent.created_by ?? "system",
    action: "agent.run",
    entityType: "agent",
    entityId: agentId,
    newValues: { run_id: runId, tasks_created: tasksCreated.length, schedule: agent.schedule },
  });

  return { tasksCreated: tasksCreated.length };
}

function getSkillMeta(skillId: string) {
  return SKILL_MAP[skillId];
}

async function executeReadSkill(skillId: string, input: Record<string, unknown>, organizationId: string): Promise<object> {
  switch (skillId) {
    case "web_search":
      return executeWebSearch(input);
    case "risk_analysis":
      return executeRiskAnalysis(organizationId, input);
    case "compliance_check":
      return executeComplianceCheck(organizationId, input);
    case "send_report":
      return {
        report_type: input.report_type,
        summary: input.summary,
        generated_at: new Date().toISOString(),
      };
    default:
      return { error: `Unknown read skill: ${skillId}` };
  }
}

function buildWriteTaskTitle(skillId: string, input: Record<string, unknown>): string {
  switch (skillId) {
    case "create_risk":
      return `Create Risk: ${input.title ?? "Untitled"}`;
    case "create_incident":
      return `Create Incident: ${input.title ?? "Untitled"} (${input.severity ?? "unknown"} severity)`;
    case "create_policy":
      return `Create Policy: ${input.title ?? "Untitled"}`;
    case "update_requirement":
      return `Update Requirement: ${input.framework_code}/${input.requirement_id} → ${input.new_status}`;
    default:
      return skillId;
  }
}

function buildReadTaskTitle(skillId: string, input: Record<string, unknown>): string {
  switch (skillId) {
    case "web_search":
      return String(input.query ?? "search");
    case "risk_analysis":
      return input.focus ? String(input.focus) : "full analysis";
    case "compliance_check":
      return input.framework_code ? String(input.framework_code) : "all frameworks";
    case "send_report":
      return String(input.report_type ?? "report");
    default:
      return skillId;
  }
}
