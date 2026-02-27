import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

/**
 * POST /api/team/accept-invite
 *
 * Called client-side after a session is established via an invite link.
 * Reads invited_org_id / invited_role from user_metadata (new users) OR
 * falls back to the invites table by email (existing Supabase users, where
 * inviteUserByEmail does NOT update pre-existing user_metadata).
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const meta = user.user_metadata ?? {};

  let orgId: string | undefined = meta.invited_org_id;
  let role: string = meta.invited_role ?? "viewer";

  // Fallback: look up the pending invite by email.
  // Required for existing Supabase users — inviteUserByEmail does not
  // overwrite user_metadata on accounts that already exist.
  if (!orgId && user.email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invite } = await (admin as any)
      .from("invites")
      .select("organization_id, role")
      .eq("email", user.email.toLowerCase())
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invite) {
      orgId = invite.organization_id;
      role = invite.role ?? "viewer";
    }
  }

  if (!orgId) {
    // Already provisioned or no pending invite found — not an error
    return Response.json({ success: true, note: "no invite metadata" });
  }

  // Upsert user into the org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("users").upsert(
    {
      id: user.id,
      organization_id: orgId,
      email: user.email ?? "",
      full_name: meta.full_name ?? meta.name ?? null,
      role,
      status: "active",
    },
    { onConflict: "id" }
  );

  // Mark invite as accepted
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("email", (user.email ?? "").toLowerCase());

  return Response.json({ success: true });
}
