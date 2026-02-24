import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Verify the risk exists and the user has access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (admin as any)
    .from("risks")
    .select("id, owner_id, organization_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  // Check ownership or org membership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any)
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  const userOrgId = userData?.organization_id ?? null;
  const isAdmin = userData?.role === "admin";

  const hasAccess =
    existing.owner_id === user.id ||
    isAdmin ||
    (userOrgId && existing.organization_id === userOrgId);

  if (!hasAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Only allow updating specific fields
  const allowedFields: Record<string, unknown> = {};
  if (typeof body.title === "string") allowedFields.title = body.title;
  if (typeof body.description === "string") allowedFields.description = body.description;
  if (typeof body.inherent_likelihood === "number")
    allowedFields.inherent_likelihood = body.inherent_likelihood;
  if (typeof body.inherent_impact === "number")
    allowedFields.inherent_impact = body.inherent_impact;
  if (
    typeof body.status === "string" &&
    ["identified", "assessed", "mitigated", "accepted", "closed"].includes(body.status)
  ) {
    allowedFields.status = body.status;
  }
  if (typeof body.risk_response === "string") allowedFields.risk_response = body.risk_response;
  if (typeof body.owner_id === "string") allowedFields.owner_id = body.owner_id;
  if (typeof body.due_date === "string" || body.due_date === null)
    allowedFields.due_date = body.due_date;

  if (Object.keys(allowedFields).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  allowedFields.updated_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("risks")
    .update(allowedFields)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("PATCH /api/risks/[id] error:", JSON.stringify(error));
    return Response.json(
      { error: "Failed to update risk", detail: error.message },
      { status: 500 }
    );
  }

  return Response.json({ success: true, risk: data });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Verify the risk exists and the user has access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (admin as any)
    .from("risks")
    .select("id, owner_id, organization_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  // Check ownership or admin role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any)
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  const userOrgId = userData?.organization_id ?? null;
  const isAdmin = userData?.role === "admin";

  const hasAccess =
    existing.owner_id === user.id ||
    isAdmin ||
    (userOrgId && existing.organization_id === userOrgId);

  if (!hasAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete linked risk_control_mappings first to avoid FK constraint errors
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("risk_control_mappings").delete().eq("risk_id", id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("risks").delete().eq("id", id);

  if (error) {
    console.error("DELETE /api/risks/[id] error:", JSON.stringify(error));
    return Response.json(
      { error: "Failed to delete risk", detail: error.message },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}
