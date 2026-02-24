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
  const { data: existing, error: fetchError } = await (admin as any).from("policies").select("id, owner_id, organization_id").eq("id", id).single();
  if (fetchError || !existing) return Response.json({ error: "Policy not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any).from("users").select("organization_id, role").eq("id", user.id).single();
  const isAdmin = userData?.role === "admin";
  const hasAccess = existing.owner_id === user.id || isAdmin || (userData?.organization_id && existing.organization_id === userData.organization_id);
  if (!hasAccess) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const allowed: Record<string, unknown> = {};
  if (typeof body.title === "string") allowed.title = body.title;
  if (typeof body.description === "string") allowed.description = body.description;
  if (typeof body.category === "string") allowed.category = body.category;
  if (typeof body.version === "string") allowed.version = body.version;
  if (typeof body.effective_date === "string" || body.effective_date === null) allowed.effective_date = body.effective_date;
  if (typeof body.review_date === "string" || body.review_date === null) allowed.review_date = body.review_date;
  if (typeof body.attestation_required === "boolean") allowed.attestation_required = body.attestation_required;
  if (typeof body.owner_id === "string") allowed.owner_id = body.owner_id;
  if (typeof body.status === "string" && ["draft", "active", "archived"].includes(body.status)) allowed.status = body.status;

  if (Object.keys(allowed).length === 0) return Response.json({ error: "No valid fields to update" }, { status: 400 });
  allowed.updated_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("policies").update(allowed).eq("id", id).select().single();
  if (error) return Response.json({ error: "Failed to update policy", detail: error.message }, { status: 500 });

  void logAudit({ organizationId: existing.organization_id, userId: user.id, action: "policy.updated", entityType: "policy", entityId: id, oldValues: existing, newValues: allowed });
  return Response.json({ success: true, policy: data });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (admin as any).from("policies").select("id, owner_id, organization_id").eq("id", id).single();
  if (fetchError || !existing) return Response.json({ error: "Policy not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any).from("users").select("organization_id, role").eq("id", user.id).single();
  const isAdmin = userData?.role === "admin";
  const hasAccess = existing.owner_id === user.id || isAdmin || (userData?.organization_id && existing.organization_id === userData.organization_id);
  if (!hasAccess) return Response.json({ error: "Forbidden" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("policies").delete().eq("id", id);
  if (error) return Response.json({ error: "Failed to delete policy", detail: error.message }, { status: 500 });

  void logAudit({ organizationId: existing.organization_id, userId: user.id, action: "policy.deleted", entityType: "policy", entityId: id, oldValues: existing });
  return Response.json({ success: true });
}
