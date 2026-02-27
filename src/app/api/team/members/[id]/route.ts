import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

const VALID_ROLES = ["admin", "compliance_manager", "risk_owner", "auditor", "viewer"];

/** PATCH — suspend/unsuspend a member or change their role */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: me } = await (admin as any)
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!me?.organization_id) {
    return Response.json({ error: "No organization found" }, { status: 400 });
  }

  if (!["admin", "compliance_manager"].includes(me.role)) {
    return Response.json({ error: "Only admins can modify team members" }, { status: 403 });
  }

  // Prevent self-modification
  if (id === user.id) {
    return Response.json({ error: "You cannot modify your own account here" }, { status: 400 });
  }

  // Build the update payload — only accept known fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};

  if (body.status !== undefined) {
    if (!["active", "suspended"].includes(body.status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = body.status;
  }

  if (body.role !== undefined) {
    const normalized = body.role.toLowerCase().replace(/ /g, "_");
    if (!VALID_ROLES.includes(normalized)) {
      return Response.json({ error: "Invalid role" }, { status: 400 });
    }
    update.role = normalized;
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("users")
    .update(update)
    .eq("id", id)
    .eq("organization_id", me.organization_id)
    .select("id, email, full_name, role, status, last_active_at, created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Member not found in your organization" }, { status: 404 });

  return Response.json({ member: data });
}

/** DELETE — remove a member from the organization */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: me } = await (admin as any)
    .from("users")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!me?.organization_id) {
    return Response.json({ error: "No organization found" }, { status: 400 });
  }

  if (!["admin", "compliance_manager"].includes(me.role)) {
    return Response.json({ error: "Only admins can remove team members" }, { status: 403 });
  }

  if (id === user.id) {
    return Response.json({ error: "You cannot remove yourself from the organization" }, { status: 400 });
  }

  // Nullify organization_id rather than hard-deleting so audit history is preserved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("users")
    .update({ organization_id: null, status: "suspended" })
    .eq("id", id)
    .eq("organization_id", me.organization_id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}
