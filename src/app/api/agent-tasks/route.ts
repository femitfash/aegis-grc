import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: userData } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) return Response.json({ tasks: [] });

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agent_id");
    const statusFilter = searchParams.get("status");

    let query = admin
      .from("agent_tasks")
      .select("*, agent:agents(id, name)")
      .eq("organization_id", userData.organization_id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (agentId) query = query.eq("agent_id", agentId);
    if (statusFilter) query = query.eq("status", statusFilter);

    const { data, error } = await query;

    if (error) return Response.json({ tasks: [], error: error.message }, { status: 500 });

    return Response.json({ tasks: data ?? [] });
  } catch (err) {
    return Response.json({ tasks: [], error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
