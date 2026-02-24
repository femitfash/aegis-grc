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

  // Verify the control exists and the user has access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (admin as any)
    .from("control_library")
    .select("id, owner_id, organization_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return Response.json({ error: "Control not found" }, { status: 404 });
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
  if (typeof body.control_type === "string") allowedFields.control_type = body.control_type;
  if (typeof body.automation_level === "string")
    allowedFields.automation_level = body.automation_level;
  if (typeof body.effectiveness_rating === "number")
    allowedFields.effectiveness_rating = body.effectiveness_rating;
  if (
    typeof body.status === "string" &&
    ["draft", "testing", "implemented", "active", "deprecated"].includes(body.status)
  ) {
    allowedFields.status = body.status;
  }
  if (Array.isArray(body.frameworks)) {
    allowedFields.metadata = { frameworks: body.frameworks };
  }
  if (typeof body.owner_id === "string") allowedFields.owner_id = body.owner_id;

  if (Object.keys(allowedFields).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  allowedFields.updated_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("control_library")
    .update(allowedFields)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("PATCH /api/controls/[id] error:", JSON.stringify(error));
    return Response.json(
      { error: "Failed to update control", detail: error.message },
      { status: 500 }
    );
  }

  return Response.json({ success: true, control: data });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Verify the control exists and the user has access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (admin as any)
    .from("control_library")
    .select("id, owner_id, organization_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return Response.json({ error: "Control not found" }, { status: 404 });
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
  await (admin as any).from("risk_control_mappings").delete().eq("control_id", id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("control_library").delete().eq("id", id);

  if (error) {
    console.error("DELETE /api/controls/[id] error:", JSON.stringify(error));
    return Response.json(
      { error: "Failed to delete control", detail: error.message },
      { status: 500 }
    );
  }

  return Response.json({ success: true });
}
