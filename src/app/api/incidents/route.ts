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
  if (!organizationId) return Response.json({ incidents: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("incidents")
    .select("*")
    .eq("organization_id", organizationId)
    .order("discovered_at", { ascending: false });

  if (error) return Response.json({ incidents: [], error: error.message });

  const incidents = data || [];
  const ownerIds = [...new Set(incidents.map((i: { owner_id?: string }) => i.owner_id).filter(Boolean))] as string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: owners } = ownerIds.length > 0 ? await (admin as any).from("users").select("id, full_name, email").in("id", ownerIds) : { data: [] };
  const ownerMap: Record<string, string> = Object.fromEntries((owners || []).map((u: { id: string; full_name?: string; email: string }) => [u.id, u.full_name || u.email]));

  return Response.json({ incidents: incidents.map((i: { owner_id?: string }) => ({ ...i, owner_name: ownerMap[i.owner_id ?? ""] ?? null })) });
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
  const { title, description = "", severity = "medium", discovered_at, impact = "", affected_systems = "", owner_id } = body;

  if (!title) return Response.json({ error: "title is required" }, { status: 400 });

  const incidentId = `INC-${Date.now().toString(36).toUpperCase()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("incidents")
    .insert({
      organization_id: organizationId,
      incident_id: incidentId,
      title,
      description,
      severity,
      status: "detected",
      discovered_at: discovered_at || new Date().toISOString(),
      impact,
      affected_systems,
      root_cause: "",
      owner_id: owner_id || user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("POST /api/incidents error:", JSON.stringify(error));
    return Response.json({ error: "Failed to create incident", detail: error.message }, { status: 500 });
  }

  void logAudit({ organizationId, userId: user.id, action: "incident.created", entityType: "incident", entityId: data.id, newValues: { title, severity, status: "detected" } });
  return Response.json({ success: true, incident: data }, { status: 201 });
}
