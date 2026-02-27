import { NextRequest } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { runAgent } from "@/shared/lib/agents/executor";

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized execution
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;

    // Find all active agents whose next_run_at is in the past
    const { data: dueAgents, error } = await admin
      .from("agents")
      .select("id, organization_id, name")
      .eq("status", "active")
      .lte("next_run_at", new Date().toISOString())
      .not("next_run_at", "is", null);

    if (error) {
      console.error("[cron] Failed to query due agents:", error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    const agents = dueAgents ?? [];
    if (agents.length === 0) {
      return Response.json({ triggered: 0, message: "No agents due" });
    }

    // Run each due agent (fire sequentially to avoid overwhelming Claude API)
    let triggered = 0;
    const errors: string[] = [];

    for (const agent of agents as Array<{ id: string; organization_id: string; name: string }>) {
      try {
        const result = await runAgent(agent.id, agent.organization_id);
        if (result.error) {
          errors.push(`${agent.name}: ${result.error}`);
        } else {
          triggered++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${agent.name}: ${msg}`);
        console.error(`[cron] Failed to run agent ${agent.id}:`, msg);
      }
    }

    return Response.json({
      triggered,
      total: agents.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron] Unexpected error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
