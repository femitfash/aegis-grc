import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return Response.json({ error: "Invite ID required" }, { status: 400 });

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

  if (!CAN_INVITE.includes(me.role)) {
    return Response.json({ error: "Only admins can cancel invites" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("invites")
    .delete()
    .eq("id", id)
    .eq("organization_id", me.organization_id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}

const VALID_ROLES = ["owner", "admin", "compliance_manager", "risk_owner", "auditor", "viewer"];
const CAN_INVITE = ["owner", "admin", "compliance_manager"];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { email, role = "viewer" } = await request.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return Response.json({ error: "Valid email required" }, { status: 400 });
  }

  const normalizedRole = role.toLowerCase().replace(/ /g, "_");
  if (!VALID_ROLES.includes(normalizedRole)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

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

  if (!CAN_INVITE.includes(me.role)) {
    return Response.json({ error: "Only admins can invite team members" }, { status: 403 });
  }

  // Check not already a member
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin as any)
    .from("users")
    .select("id")
    .eq("organization_id", me.organization_id)
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existing) {
    return Response.json({ error: "This person is already a team member" }, { status: 409 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fastgrc.ai";

  // Send invite via Supabase Auth — they'll receive an email with a magic link.
  // Their user_metadata carries the org + role so the callback can provision them.
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.toLowerCase(), {
    data: {
      invited_org_id: me.organization_id,
      invited_role: normalizedRole,
    },
    redirectTo: `${appUrl}/auth/invite-callback`,
  });

  if (inviteError) {
    console.error("[invite] Supabase invite error:", inviteError.message);
    // 422 usually means user already exists — Supabase will still send the link
    if (!inviteError.message.includes("already")) {
      return Response.json({ error: inviteError.message }, { status: 500 });
    }
  }

  // Store invite record so it appears in the pending list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("invites")
    .upsert(
      {
        organization_id: me.organization_id,
        email: email.toLowerCase(),
        role: normalizedRole,
        invited_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        accepted_at: null,
      },
      { onConflict: "organization_id,email" }
    );

  return Response.json({ success: true });
}
