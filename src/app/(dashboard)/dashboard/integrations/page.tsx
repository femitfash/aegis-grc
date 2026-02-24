"use client";

import { useState, useEffect, useCallback } from "react";

interface Integration {
  id: string;
  provider: string;
  name: string;
  status: "inactive" | "active" | "error";
  last_sync_at: string | null;
  last_sync_status: string | null;
  config: Record<string, string>;
}

interface ProviderConfig {
  id: string;
  label: string;
  icon: string;
  description: string;
  comingSoon?: boolean;
  fields: Array<{
    key: string;
    label: string;
    placeholder: string;
    type?: "text" | "password";
    hint?: string;
  }>;
  actions?: Array<{ key: string; label: string; icon: string }>;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "github",
    label: "GitHub",
    icon: "🐙",
    description: "Import Dependabot security alerts as risks automatically.",
    fields: [
      { key: "org", label: "Organization", placeholder: "my-org", hint: "Your GitHub org or username" },
      { key: "repo", label: "Repository (optional)", placeholder: "my-repo", hint: "Leave blank to scan all org repos" },
      { key: "token", label: "Personal Access Token", placeholder: "ghp_••••••••", type: "password", hint: "Needs security_events scope" },
    ],
    actions: [
      { key: "import_alerts", label: "Import Security Alerts", icon: "⬇️" },
    ],
  },
  {
    id: "jira",
    label: "Jira",
    icon: "🔵",
    description: "Create Jira tickets from risks and track remediation status.",
    fields: [
      { key: "host", label: "Jira Host", placeholder: "https://myorg.atlassian.net", hint: "Your Atlassian domain" },
      { key: "email", label: "Email", placeholder: "you@company.com" },
      { key: "token", label: "API Token", placeholder: "ATATT••••••••", type: "password", hint: "Create at id.atlassian.com/manage-profile/security/api-tokens" },
      { key: "project_key", label: "Project Key", placeholder: "SEC", hint: "The Jira project to create issues in" },
    ],
  },
  {
    id: "slack",
    label: "Slack",
    icon: "💬",
    description: "Send risk alerts and compliance notifications to Slack channels.",
    fields: [
      { key: "bot_token", label: "Bot Token", placeholder: "xoxb-••••••••", type: "password", hint: "Create a Slack App and add bot token scopes: chat:write" },
      { key: "channel", label: "Default Channel", placeholder: "#security-alerts", hint: "Channel ID or name for notifications" },
    ],
    actions: [
      { key: "notify", label: "Send Test Notification", icon: "🔔" },
    ],
  },
  {
    id: "aws",
    label: "AWS Security Hub",
    icon: "☁️",
    description: "Sync findings from AWS Security Hub, GuardDuty, and Config.",
    comingSoon: true,
    fields: [],
  },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    inactive: "bg-gray-100 text-gray-600",
    error: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    active: "Connected",
    inactive: "Not connected",
    error: "Error",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.inactive}`}>
      {labels[status] || status}
    </span>
  );
}

function formatRelative(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { type: "success" | "error"; text: string }>>({});

  const loadIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  function getIntegration(provider: string): Integration | undefined {
    return integrations.find((i) => i.provider === provider);
  }

  function setMsg(provider: string, type: "success" | "error", text: string) {
    setMessages((prev) => ({ ...prev, [provider]: { type, text } }));
    setTimeout(() => setMessages((prev) => { const n = { ...prev }; delete n[provider]; return n; }), 5000);
  }

  async function handleSave(provider: ProviderConfig) {
    const values = formValues[provider.id] || {};
    setSaving(provider.id);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, name: provider.label, config: values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg(provider.id, "success", "Integration saved successfully.");
      setExpandedProvider(null);
      await loadIntegrations();
    } catch (err) {
      setMsg(provider.id, "error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function handleTest(provider: string) {
    setTesting(provider);
    try {
      const res = await fetch(`/api/integrations/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Test failed");
      setMsg(provider, "success", data.message || "Connection successful!");
      await loadIntegrations();
    } catch (err) {
      setMsg(provider, "error", err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(null);
    }
  }

  async function handleAction(provider: string, action: string) {
    setSyncing(`${provider}:${action}`);
    try {
      const res = await fetch(`/api/integrations/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Action failed");
      setMsg(provider, "success", data.message || "Done!");
      await loadIntegrations();
      // Emit event so risk list refreshes
      if (action === "import_alerts") window.dispatchEvent(new CustomEvent("grc:risk-created"));
    } catch (err) {
      setMsg(provider, "error", err instanceof Error ? err.message : "Action failed");
    } finally {
      setSyncing(null);
    }
  }

  async function handleDisconnect(provider: string) {
    const integration = getIntegration(provider);
    if (!integration) return;
    try {
      const res = await fetch(`/api/integrations?id=${integration.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setMsg(provider, "success", "Integration disconnected.");
      await loadIntegrations();
    } catch (err) {
      setMsg(provider, "error", err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Connect your tools to automate evidence collection, import risks, and streamline workflows.
        </p>
      </div>

      {/* Copilot hint */}
      <div className="mb-6 p-4 rounded-xl border bg-primary/5 flex items-start gap-3">
        <span className="text-xl">🤖</span>
        <div>
          <p className="text-sm font-medium">Use the Copilot to manage integrations</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Try: <em>&quot;Connect GitHub to import our Dependabot alerts&quot;</em> or <em>&quot;Create a Jira ticket for RISK-001&quot;</em>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const existing = getIntegration(provider.id);
          const isExpanded = expandedProvider === provider.id;
          const msg = messages[provider.id];
          const values = formValues[provider.id] || {};

          return (
            <div key={provider.id} className="border rounded-xl bg-card overflow-hidden">
              {/* Header */}
              <div className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">
                  {provider.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{provider.label}</span>
                    {provider.comingSoon ? (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Coming soon</span>
                    ) : (
                      <StatusBadge status={existing?.status || "inactive"} />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{provider.description}</p>
                  {existing?.last_sync_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last sync: {formatRelative(existing.last_sync_at)}
                      {existing.last_sync_status === "error" && (
                        <span className="text-red-600 ml-1">· sync error</span>
                      )}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {!provider.comingSoon && (
                  <div className="flex items-center gap-2 shrink-0">
                    {existing && (
                      <>
                        <button
                          onClick={() => handleTest(provider.id)}
                          disabled={testing === provider.id}
                          className="text-xs px-3 py-1.5 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50"
                        >
                          {testing === provider.id ? "Testing..." : "Test"}
                        </button>
                        <button
                          onClick={() => handleDisconnect(provider.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Disconnect
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      {existing ? "Edit" : "Connect"}
                    </button>
                  </div>
                )}
              </div>

              {/* Feedback message */}
              {msg && (
                <div
                  className={`mx-5 mb-3 px-3 py-2 rounded-lg text-sm ${
                    msg.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {msg.type === "success" ? "✅" : "❌"} {msg.text}
                </div>
              )}

              {/* Quick actions for connected integrations */}
              {existing?.status === "active" && provider.actions && !isExpanded && (
                <div className="px-5 pb-4 flex gap-2">
                  {provider.actions.map((act) => (
                    <button
                      key={act.key}
                      onClick={() => handleAction(provider.id, act.key)}
                      disabled={syncing === `${provider.id}:${act.key}`}
                      className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-accent transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <span>{act.icon}</span>
                      {syncing === `${provider.id}:${act.key}` ? "Running..." : act.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Config form */}
              {isExpanded && (
                <div className="border-t px-5 py-4 bg-muted/30">
                  <div className="space-y-3">
                    {provider.fields.map((field) => (
                      <div key={field.key}>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {field.label}
                        </label>
                        <input
                          type={field.type || "text"}
                          value={values[field.key] || ""}
                          onChange={(e) =>
                            setFormValues((prev) => ({
                              ...prev,
                              [provider.id]: { ...prev[provider.id], [field.key]: e.target.value },
                            }))
                          }
                          placeholder={field.placeholder}
                          className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        {field.hint && (
                          <p className="text-xs text-muted-foreground mt-0.5">{field.hint}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleSave(provider)}
                      disabled={saving === provider.id}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {saving === provider.id ? "Saving..." : "Save & Connect"}
                    </button>
                    <button
                      onClick={() => setExpandedProvider(null)}
                      className="px-4 py-2 rounded-lg border text-sm hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
