import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { runAgent } from "@/shared/lib/agents/executor";
import { checkAgentUsage, incrementAgentRunCount } from "@/shared/lib/agents/usage";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: userData } = await admin
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) return Response.json({ error: "No organization" }, { status: 400 });
    if (!["owner", "admin"].includes(userData.role ?? "")) {
      return Response.json({ error: "Only owners and admins can run agents" }, { status: 403 });
    }

    // Verify agent belongs to org and is active
    const { data: agent } = await admin
      .from("agents")
      .select("id, status")
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

    if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });
    if (agent.status === "suspended") {
      return Response.json({ error: "Agent is suspended. Activate it before running." }, { status: 400 });
    }
    if (agent.status === "deleted") {
      return Response.json({ error: "Agent not found" }, { status: 404 });
    }

    // Check agent action usage / billing
    const usage = await checkAgentUsage(userData.organization_id);
    if (!usage.allowed) {
      return Response.json({
        error: "agent_limit_reached",
        upgrade_prompt: true,
        message: usage.reason,
        usage,
      }, { status: 402 });
    }

    const result = await runAgent(id, userData.organization_id);

    if (result.error) {
      return Response.json({ error: result.error }, { status: 500 });
    }

    await incrementAgentRunCount(userData.organization_id);

    return Response.json({ success: true, tasks_created: result.tasksCreated, write_tasks: result.writeTasksCreated, read_tasks: result.readTasksCompleted });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
