import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

/**
 * POST /api/team/accept-invite
 *
 * Called client-side after a session is established via an invite link.
 * Reads invited_org_id / invited_role from the user's metadata and
 * provisions the user into the org, then marks the invite as accepted.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const meta = user.user_metadata ?? {};
  const orgId: string | undefined = meta.invited_org_id;
  const role: string = meta.invited_role ?? "viewer";

  if (!orgId) {
    // User might already be provisioned (e.g. re-used link) — not an error
    return Response.json({ success: true, note: "no invite metadata" });
  }

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("users").upsert(
    {
      id: user.id,
      organization_id: orgId,
      email: user.email ?? "",
      full_name: meta.full_name ?? meta.name ?? null,
      role,
    },
    { onConflict: "id" }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("email", (user.email ?? "").toLowerCase());

  return Response.json({ success: true });
}
