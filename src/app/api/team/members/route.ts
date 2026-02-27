import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: me } = await (admin as any)
    .from("users")
    .select("id, organization_id, email, full_name, role, status, last_active_at, created_at")
    .eq("id", user.id)
    .single();

  // Auto-provision a free org for Builder-plan users who have no users row yet.
  // This happens when someone signs up without going through checkout.
  if (!me?.organization_id) {
    const orgName =
      user.user_metadata?.organization_name ??
      user.user_metadata?.full_name ??
      user.email?.split("@")[0] ??
      "My Organization";
    const orgSlug = `org-${user.id.slice(0, 8)}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newOrg } = await (admin as any)
      .from("organizations")
      .upsert({ name: orgName, slug: orgSlug, subscription_tier: "starter" }, { onConflict: "slug" })
      .select("id")
      .single();

    if (newOrg?.id) {
      const orgId = newOrg.id as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from("users").upsert(
        {
          id: user.id,
          organization_id: orgId,
          email: user.email ?? "",
          full_name: user.user_metadata?.full_name ?? null,
          role: "owner",
          status: "active",
        },
        { onConflict: "id" }
      );
      // Seed a builder subscription row
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("subscriptions")
        .upsert({ organization_id: orgId, plan: "builder", status: "active", seats_contributors: 1 }, { onConflict: "organization_id" });

      // Re-read me after provisioning
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: refreshed } = await (admin as any)
        .from("users")
        .select("id, organization_id, email, full_name, role, status, last_active_at, created_at")
        .eq("id", user.id)
        .single();
      me = refreshed;
    }
  }

  if (!me?.organization_id) {
    // Provisioning failed — return the current user as a single-member list
    return Response.json({
      members: [{
        id: user.id,
        email: user.email ?? "",
        full_name: user.user_metadata?.full_name ?? null,
        role: "owner",
        status: "active",
        last_active_at: null,
        created_at: new Date().toISOString(),
      }],
      invites: [],
      current_user_id: user.id,
    });
  }

  const [{ data: rawMembers }, { data: invites }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("users")
      .select("id, email, full_name, role, status, last_active_at, created_at")
      .eq("organization_id", me.organization_id)
      .order("created_at"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("invites")
      .select("id, email, role, created_at, expires_at, accepted_at")
      .eq("organization_id", me.organization_id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: any[] = rawMembers ?? [];

  // Always ensure the requesting user appears — guards against edge cases
  // where their row exists in DB but the query didn't return it.
  if (!members.some((m) => m.id === user.id)) {
    members.unshift({
      id: me.id,
      email: me.email ?? user.email ?? "",
      full_name: me.full_name ?? user.user_metadata?.full_name ?? null,
      role: me.role ?? "owner",
      status: me.status ?? "active",
      last_active_at: me.last_active_at ?? null,
      created_at: me.created_at ?? new Date().toISOString(),
    });
  }

  return Response.json({ members, invites: invites ?? [], current_user_id: user.id });
}
