import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { logAudit } from "@/shared/lib/audit";

const VALID_SCHEDULES = ["manual", "hourly", "daily_6am", "daily_9am", "weekly_monday"];

export async function GET(_request: NextRequest) {
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
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) return Response.json({ agents: [] });

    const { data, error } = await admin
      .from("agents")
      .select("*, agent_type:agent_types(id, name, skills, is_default)")
      .eq("organization_id", userData.organization_id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });

    if (error) return Response.json({ agents: [], error: error.message }, { status: 500 });

    let agents = data ?? [];

    // Auto-provision a default GRC Agent instance if none exist
    if (agents.length === 0) {
      const { data: defaultType } = await admin
        .from("agent_types")
        .select("id")
        .eq("organization_id", userData.organization_id)
        .eq("is_default", true)
        .single();

      if (defaultType) {
        const { data: newAgent } = await admin
          .from("agents")
          .insert({
            organization_id: userData.organization_id,
            agent_type_id: defaultType.id,
            name: "GRC Agent",
            description: "Your default generalist GRC agent. Monitors compliance, analyzes risks, and checks frameworks.",
            schedule: "manual",
            config: {},
            created_by: user.id,
          })
          .select("*, agent_type:agent_types(id, name, skills, is_default)")
          .single();

        if (newAgent) agents = [newAgent];
      }
    }

    return Response.json({ agents });
  } catch (err) {
    return Response.json({ agents: [], error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    if (!userData?.organization_id) return Response.json({ error: "No organization found" }, { status: 400 });
    if (!["owner", "admin"].includes(userData.role ?? "")) {
      return Response.json({ error: "Only owners and admins can create agents" }, { status: 403 });
    }

    // Only Enterprise plan can create custom agents
    const { data: sub } = await admin
      .from("subscriptions")
      .select("plan")
      .eq("organization_id", userData.organization_id)
      .single();

    if (sub?.plan !== "enterprise") {
      return Response.json({ error: "Custom agent creation requires an Enterprise plan" }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const agentTypeId = typeof body.agent_type_id === "string" ? body.agent_type_id : "";
    const schedule = VALID_SCHEDULES.includes(body.schedule) ? body.schedule : "manual";
    const config = typeof body.config === "object" && body.config !== null ? body.config : {};

    if (!name) return Response.json({ error: "name is required" }, { status: 400 });
    if (!agentTypeId) return Response.json({ error: "agent_type_id is required" }, { status: 400 });

    // Verify agent_type belongs to same org
    const { data: agentType } = await admin
      .from("agent_types")
      .select("id")
      .eq("id", agentTypeId)
      .eq("organization_id", userData.organization_id)
      .single();

    if (!agentType) return Response.json({ error: "Agent type not found" }, { status: 404 });

    const { data, error } = await admin
      .from("agents")
      .insert({
        organization_id: userData.organization_id,
        agent_type_id: agentTypeId,
        name,
        description,
        schedule,
        config,
        created_by: user.id,
      })
      .select("*, agent_type:agent_types(id, name, skills, is_default)")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    void logAudit({
      organizationId: userData.organization_id,
      userId: user.id,
      action: "agent.created",
      entityType: "agent",
      entityId: data.id,
      newValues: { name, schedule, agent_type_id: agentTypeId },
    });

    return Response.json({ success: true, agent: data }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
