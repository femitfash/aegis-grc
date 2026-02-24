import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

// Statuses that count as fully implemented
const IMPLEMENTED = ["implemented"];
const IN_PROGRESS = ["partial", "in-progress", "in_progress"];

function classifyStatus(status: string | undefined): "implemented" | "in_progress" | "not_started" | "not_applicable" {
  if (!status || status === "not-started" || status === "not_started") return "not_started";
  if (status === "not-applicable" || status === "not_applicable" || status === "n/a") return "not_applicable";
  if (IMPLEMENTED.includes(status)) return "implemented";
  if (IN_PROGRESS.includes(status)) return "in_progress";
  return "not_started";
}

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

  // Fetch org name + settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (admin as any)
    .from("organizations")
    .select("name, settings")
    .eq("id", organizationId)
    .single();

  const requirementStatuses: Record<string, string> = org?.settings?.requirement_statuses || {};

  // Fetch all active frameworks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: frameworks } = await (supabase as any)
    .from("compliance_frameworks")
    .select("id, code, name, version, structure")
    .eq("is_active", true)
    .order("name");

  // Fetch evidence
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: evidence } = await (admin as any)
    .from("evidence")
    .select("id, title, status, valid_to, metadata, collected_at")
    .eq("organization_id", organizationId);

  const evidenceList = evidence || [];
  const now = new Date();

  const evidenceStats = {
    total: evidenceList.length,
    validated: evidenceList.filter((e: { status: string }) => e.status === "validated").length,
    pending: evidenceList.filter((e: { status: string }) => e.status === "pending").length,
    expired: evidenceList.filter((e: { valid_to?: string }) => e.valid_to && new Date(e.valid_to) < now).length,
    expiring_soon: evidenceList.filter((e: { valid_to?: string }) => {
      if (!e.valid_to) return false;
      const d = new Date(e.valid_to);
      return d >= now && d <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }).length,
  };

  // Build per-framework compliance status
  const frameworkReports = (frameworks || []).map((fw: {
    id: string; code: string; name: string; version?: string;
    structure?: { domains?: { name: string; requirements: { id: string; code: string; title: string }[] }[] };
  }) => {
    const domains = fw.structure?.domains || [];
    const allRequirements: { id: string; code: string; title: string; domain: string }[] = [];
    for (const domain of domains) {
      for (const req of domain.requirements || []) {
        allRequirements.push({ ...req, domain: domain.name });
      }
    }

    // Map statuses
    const reqWithStatus = allRequirements.map((req) => {
      const statusKey = `${fw.code}:${req.id}`;
      const rawStatus = requirementStatuses[statusKey];
      const status = classifyStatus(rawStatus);
      return { ...req, status };
    });

    const total = reqWithStatus.length;
    const implemented = reqWithStatus.filter((r) => r.status === "implemented").length;
    const in_progress = reqWithStatus.filter((r) => r.status === "in_progress").length;
    const not_applicable = reqWithStatus.filter((r) => r.status === "not_applicable").length;
    const not_started = total - implemented - in_progress - not_applicable;
    const applicable = total - not_applicable;
    const progress = applicable > 0 ? Math.round((implemented / applicable) * 100) : 0;

    // Group by domain for breakdown
    const byDomain = domains.map((domain) => {
      const domainReqs = reqWithStatus.filter((r) => r.domain === domain.name);
      const dImplemented = domainReqs.filter((r) => r.status === "implemented").length;
      const dApplicable = domainReqs.filter((r) => r.status !== "not_applicable").length;
      return {
        name: domain.name,
        total: domainReqs.length,
        implemented: dImplemented,
        progress: dApplicable > 0 ? Math.round((dImplemented / dApplicable) * 100) : 0,
      };
    });

    // Gaps: not_started requirements
    const gaps = reqWithStatus
      .filter((r) => r.status === "not_started")
      .map((r) => ({ code: r.code, title: r.title, domain: r.domain }))
      .slice(0, 20); // top 20 gaps

    return {
      code: fw.code,
      name: fw.name,
      version: fw.version,
      total_requirements: total,
      implemented,
      in_progress,
      not_applicable,
      not_started,
      progress,
      by_domain: byDomain,
      gaps,
    };
  });

  // Overall compliance score (weighted average across frameworks)
  const overallScore =
    frameworkReports.length > 0
      ? Math.round(frameworkReports.reduce((a: number, f: { progress: number }) => a + f.progress, 0) / frameworkReports.length)
      : 0;

  return Response.json({
    organization_name: org?.name ?? "Your Organization",
    generated_at: new Date().toISOString(),
    overall_score: overallScore,
    frameworks: frameworkReports,
    evidence: evidenceStats,
  });
}
