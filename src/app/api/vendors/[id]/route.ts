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
  const { data: existing, error: fetchError } = await (admin as any).from("vendors").select("id, organization_id").eq("id", id).single();
  if (fetchError || !existing) return Response.json({ error: "Vendor not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any).from("users").select("organization_id").eq("id", user.id).single();
  if (userData?.organization_id !== existing.organization_id) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const allowed: Record<string, unknown> = {};
  if (typeof body.name === "string") allowed.name = body.name;
  if (typeof body.category === "string") allowed.category = body.category;
  if (typeof body.tier === "string" && ["critical", "high", "medium", "low"].includes(body.tier)) allowed.tier = body.tier;
  if (typeof body.status === "string" && ["active", "under_review", "approved", "suspended"].includes(body.status)) allowed.status = body.status;
  if (typeof body.contact_name === "string") allowed.contact_name = body.contact_name;
  if (typeof body.contact_email === "string") allowed.contact_email = body.contact_email;
  if (typeof body.website === "string") allowed.website = body.website;
  if (typeof body.contract_expiry === "string" || body.contract_expiry === null) allowed.contract_expiry = body.contract_expiry;
  if (typeof body.risk_score === "number") allowed.risk_score = Math.min(25, Math.max(1, body.risk_score));
  if (typeof body.notes === "string") allowed.notes = body.notes;
  if (body.last_assessed_at) allowed.last_assessed_at = body.last_assessed_at;

  if (Object.keys(allowed).length === 0) return Response.json({ error: "No valid fields to update" }, { status: 400 });
  allowed.updated_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("vendors").update(allowed).eq("id", id).select().single();
  if (error) return Response.json({ error: "Failed to update vendor", detail: error.message }, { status: 500 });

  void logAudit({ organizationId: existing.organization_id, userId: user.id, action: "vendor.updated", entityType: "vendor", entityId: id, oldValues: existing, newValues: allowed });
  return Response.json({ success: true, vendor: data });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (admin as any).from("vendors").select("id, organization_id").eq("id", id).single();
  if (fetchError || !existing) return Response.json({ error: "Vendor not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any).from("users").select("organization_id").eq("id", user.id).single();
  if (userData?.organization_id !== existing.organization_id) return Response.json({ error: "Forbidden" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("vendors").delete().eq("id", id);
  if (error) return Response.json({ error: "Failed to delete vendor", detail: error.message }, { status: 500 });

  void logAudit({ organizationId: existing.organization_id, userId: user.id, action: "vendor.deleted", entityType: "vendor", entityId: id, oldValues: existing });
  return Response.json({ success: true });
}
