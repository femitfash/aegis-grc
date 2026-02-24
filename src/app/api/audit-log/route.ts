import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ entries: [], error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any)
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  const organizationId = userData?.organization_id ?? null;
  if (!organizationId) return Response.json({ entries: [] });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
  const offset = Number(searchParams.get("offset") || 0);
  const entityType = searchParams.get("entity_type");
  const action = searchParams.get("action");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from("audit_log")
    .select(
      "id, sequence_number, action, entity_type, entity_id, user_id, old_values, new_values, entry_hash, previous_hash, created_at"
    )
    .eq("organization_id", organizationId)
    .order("sequence_number", { ascending: false })
    .range(offset, offset + limit - 1);

  if (entityType) query = query.eq("entity_type", entityType);
  if (action) query = query.eq("action", action);

  const { data, error, count } = await query;

  if (error) {
    return Response.json({ entries: [], error: error.message });
  }

  return Response.json({ entries: data || [], total: count ?? 0 });
}
