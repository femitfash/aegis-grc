import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function GET() {
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
  if (!organizationId) return Response.json({ error: "No organization" }, { status: 400 });

  // Fetch org name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (admin as any)
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .single();

  // Fetch all risks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: risks, error: risksError } = await (admin as any)
    .from("risks")
    .select("*")
    .eq("organization_id", organizationId)
    .order("inherent_score", { ascending: false });

  if (risksError) {
    return Response.json({ error: risksError.message }, { status: 500 });
  }

  // Fetch risk-control mappings with control details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mappings } = await (admin as any)
    .from("risk_control_mappings")
    .select("risk_id, control_library(id, code, title, effectiveness_rating, status)")
    .in("risk_id", (risks || []).map((r: { id: string }) => r.id));

  // Build a map: riskId -> controls
  const controlsByRisk: Record<string, { code: string; title: string; effectiveness_rating: number; status: string }[]> = {};
  for (const m of mappings || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctrl = (m as any).control_library;
    if (ctrl) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const riskId = (m as any).risk_id;
      if (!controlsByRisk[riskId]) controlsByRisk[riskId] = [];
      controlsByRisk[riskId].push(ctrl);
    }
  }

  // Compute summary stats
  const riskList = risks || [];
  const computeScore = (r: { inherent_likelihood: number; inherent_impact: number }) =>
    (r.inherent_likelihood ?? 1) * (r.inherent_impact ?? 1);
  const residualScore = (r: { residual_likelihood?: number; residual_impact?: number; inherent_likelihood: number; inherent_impact: number }) =>
    (r.residual_likelihood ?? r.inherent_likelihood ?? 1) * (r.residual_impact ?? r.inherent_impact ?? 1);

  const scoreBand = (score: number) => {
    if (score >= 15) return "critical";
    if (score >= 10) return "high";
    if (score >= 5) return "medium";
    return "low";
  };

  const stats = {
    total: riskList.length,
    by_status: {
      identified: riskList.filter((r: { status: string }) => r.status === "identified").length,
      assessed: riskList.filter((r: { status: string }) => r.status === "assessed").length,
      mitigated: riskList.filter((r: { status: string }) => r.status === "mitigated").length,
      accepted: riskList.filter((r: { status: string }) => r.status === "accepted").length,
      closed: riskList.filter((r: { status: string }) => r.status === "closed").length,
    },
    by_score: {
      critical: riskList.filter((r: { inherent_likelihood: number; inherent_impact: number }) => scoreBand(computeScore(r)) === "critical").length,
      high: riskList.filter((r: { inherent_likelihood: number; inherent_impact: number }) => scoreBand(computeScore(r)) === "high").length,
      medium: riskList.filter((r: { inherent_likelihood: number; inherent_impact: number }) => scoreBand(computeScore(r)) === "medium").length,
      low: riskList.filter((r: { inherent_likelihood: number; inherent_impact: number }) => scoreBand(computeScore(r)) === "low").length,
    },
    avg_inherent_score:
      riskList.length > 0
        ? Math.round((riskList.reduce((a: number, r: { inherent_likelihood: number; inherent_impact: number }) => a + computeScore(r), 0) / riskList.length) * 10) / 10
        : 0,
    avg_residual_score:
      riskList.length > 0
        ? Math.round((riskList.reduce((a: number, r: { residual_likelihood?: number; residual_impact?: number; inherent_likelihood: number; inherent_impact: number }) => a + residualScore(r), 0) / riskList.length) * 10) / 10
        : 0,
    risks_with_controls: Object.keys(controlsByRisk).length,
    risks_without_controls: riskList.filter((r: { id: string }) => !controlsByRisk[r.id]?.length).length,
  };

  // Build enriched risk list
  const enrichedRisks = riskList.map((r: {
    id: string; risk_id?: string; title: string; description?: string;
    inherent_likelihood: number; inherent_impact: number;
    residual_likelihood?: number; residual_impact?: number;
    status: string; risk_response?: string; owner_id?: string;
    due_date?: string; created_at: string;
  }) => ({
    ...r,
    inherent_score: computeScore(r),
    residual_score: residualScore(r),
    score_band: scoreBand(computeScore(r)),
    controls: controlsByRisk[r.id] || [],
  }));

  return Response.json({
    organization_name: org?.name ?? "Your Organization",
    generated_at: new Date().toISOString(),
    stats,
    risks: enrichedRisks,
  });
}
