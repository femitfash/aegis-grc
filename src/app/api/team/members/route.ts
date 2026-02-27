import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: me } = await (admin as any)
    .from("users")
    .select("id, organization_id, email, full_name, role, status, last_active_at, created_at")
    .eq("id", user.id)
    .single();

  if (!me?.organization_id) {
    return Response.json({ members: [], invites: [] });
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

  // Ensure the requesting user always appears (covers edge cases where the
  // checkout upsert set organization_id but the row wasn't returned by the
  // query, e.g. due to a timing issue or missing status column default).
  if (!members.some((m) => m.id === user.id)) {
    members.unshift({
      id: me.id,
      email: me.email ?? user.email ?? "",
      full_name: me.full_name ?? user.user_metadata?.full_name ?? null,
      role: me.role ?? "admin",
      status: me.status ?? "active",
      last_active_at: me.last_active_at ?? null,
      created_at: me.created_at ?? new Date().toISOString(),
    });
  }

  return Response.json({ members, invites: invites ?? [] });
}
