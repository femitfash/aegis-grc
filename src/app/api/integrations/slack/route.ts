import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

async function getIntegration(
  orgId: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<{ id: string; config: Record<string, unknown> } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("integrations")
    .select("id, config")
    .eq("organization_id", orgId)
    .eq("provider", "slack")
    .single();
  return data ?? null;
}

async function postSlackMessage(
  botToken: string,
  channel: string,
  text: string,
  blocks?: unknown[]
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text, blocks }),
  });
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action, message, risk_title, risk_id, severity, channel: channelOverride, integration_id } = body;

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
    if (!integration) return Response.json({ error: "Slack integration not configured" }, { status: 404 });

    const cfg = integration.config as Record<string, string>;
    const botToken = cfg.bot_token;
    const defaultChannel = cfg.channel;

    if (!botToken || !defaultChannel) {
      return Response.json(
        { error: "Slack bot_token and channel are required in config" },
        { status: 400 }
      );
    }

    const targetChannel = channelOverride || defaultChannel;

    switch (action) {
      case "test": {
        const result = await postSlackMessage(
          botToken,
          targetChannel,
          "✅ Aegis GRC is connected! This is a test message from your GRC Copilot."
        );
        if (!result.ok) {
          return Response.json(
            { success: false, error: result.error || "Slack API error" },
            { status: 400 }
          );
        }
        // Mark active
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("integrations")
          .update({ status: "active" })
          .eq("id", integration_id || integration.id);

        return Response.json({ success: true, message: `Test message sent to ${targetChannel}` });
      }

      case "notify": {
        const notifyText = message || (risk_title ? `🚨 New risk flagged: *${risk_title}*` : "GRC notification from Aegis");

        const severityColor =
          severity === "critical" || severity === "high" ? "#e53e3e"
          : severity === "medium" ? "#ed8936"
          : "#38a169";

        const blocks = risk_title
          ? [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*🛡️ Aegis GRC Alert*\n\n${notifyText}`,
                },
              },
              ...(risk_id
                ? [
                    {
                      type: "context",
                      elements: [
                        {
                          type: "mrkdwn",
                          text: `Risk ID: \`${risk_id}\` | Severity: ${severity || "unset"}`,
                        },
                      ],
                    },
                  ]
                : []),
              {
                type: "divider",
              },
            ]
          : undefined;

        const result = await postSlackMessage(
          botToken,
          targetChannel,
          notifyText,
          blocks
        );

        if (!result.ok) {
          return Response.json(
            { success: false, error: result.error || "Slack API error" },
            { status: 400 }
          );
        }

        // Update last sync
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("integrations")
          .update({ last_sync_at: new Date().toISOString(), last_sync_status: "success", status: "active" })
          .eq("id", integration_id || integration.id);

        void severityColor;
        return Response.json({ success: true, message: `Notification sent to ${targetChannel}` });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("Slack integration error:", error);
    return Response.json({ error: "Integration request failed" }, { status: 500 });
  }
}
