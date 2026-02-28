import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { logAudit } from "@/shared/lib/audit";
import { SKILL_CATALOG } from "@/shared/lib/agents/skills";

const VALID_SKILL_IDS = new Set(SKILL_CATALOG.map((s) => s.id));

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

    if (!userData?.organization_id) {
      return Response.json({ agent_types: [] });
    }

    const { data, error } = await admin
      .from("agent_types")
      .select("*")
      .eq("organization_id", userData.organization_id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return Response.json({ agent_types: [], error: error.message }, { status: 500 });

    // Auto-provision the default GRC Agent Type if none exist yet
    let types = data ?? [];
    if (types.length === 0) {
      const { data: newType } = await admin
        .from("agent_types")
        .insert({
          organization_id: userData.organization_id,
          name: "GRC Agent",
          description: "Default agent with web search, risk analysis, and compliance checking skills.",
          skills: ["web_search", "risk_analysis", "compliance_check", "send_report", "create_risk", "update_requirement"],
          is_default: true,
          created_by: user.id,
        })
        .select()
        .single();
      if (newType) types = [newType];
    }

    return Response.json({ agent_types: types });
  } catch (err) {
    return Response.json({ agent_types: [], error: err instanceof Error ? err.message : String(err) }, { status: 500 });
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

    if (!userData?.organization_id) {
      return Response.json({ error: "No organization found" }, { status: 400 });
    }
    if (!["owner", "admin"].includes(userData.role ?? "")) {
      return Response.json({ error: "Only owners and admins can create agent types" }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const skills = Array.isArray(body.skills) ? body.skills.filter((s: unknown) => typeof s === "string" && VALID_SKILL_IDS.has(s as string)) : [];

    if (!name) return Response.json({ error: "name is required" }, { status: 400 });
    if (skills.length === 0) return Response.json({ error: "At least one valid skill is required" }, { status: 400 });

    const { data, error } = await admin
      .from("agent_types")
      .insert({
        organization_id: userData.organization_id,
        name,
        description,
        skills,
        is_default: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    void logAudit({
      organizationId: userData.organization_id,
      userId: user.id,
      action: "agent_type.created",
      entityType: "agent_type",
      entityId: data.id,
      newValues: { name, skills },
    });

    return Response.json({ success: true, agent_type: data }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
