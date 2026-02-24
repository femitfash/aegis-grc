import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

function buildBasicAuth(email: string, token: string): string {
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

/** Atlassian Document Format (ADF) plain text node */
function adfDoc(text: string): unknown {
  return {
    version: 1,
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
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
    .eq("provider", "jira")
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
    const { action, risk_id, summary, description, issue_type = "Task", priority = "Medium", integration_id } = body;

    const admin = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (admin as any)
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    const organizationId: string | null = userData?.organization_id ?? null;
    if (!organizationId) return Response.json({ error: "Organization not found" }, { status: 404 });

    const integration = await getIntegration(organizationId, admin);
    if (!integration) return Response.json({ error: "Jira integration not configured" }, { status: 404 });

    const cfg = integration.config as Record<string, string>;
    const jiraHost = (cfg.host || "").replace(/\/$/, "");
    const email = cfg.email;
    const token = cfg.token;
    const projectKey = cfg.project_key;

    if (!jiraHost || !email || !token || !projectKey) {
      return Response.json(
        { error: "Jira host, email, token, and project_key are required in config" },
        { status: 400 }
      );
    }

    const authHeader = buildBasicAuth(email, token);

    switch (action) {
      case "test": {
        const res = await fetch(`${jiraHost}/rest/api/3/myself`, {
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return Response.json(
            {
              success: false,
              error:
                (err as Record<string, string>).errorMessages?.[0] ||
                (err as Record<string, string>).message ||
                `Jira API ${res.status}`,
            },
            { status: 400 }
          );
        }
        const me = await res.json();
        // Mark active
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("integrations")
          .update({ status: "active" })
          .eq("id", integration_id || integration.id);

        return Response.json({
          success: true,
          message: `Connected as ${(me as Record<string, string>).displayName || email}`,
        });
      }

      case "create_issue": {
        if (!summary) return Response.json({ error: "summary is required" }, { status: 400 });

        const payload = {
          fields: {
            project: { key: projectKey },
            summary,
            description: adfDoc(description || summary),
            issuetype: { name: issue_type },
            priority: { name: priority },
          },
        };

        const res = await fetch(`${jiraHost}/rest/api/3/issue`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errMsg =
            (err as Record<string, string[]>).errors
              ? Object.values((err as Record<string, string[]>).errors).join(", ")
              : (err as Record<string, string>).message || `Jira API ${res.status}`;
          return Response.json({ success: false, error: errMsg }, { status: 400 });
        }

        const issue = await res.json() as { id: string; key: string; self: string };
        const issueUrl = `${jiraHost}/browse/${issue.key}`;

        // If a risk_id was provided, store the Jira issue key in risk.metadata
        if (risk_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: riskRow } = await (admin as any)
            .from("risks")
            .select("id, metadata")
            .eq("organization_id", organizationId)
            .or(`id.eq.${risk_id},risk_id.ilike.${risk_id}`)
            .single();

          if (riskRow) {
            const updatedMeta = {
              ...(riskRow.metadata || {}),
              jira_issue_key: issue.key,
              jira_issue_url: issueUrl,
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (admin as any)
              .from("risks")
              .update({ metadata: updatedMeta })
              .eq("id", riskRow.id);
          }
        }

        // Update last sync
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("integrations")
          .update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", status: "active" })
          .eq("id", integration_id || integration.id);

        return Response.json({
          success: true,
          issue_key: issue.key,
          issue_url: issueUrl,
          message: `Created Jira issue ${issue.key}`,
        });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("Jira integration error:", error);
    return Response.json({ error: "Integration request failed" }, { status: 500 });
  }
}
