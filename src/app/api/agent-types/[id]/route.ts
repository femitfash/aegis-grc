import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { logAudit } from "@/shared/lib/audit";
import { SKILL_CATALOG } from "@/shared/lib/agents/skills";

const VALID_SKILL_IDS = new Set(SKILL_CATALOG.map((s) => s.id));

type RouteContext = { params: Promise<{ id: string }> };

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
      return Response.json({ error: "Only owners and admins can update agent types" }, { status: 403 });
    }

    const { data: existing } = await admin
      .from("agent_types")
      .select("id, is_default, organization_id")
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

    if (!existing) return Response.json({ error: "Agent type not found" }, { status: 404 });

    const body = await request.json();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.name === "string" && body.name.trim()) {
      update.name = body.name.trim();
    }
    if (typeof body.description === "string") {
      update.description = body.description.trim();
    }
    // Protect default type's skills
    if (!existing.is_default && Array.isArray(body.skills)) {
      const skills = body.skills.filter((s: unknown) => typeof s === "string" && VALID_SKILL_IDS.has(s as string));
      if (skills.length > 0) update.skills = skills;
    }
    if (typeof body.is_active === "boolean") {
      update.is_active = body.is_active;
    }

    const { data, error } = await admin
      .from("agent_types")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    void logAudit({
      organizationId: userData.organization_id,
      userId: user.id,
      action: "agent_type.updated",
      entityType: "agent_type",
      entityId: id,
      newValues: update,
    });

    return Response.json({ success: true, agent_type: data });
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
      return Response.json({ error: "Only owners and admins can delete agent types" }, { status: 403 });
    }

    const { data: existing } = await admin
      .from("agent_types")
      .select("id, is_default, organization_id")
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

    if (!existing) return Response.json({ error: "Agent type not found" }, { status: 404 });
    if (existing.is_default) {
      return Response.json({ error: "The default GRC Agent type cannot be deleted" }, { status: 400 });
    }

    const { error } = await admin
      .from("agent_types")
      .delete()
      .eq("id", id);

    if (error) return Response.json({ error: error.message }, { status: 500 });

    void logAudit({
      organizationId: userData.organization_id,
      userId: user.id,
      action: "agent_type.deleted",
      entityType: "agent_type",
      entityId: id,
      oldValues: { id },
    });

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
