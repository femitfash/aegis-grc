import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { logAudit } from "@/shared/lib/audit";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any).from("users").select("organization_id").eq("id", user.id).single();
  const organizationId = userData?.organization_id ?? null;
  if (!organizationId) return Response.json({ vendors: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("vendors")
    .select("*")
    .eq("organization_id", organizationId)
    .order("risk_score", { ascending: false });

  if (error) return Response.json({ vendors: [], error: error.message });
  return Response.json({ vendors: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any).from("users").select("organization_id").eq("id", user.id).single();
  const organizationId = userData?.organization_id ?? null;
  if (!organizationId) return Response.json({ error: "No organization found" }, { status: 400 });

  const body = await request.json();
  const { name, category = "Technology", tier = "medium", contact_name = "", contact_email = "", website = "", contract_expiry, risk_score = 5, notes = "" } = body;

  if (!name) return Response.json({ error: "name is required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("vendors")
    .insert({
      organization_id: organizationId,
      name,
      category,
      tier,
      status: "active",
      contact_name,
      contact_email,
      website,
      contract_expiry: contract_expiry || null,
      risk_score: Math.min(25, Math.max(1, Number(risk_score) || 5)),
      notes,
      last_assessed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("POST /api/vendors error:", JSON.stringify(error));
    return Response.json({ error: "Failed to create vendor", detail: error.message }, { status: 500 });
  }

  void logAudit({ organizationId, userId: user.id, action: "vendor.created", entityType: "vendor", entityId: data.id, newValues: { name, tier, risk_score } });
  return Response.json({ success: true, vendor: data }, { status: 201 });
}
