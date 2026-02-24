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
  if (!organizationId) return Response.json({ policies: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("policies")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ policies: [], error: error.message });

  const policies = data || [];

  // Batch-resolve owner names
  const ownerIds = [...new Set(policies.map((p: { owner_id?: string }) => p.owner_id).filter(Boolean))] as string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: owners } = ownerIds.length > 0 ? await (admin as any).from("users").select("id, full_name, email").in("id", ownerIds) : { data: [] };
  const ownerMap: Record<string, string> = Object.fromEntries((owners || []).map((u: { id: string; full_name?: string; email: string }) => [u.id, u.full_name || u.email]));

  return Response.json({ policies: policies.map((p: { owner_id?: string }) => ({ ...p, owner_name: ownerMap[p.owner_id ?? ""] ?? null })) });
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
  const { title, description = "", category = "General", version = "1.0", effective_date, review_date, attestation_required = false, owner_id } = body;

  if (!title) return Response.json({ error: "title is required" }, { status: 400 });

  const policyId = `POL-${Date.now().toString(36).toUpperCase()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("policies")
    .insert({
      organization_id: organizationId,
      policy_id: policyId,
      title,
      description,
      category,
      version,
      effective_date: effective_date || null,
      review_date: review_date || null,
      attestation_required,
      owner_id: owner_id || user.id,
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    console.error("POST /api/policies error:", JSON.stringify(error));
    return Response.json({ error: "Failed to create policy", detail: error.message }, { status: 500 });
  }

  void logAudit({ organizationId, userId: user.id, action: "policy.created", entityType: "policy", entityId: data.id, newValues: { title, category, status: "draft" } });
  return Response.json({ success: true, policy: data }, { status: 201 });
}
