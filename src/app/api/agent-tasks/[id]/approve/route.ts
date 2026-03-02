import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { logAudit } from "@/shared/lib/audit";

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
      return Response.json({ error: "Only owners and admins can approve agent tasks" }, { status: 403 });
    }

    const { data: task } = await admin
      .from("agent_tasks")
      .select("*")
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

    if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
    if (task.status !== "pending_approval") {
      return Response.json({ error: "Task is not pending approval" }, { status: 400 });
    }

    // Execute the deferred write action
    const payload = task.result as Record<string, unknown>;
    let executionError: string | null = null;

    try {
      await executeApprovedAction(task.skill_used as string, payload, userData.organization_id, user.id, admin);
    } catch (err) {
      executionError = err instanceof Error ? err.message : String(err);
    }

    // Update task status
    const newStatus = executionError ? "failed" : "approved";
    await admin
      .from("agent_tasks")
      .update({
        status: newStatus,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        error_message: executionError ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    void logAudit({
      organizationId: userData.organization_id,
      userId: user.id,
      action: "agent_task.approved",
      entityType: "agent_task",
      entityId: id,
      newValues: { skill: task.skill_used, status: newStatus, error: executionError },
    });

    if (executionError) {
      return Response.json({ error: `Approved but execution failed: ${executionError}` }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

async function executeApprovedAction(
  skillId: string,
  payload: Record<string, unknown>,
  organizationId: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any
): Promise<void> {
  switch (skillId) {
    case "create_risk": {
      const incidentId = `RISK-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await admin.from("risks").insert({
        organization_id: organizationId,
        risk_id: incidentId,
        title: payload.title,
        description: payload.description ?? "",
        inherent_likelihood: Math.min(5, Math.max(1, Number(payload.likelihood) || 3)),
        inherent_impact: Math.min(5, Math.max(1, Number(payload.impact) || 3)),
        residual_likelihood: Math.min(5, Math.max(1, Number(payload.likelihood) || 3)),
        residual_impact: Math.min(5, Math.max(1, Number(payload.impact) || 3)),
        status: "identified",
        owner_id: userId,
      });
      if (error) throw new Error(error.message);
      break;
    }

    case "create_incident": {
      const incId = `INC-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await admin.from("incidents").insert({
        organization_id: organizationId,
        incident_id: incId,
        title: payload.title,
        description: payload.description ?? "",
        severity: payload.severity ?? "medium",
        status: "detected",
        discovered_at: new Date().toISOString(),
        owner_id: userId,
      });
      if (error) throw new Error(error.message);
      break;
    }

    case "create_policy": {
      const polId = `POL-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await admin.from("policies").insert({
        organization_id: organizationId,
        policy_id: polId,
        title: payload.title,
        description: payload.description ?? "",
        category: payload.category ?? "General",
        status: "draft",
        owner_id: userId,
        version: "1.0",
      });
      if (error) throw new Error(error.message);
      break;
    }

    case "update_requirement": {
      // Requirement status is stored in organizations.settings.requirement_statuses
      const { data: org } = await admin
        .from("organizations")
        .select("settings")
        .eq("id", organizationId)
        .single();

      const settings = (org?.settings ?? {}) as Record<string, unknown>;
      const reqStatuses = ((settings.requirement_statuses ?? {}) as Record<string, string>);
      const key = `${payload.framework_code}:${payload.requirement_id}`;
      reqStatuses[key] = payload.new_status as string;

      const { error } = await admin
        .from("organizations")
        .update({ settings: { ...settings, requirement_statuses: reqStatuses } })
        .eq("id", organizationId);

      if (error) throw new Error(error.message);
      break;
    }

    case "create_control": {
      const ctrlCode = `CTRL-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await admin.from("control_library").insert({
        organization_id: organizationId,
        code: ctrlCode,
        title: payload.title,
        description: payload.description ?? "",
        control_type: payload.control_type ?? "technical",
        automation_level: payload.automation_level ?? "manual",
        effectiveness_rating: Math.min(5, Math.max(1, Number(payload.effectiveness_rating) || 3)),
        status: "draft",
        metadata: { frameworks: Array.isArray(payload.frameworks) ? payload.frameworks : [] },
        owner_id: userId,
      });
      if (error) throw new Error(error.message);
      break;
    }

    case "create_evidence": {
      const evdId = `EVD-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await admin.from("evidence").insert({
        organization_id: organizationId,
        evidence_id: evdId,
        title: payload.title,
        description: payload.description ?? "",
        source_type: payload.source_type ?? "manual",
        source_metadata: {},
        metadata: {
          frameworks: Array.isArray(payload.frameworks) ? payload.frameworks : [],
          control_code: payload.control_code ?? null,
        },
        created_by: userId,
        collected_at: new Date().toISOString(),
        status: "pending",
      });
      if (error) throw new Error(error.message);
      break;
    }

    default:
      throw new Error(`Unknown write skill: ${skillId}`);
  }
}
