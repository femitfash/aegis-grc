import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { logAudit } from "@/shared/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (admin as any).from("incidents").select("id, owner_id, organization_id").eq("id", id).single();
  if (fetchError || !existing) return Response.json({ error: "Incident not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any).from("users").select("organization_id, role").eq("id", user.id).single();
  const isAdmin = userData?.role === "admin";
  const hasAccess = existing.owner_id === user.id || isAdmin || (userData?.organization_id && existing.organization_id === userData.organization_id);
  if (!hasAccess) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const allowed: Record<string, unknown> = {};
  if (typeof body.title === "string") allowed.title = body.title;
  if (typeof body.description === "string") allowed.description = body.description;
  if (typeof body.severity === "string" && ["critical", "high", "medium", "low"].includes(body.severity)) allowed.severity = body.severity;
  if (typeof body.status === "string" && ["detected", "contained", "resolved", "post_mortem", "closed"].includes(body.status)) allowed.status = body.status;
  if (typeof body.impact === "string") allowed.impact = body.impact;
  if (typeof body.affected_systems === "string") allowed.affected_systems = body.affected_systems;
  if (typeof body.root_cause === "string") allowed.root_cause = body.root_cause;
  if (typeof body.owner_id === "string") allowed.owner_id = body.owner_id;
  if (typeof body.discovered_at === "string") allowed.discovered_at = body.discovered_at;
  if (typeof body.contained_at === "string" || body.contained_at === null) allowed.contained_at = body.contained_at;
  if (typeof body.resolved_at === "string" || body.resolved_at === null) allowed.resolved_at = body.resolved_at;

  if (Object.keys(allowed).length === 0) return Response.json({ error: "No valid fields to update" }, { status: 400 });
  allowed.updated_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("incidents").update(allowed).eq("id", id).select().single();
  if (error) return Response.json({ error: "Failed to update incident", detail: error.message }, { status: 500 });

  void logAudit({ organizationId: existing.organization_id, userId: user.id, action: "incident.updated", entityType: "incident", entityId: id, oldValues: existing, newValues: allowed });
  return Response.json({ success: true, incident: data });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (admin as any).from("incidents").select("id, owner_id, organization_id").eq("id", id).single();
  if (fetchError || !existing) return Response.json({ error: "Incident not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any).from("users").select("organization_id, role").eq("id", user.id).single();
  const isAdmin = userData?.role === "admin";
  const hasAccess = existing.owner_id === user.id || isAdmin || (userData?.organization_id && existing.organization_id === userData.organization_id);
  if (!hasAccess) return Response.json({ error: "Forbidden" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("incidents").delete().eq("id", id);
  if (error) return Response.json({ error: "Failed to delete incident", detail: error.message }, { status: 500 });

  void logAudit({ organizationId: existing.organization_id, userId: user.id, action: "incident.deleted", entityType: "incident", entityId: id, oldValues: existing });
  return Response.json({ success: true });
}
