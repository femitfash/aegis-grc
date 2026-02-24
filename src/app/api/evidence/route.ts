import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { logAudit } from "@/shared/lib/audit";

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ evidence: [], error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any)
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  const organizationId = userData?.organization_id ?? null;
  if (!organizationId) return Response.json({ evidence: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("evidence")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return Response.json({ evidence: [], error: error.message });
  }

  return Response.json({ evidence: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any)
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  const organizationId = userData?.organization_id ?? null;
  if (!organizationId) return Response.json({ error: "No organization found" }, { status: 400 });

  const body = await request.json();
  const {
    title,
    description,
    source_type = "manual",
    source_url,
    control_code,
    frameworks = [],
    valid_to,
  } = body;

  if (!title) return Response.json({ error: "title is required" }, { status: 400 });

  // Generate a human-readable evidence ID
  const evidenceId = `EVD-${Date.now().toString(36).toUpperCase()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("evidence")
    .insert({
      organization_id: organizationId,
      evidence_id: evidenceId,
      title,
      description: description || "",
      source_type,
      // source_url and control_code are not schema columns — store in JSONB fields
      source_metadata: source_url ? { source_url } : {},
      metadata: {
        frameworks: Array.isArray(frameworks) ? frameworks : [],
        control_code: control_code || null,
      },
      created_by: user.id,
      collected_at: new Date().toISOString(),
      status: "pending",
      // valid_to tracks evidence expiry date (e.g. annual review, certificate expiry)
      valid_to: valid_to || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Create evidence error:", JSON.stringify(error));
    return Response.json({ error: "Failed to create evidence", detail: error.message }, { status: 500 });
  }

  void logAudit({ organizationId, userId: user.id, action: "evidence.created", entityType: "evidence", entityId: data.id, newValues: { title, source_type, valid_to: valid_to || null } });
  return Response.json({ success: true, result: data });
}
