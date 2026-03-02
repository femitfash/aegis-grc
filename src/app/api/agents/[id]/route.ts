import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { logAudit } from "@/shared/lib/audit";

const VALID_SCHEDULES = ["manual", "hourly", "daily_6am", "daily_9am", "weekly_monday"];

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
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
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) return Response.json({ error: "No organization" }, { status: 400 });

    const { data, error } = await admin
      .from("agents")
      .select("*, agent_type:agent_types(id, name, skills, is_default)")
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

    if (error || !data) return Response.json({ error: "Agent not found" }, { status: 404 });

    return Response.json({ agent: data });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
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
      return Response.json({ error: "Only owners and admins can update agents" }, { status: 403 });
    }

    const { data: existing } = await admin
      .from("agents")
      .select("id, organization_id")
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

    if (!existing) return Response.json({ error: "Agent not found" }, { status: 404 });

    const body = await request.json();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
    if (typeof body.description === "string") update.description = body.description.trim();
    if (typeof body.status === "string" && ["active", "suspended"].includes(body.status)) update.status = body.status;
    if (typeof body.schedule === "string" && VALID_SCHEDULES.includes(body.schedule)) update.schedule = body.schedule;
    if (typeof body.config === "object" && body.config !== null) update.config = body.config;

    const { data, error } = await admin
      .from("agents")
      .update(update)
      .eq("id", id)
      .select("*, agent_type:agent_types(id, name, skills, is_default)")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    void logAudit({
      organizationId: userData.organization_id,
      userId: user.id,
      action: "agent.updated",
      entityType: "agent",
      entityId: id,
      newValues: update,
    });

    return Response.json({ success: true, agent: data });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
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
      return Response.json({ error: "Only owners and admins can delete agents" }, { status: 403 });
    }

    const { data: existing } = await admin
      .from("agents")
      .select("id, agent_type_id")
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

    if (!existing) return Response.json({ error: "Agent not found" }, { status: 404 });

    // Check if this is the default agent (attached to the default agent type)
    if (existing.agent_type_id) {
      const { data: agentType } = await admin
        .from("agent_types")
        .select("is_default")
        .eq("id", existing.agent_type_id)
        .single();
      if (agentType?.is_default) {
        return Response.json({ error: "The default agent cannot be deleted" }, { status: 403 });
      }
    }

    // Soft delete
    const { error } = await admin
      .from("agents")
      .update({ status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return Response.json({ error: error.message }, { status: 500 });

    void logAudit({
      organizationId: userData.organization_id,
      userId: user.id,
      action: "agent.deleted",
      entityType: "agent",
      entityId: id,
    });

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
