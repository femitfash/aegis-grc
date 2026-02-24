import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any).from("users").select("organization_id").eq("id", user.id).single();
  const organizationId = userData?.organization_id ?? null;
  if (!organizationId) return Response.json({ error: "No organization" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (admin as any).from("organizations").select("name").eq("id", organizationId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("incidents").select("*").eq("organization_id", organizationId).order("discovered_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const incidents = data || [];
  const OPEN_STATUSES = ["detected", "contained", "post_mortem"];

  type Incident = { severity: string; status: string; discovered_at: string; resolved_at?: string };

  // MTTR calculation (mean time to resolve, in hours)
  const resolved = incidents.filter((i: Incident) => i.resolved_at && i.discovered_at);
  const mttrHours = resolved.length > 0
    ? Math.round(resolved.reduce((a: number, i: Incident) => {
        const hours = (new Date(i.resolved_at!).getTime() - new Date(i.discovered_at).getTime()) / (1000 * 60 * 60);
        return a + hours;
      }, 0) / resolved.length)
    : null;

  const stats = {
    total: incidents.length,
    open: incidents.filter((i: Incident) => OPEN_STATUSES.includes(i.status)).length,
    resolved: incidents.filter((i: Incident) => i.status === "resolved" || i.status === "closed").length,
    by_severity: {
      critical: incidents.filter((i: Incident) => i.severity === "critical").length,
      high: incidents.filter((i: Incident) => i.severity === "high").length,
      medium: incidents.filter((i: Incident) => i.severity === "medium").length,
      low: incidents.filter((i: Incident) => i.severity === "low").length,
    },
    by_status: {
      detected: incidents.filter((i: Incident) => i.status === "detected").length,
      contained: incidents.filter((i: Incident) => i.status === "contained").length,
      resolved: incidents.filter((i: Incident) => i.status === "resolved").length,
      post_mortem: incidents.filter((i: Incident) => i.status === "post_mortem").length,
      closed: incidents.filter((i: Incident) => i.status === "closed").length,
    },
    mttr_hours: mttrHours,
    critical_open: incidents.filter((i: Incident) => i.severity === "critical" && OPEN_STATUSES.includes(i.status)).length,
  };

  // Open incidents sorted by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const openIncidents = incidents
    .filter((i: Incident) => OPEN_STATUSES.includes(i.status))
    .sort((a: Incident, b: Incident) => (severityOrder[a.severity as keyof typeof severityOrder] ?? 3) - (severityOrder[b.severity as keyof typeof severityOrder] ?? 3));

  // Recent resolved
  const recentResolved = incidents
    .filter((i: Incident) => i.status === "resolved" || i.status === "closed")
    .slice(0, 5);

  return Response.json({
    organization_name: org?.name ?? "Your Organization",
    generated_at: new Date().toISOString(),
    stats,
    open_incidents: openIncidents,
    recent_resolved: recentResolved,
    incidents,
  });
}
