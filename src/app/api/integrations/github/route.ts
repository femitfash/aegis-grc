import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

interface GitHubAlert {
  number: number;
  state: string;
  security_vulnerability?: {
    severity?: string;
    package?: { name?: string; ecosystem?: string };
    first_patched_version?: { identifier?: string } | null;
  };
  security_advisory?: {
    summary?: string;
    description?: string;
    cve_id?: string | null;
  };
  html_url?: string;
  auto_dismissed_at?: string | null;
}

function severityToScore(severity?: string): { likelihood: number; impact: number } {
  switch ((severity || "").toLowerCase()) {
    case "critical": return { likelihood: 5, impact: 5 };
    case "high":     return { likelihood: 4, impact: 4 };
    case "medium":   return { likelihood: 3, impact: 3 };
    case "low":      return { likelihood: 2, impact: 2 };
    default:         return { likelihood: 2, impact: 2 };
  }
}

async function getIntegration(
  orgId: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<{ id: string; config: Record<string, unknown> } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("integrations")
    .select("id, config")
    .eq("organization_id", orgId)
    .eq("provider", "github")
    .single();
  return data ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action, integration_id } = body;

    const admin = createAdminClient();

    // Get org id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (admin as any)
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    const organizationId: string | null = userData?.organization_id ?? null;
    if (!organizationId) return Response.json({ error: "Organization not found" }, { status: 404 });

    const integration = await getIntegration(organizationId, admin);
    if (!integration) return Response.json({ error: "GitHub integration not configured" }, { status: 404 });

    const cfg = integration.config as Record<string, string>;
    const token = cfg.token;
    const org = cfg.org;
    const repo = cfg.repo; // optional — if set, fetch single-repo alerts

    if (!token || !org) {
      return Response.json({ error: "GitHub token and org are required in config" }, { status: 400 });
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    switch (action) {
      case "test": {
        const url = repo
          ? `https://api.github.com/repos/${org}/${repo}`
          : `https://api.github.com/orgs/${org}`;
        const res = await fetch(url, { headers });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return Response.json(
            { success: false, error: (err as Record<string, string>).message || `GitHub API ${res.status}` },
            { status: 400 }
          );
        }
        const data = await res.json();
        // Mark integration as active
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("integrations")
          .update({ status: "active" })
          .eq("id", integration_id || integration.id);

        return Response.json({ success: true, message: `Connected to ${(data as Record<string, string>).login || org}` });
      }

      case "import_alerts": {
        // Fetch open Dependabot alerts
        const alertsUrl = repo
          ? `https://api.github.com/repos/${org}/${repo}/dependabot/alerts?state=open&per_page=50`
          : `https://api.github.com/orgs/${org}/dependabot/alerts?state=open&per_page=50`;

        const res = await fetch(alertsUrl, { headers });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return Response.json(
            { success: false, error: (err as Record<string, string>).message || `GitHub API ${res.status}` },
            { status: 400 }
          );
        }

        const alerts: GitHubAlert[] = await res.json();
        let created = 0;
        let skipped = 0;

        for (const alert of alerts) {
          if (alert.state !== "open") continue;
          if (alert.auto_dismissed_at) continue;

          const severity = alert.security_vulnerability?.severity;
          const { likelihood, impact } = severityToScore(severity);
          const pkg = alert.security_vulnerability?.package;
          const advisory = alert.security_advisory;
          const riskTitle = `[GitHub] ${advisory?.summary || `Vulnerability in ${pkg?.name || "dependency"}`}`;
          const riskId = `RISK-GH${alert.number}`;

          // Check for existing risk to avoid duplicates
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: existing } = await (admin as any)
            .from("risks")
            .select("id")
            .eq("organization_id", organizationId)
            .filter("metadata->>github_alert_number", "eq", String(alert.number))
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any).from("risks").insert({
            organization_id: organizationId,
            risk_id: riskId,
            title: riskTitle,
            description: advisory?.description || `Dependency vulnerability detected by GitHub Dependabot.\n\nPackage: ${pkg?.name || "unknown"} (${pkg?.ecosystem || "unknown"})\nCVE: ${advisory?.cve_id || "N/A"}\nSeverity: ${severity || "unknown"}`,
            category: "security",
            inherent_likelihood: likelihood,
            inherent_impact: impact,
            risk_response: "mitigate",
            status: "identified",
            owner_id: user.id,
            metadata: {
              github_alert_number: alert.number,
              github_alert_url: alert.html_url,
              severity,
              package_name: pkg?.name,
              package_ecosystem: pkg?.ecosystem,
              cve_id: advisory?.cve_id,
              patched_version: alert.security_vulnerability?.first_patched_version?.identifier || null,
            },
          });
          created++;
        }

        // Update last_sync_at
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("integrations")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: "success",
            status: "active",
          })
          .eq("id", integration_id || integration.id);

        return Response.json({
          success: true,
          created,
          skipped,
          total: alerts.length,
          message: `Imported ${created} new risks from GitHub (${skipped} already existed)`,
        });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("GitHub integration error:", error);
    return Response.json({ error: "Integration request failed" }, { status: 500 });
  }
}
