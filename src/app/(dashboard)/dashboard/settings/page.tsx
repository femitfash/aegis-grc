"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/shared/hooks/useTheme";

type Tab = "organization" | "team" | "integrations" | "notifications" | "security" | "appearance" | "ai";

const TEAM_MEMBERS = [
  { id: "1", name: "Alice Chen", email: "alice@example.com", role: "Compliance Manager", status: "active", lastActive: "2 hours ago", avatar: "AC" },
  { id: "2", name: "Bob Smith", email: "bob@example.com", role: "Risk Owner", status: "active", lastActive: "1 day ago", avatar: "BS" },
  { id: "3", name: "Carlos Rivera", email: "carlos@example.com", role: "Risk Owner", status: "active", lastActive: "3 hours ago", avatar: "CR" },
  { id: "4", name: "Diana Lee", email: "diana@example.com", role: "Compliance Manager", status: "active", lastActive: "5 hours ago", avatar: "DL" },
  { id: "5", name: "Eve Johnson", email: "eve@example.com", role: "Viewer", status: "pending", lastActive: "Never", avatar: "EJ" },
];

const ROLES = ["Admin", "Compliance Manager", "Risk Owner", "Auditor", "Viewer"];

const INTEGRATIONS = [
  { id: "jira", name: "Jira", description: "Sync risks and controls as Jira issues", icon: "🔵", status: "connected", detail: "Connected to acme.atlassian.net" },
  { id: "slack", name: "Slack", description: "Get notifications and create items via Slack", icon: "💬", status: "connected", detail: "Connected to #grc-alerts" },
  { id: "github", name: "GitHub Actions", description: "Auto-collect evidence from CI/CD pipelines", icon: "⚙️", status: "available", detail: null },
  { id: "aws", name: "AWS Security Hub", description: "Import findings as risks automatically", icon: "☁️", status: "available", detail: null },
  { id: "azure", name: "Azure Defender", description: "Sync security alerts and compliance data", icon: "🔷", status: "available", detail: null },
  { id: "okta", name: "Okta", description: "Auto-collect access reviews and user activity", icon: "🔑", status: "available", detail: null },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("organization");
  const { theme, setTheme } = useTheme();
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgIndustry, setOrgIndustry] = useState("Technology / SaaS");
  const [orgSize, setOrgSize] = useState("1-50 employees");
  const [orgLoading, setOrgLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");

  // AI Copilot settings
  const [aiUsage, setAiUsage] = useState<{ write_count: number; has_custom_key: boolean; limit: number } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKeyError, setApiKeyError] = useState("");
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  // Load organization details when the org tab is first shown
  useEffect(() => {
    if (activeTab === "organization") {
      fetch("/api/settings/organization")
        .then((r) => r.json())
        .then((data) => {
          if (data.organization) {
            setOrgName(data.organization.name || "");
            setOrgSlug(data.organization.slug || "");
            setOrgIndustry(data.organization.industry || "Technology / SaaS");
            setOrgSize(data.organization.company_size || "1-50 employees");
          }
        })
        .catch(() => {});
    }
    if (activeTab === "ai") {
      fetch("/api/settings/copilot")
        .then((r) => r.json())
        .then(setAiUsage)
        .catch(() => {});
    }
  }, [activeTab]);

  const handleSaveApiKey = async () => {
    setApiKeyLoading(true);
    setApiKeyError("");
    try {
      const res = await fetch("/api/settings/copilot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setAiUsage((prev) => prev ? { ...prev, has_custom_key: data.has_custom_key } : null);
      setApiKey("");
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 3000);
    } catch (err) {
      setApiKeyError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleSave = async () => {
    setOrgLoading(true);
    setSaveError("");
    try {
      const res = await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName,
          slug: orgSlug,
          industry: orgIndustry,
          company_size: orgSize,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setOrgLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "organization", label: "Organization", icon: "🏢" },
    { id: "team", label: "Team", icon: "👥" },
    { id: "integrations", label: "Integrations", icon: "🔗" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
    { id: "security", label: "Security", icon: "🔒" },
    { id: "appearance", label: "Appearance", icon: "🎨" },
    { id: "ai", label: "AI Copilot", icon: "🤖" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your organization and platform preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Tab sidebar */}
        <div className="w-48 shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="flex-1">
          {activeTab === "organization" && (
            <div className="space-y-6">
              <div className="p-6 rounded-lg border bg-card">
                <h2 className="font-semibold mb-4">Organization Details</h2>
                <div className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-sm font-medium mb-1">Organization Name</label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Slug</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">aegis.app/</span>
                      <input
                        type="text"
                        value={orgSlug}
                        onChange={(e) => setOrgSlug(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Industry</label>
                    <select
                      value={orgIndustry}
                      onChange={(e) => setOrgIndustry(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option>Technology / SaaS</option>
                      <option>Financial Services</option>
                      <option>Healthcare</option>
                      <option>Retail / E-commerce</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Company Size</label>
                    <select
                      value={orgSize}
                      onChange={(e) => setOrgSize(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option>1-50 employees</option>
                      <option>51-200 employees</option>
                      <option>201-1000 employees</option>
                      <option>1000+ employees</option>
                    </select>
                  </div>
                  {saveError && (
                    <p className="text-sm text-destructive">{saveError}</p>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={orgLoading}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                      saved
                        ? "bg-green-600 text-white"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {saved ? "✅ Saved!" : orgLoading ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>

              <div className="p-6 rounded-lg border bg-card">
                <h2 className="font-semibold mb-2">Subscription</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                      Pro Plan
                    </span>
                    <p className="text-sm text-muted-foreground mt-2">
                      Unlimited risks, controls, and evidence · 10 team members · All frameworks
                    </p>
                  </div>
                  <button className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors">
                    Manage Billing
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "team" && (
            <div className="space-y-6">
              <div className="p-6 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">Team Members</h2>
                  <span className="text-sm text-muted-foreground">{TEAM_MEMBERS.length} members</span>
                </div>

                {/* Invite form */}
                <div className="flex gap-2 mb-4 p-3 rounded-md bg-muted/30 border border-dashed">
                  <input
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none"
                  >
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap">
                    Send Invite
                  </button>
                </div>

                {/* Team table */}
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Member</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Role</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Last Active</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {TEAM_MEMBERS.map((member) => (
                        <tr key={member.id} className="border-t hover:bg-accent/20">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                                {member.avatar}
                              </div>
                              <div>
                                <p className="font-medium">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-xs bg-secondary">{member.role}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              member.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {member.status === "active" ? "Active" : "Pending invite"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{member.lastActive}</td>
                          <td className="px-4 py-3">
                            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
                <p className="text-sm text-primary">
                  <strong>Pro tip:</strong> Integrations automatically collect evidence and sync risk data, reducing manual effort by up to 70%.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {INTEGRATIONS.map((integration) => (
                  <div key={integration.id} className="p-5 rounded-lg border bg-card hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{integration.icon}</span>
                        <div>
                          <h3 className="font-semibold">{integration.name}</h3>
                          {integration.detail && (
                            <p className="text-xs text-green-600">{integration.detail}</p>
                          )}
                        </div>
                      </div>
                      {integration.status === "connected" ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">
                          Connected
                        </span>
                      ) : (
                        <button className="px-3 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                          Connect
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="p-6 rounded-lg border bg-card">
              <h2 className="font-semibold mb-4">Notification Preferences</h2>
              <div className="space-y-4 max-w-lg">
                {[
                  { label: "New risk registered", description: "When a risk is created in your org", defaultOn: true },
                  { label: "Risk score changes", description: "When a risk score increases or decreases", defaultOn: true },
                  { label: "Evidence overdue", description: "24 hours before evidence due date", defaultOn: true },
                  { label: "Compliance gap detected", description: "When a new framework gap is found", defaultOn: true },
                  { label: "Copilot actions approved/rejected", description: "When team members act on copilot suggestions", defaultOn: false },
                  { label: "Weekly digest", description: "Weekly summary of your GRC posture", defaultOn: true },
                ].map(({ label, description, defaultOn }) => (
                  <div key={label} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <button
                      className={`w-10 h-6 rounded-full transition-colors ${
                        defaultOn ? "bg-primary" : "bg-muted"
                      } relative`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                          defaultOn ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="p-6 rounded-lg border bg-card">
                <h2 className="font-semibold mb-4">Authentication</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Multi-Factor Authentication</p>
                      <p className="text-xs text-muted-foreground">Require MFA for all team members</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Enabled</span>
                      <button className="text-xs text-muted-foreground hover:text-foreground">Configure</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <p className="font-medium text-sm">SSO / SAML</p>
                      <p className="text-xs text-muted-foreground">Single sign-on with your identity provider</p>
                    </div>
                    <button className="px-3 py-1.5 rounded-md text-xs border hover:bg-accent transition-colors">
                      Configure SSO
                    </button>
                  </div>
                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <p className="font-medium text-sm">Session Timeout</p>
                      <p className="text-xs text-muted-foreground">Automatically log out idle sessions</p>
                    </div>
                    <select className="px-2 py-1 rounded-md border bg-background text-xs focus:outline-none">
                      <option>4 hours</option>
                      <option>8 hours</option>
                      <option>24 hours</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-lg border bg-card">
                <h2 className="font-semibold mb-4">Audit Log</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  All actions are recorded in an immutable audit log with cryptographic hash chain verification.
                </p>
                <div className="space-y-2">
                  {[
                    { action: "Risk created", user: "Alice Chen", time: "2 hours ago", detail: "RISK-012: S3 Public Access" },
                    { action: "Evidence uploaded", user: "Bob Smith", time: "5 hours ago", detail: "EVD-012: Q4 Access Review" },
                    { action: "Control status updated", user: "Carlos Rivera", time: "1 day ago", detail: "RA-05: Testing → Implemented" },
                    { action: "User invited", user: "Alice Chen", time: "2 days ago", detail: "eve@example.com as Viewer" },
                  ].map((log, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs py-2 border-b last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="font-medium w-36">{log.action}</span>
                      <span className="text-muted-foreground w-24">{log.user}</span>
                      <span className="text-muted-foreground flex-1">{log.detail}</span>
                      <span className="text-muted-foreground">{log.time}</span>
                    </div>
                  ))}
                </div>
                <button className="mt-3 text-sm text-primary hover:underline">
                  View full audit log →
                </button>
              </div>
            </div>
          )}
          {activeTab === "ai" && (
            <div className="space-y-6">
              {/* Usage meter */}
              <div className="p-6 rounded-lg border bg-card">
                <h2 className="font-semibold mb-1">Free Usage</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Each approved copilot action (create risk, control, framework, or requirement) counts toward your free allowance.
                </p>
                {aiUsage ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {aiUsage.has_custom_key ? (
                          <span className="text-green-600">✅ Unlimited — using your API key</span>
                        ) : (
                          <span>
                            <strong>{aiUsage.write_count}</strong> / {aiUsage.limit} free actions used
                          </span>
                        )}
                      </span>
                      {!aiUsage.has_custom_key && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          aiUsage.write_count >= aiUsage.limit
                            ? "bg-red-100 text-red-700"
                            : aiUsage.write_count >= aiUsage.limit * 0.7
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {aiUsage.write_count >= aiUsage.limit ? "Limit reached" :
                            `${aiUsage.limit - aiUsage.write_count} remaining`}
                        </span>
                      )}
                    </div>
                    {!aiUsage.has_custom_key && (
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            aiUsage.write_count >= aiUsage.limit ? "bg-red-500" :
                            aiUsage.write_count >= aiUsage.limit * 0.7 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min((aiUsage.write_count / aiUsage.limit) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-4 bg-muted rounded animate-pulse w-48" />
                )}
              </div>

              {/* API Key */}
              <div className="p-6 rounded-lg border bg-card">
                <h2 className="font-semibold mb-1">Your Anthropic API Key</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your own key from{" "}
                  <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    console.anthropic.com
                  </a>{" "}
                  to unlock unlimited AI actions. Your key is stored securely and never shared.
                </p>

                {aiUsage?.has_custom_key && (
                  <div className="flex items-center gap-2 mb-4 p-3 rounded-md bg-green-50 border border-green-200">
                    <span className="text-green-600 text-sm font-medium">✅ Custom API key is configured — unlimited usage enabled</span>
                  </div>
                )}

                {apiKeyError && (
                  <p className="text-sm text-red-600 mb-3 p-2 bg-red-50 rounded">{apiKeyError}</p>
                )}

                <div className="flex gap-2 max-w-lg">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={aiUsage?.has_custom_key ? "Enter new key to replace existing" : "sk-ant-..."}
                    className="flex-1 px-3 py-2 rounded-md border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    disabled={apiKeyLoading || !apiKey.trim()}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                      apiKeySaved
                        ? "bg-green-600 text-white"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {apiKeySaved ? "✅ Saved!" : apiKeyLoading ? "Saving..." : "Save Key"}
                  </button>
                  {aiUsage?.has_custom_key && (
                    <button
                      disabled={apiKeyLoading}
                      className="px-4 py-2 rounded-md text-sm border text-red-600 border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Remove API key (revert to free tier)"
                      onClick={() => {
                        setApiKey("");
                        fetch("/api/settings/copilot", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ api_key: "" }),
                        }).then(() => setAiUsage((p) => p ? { ...p, has_custom_key: false } : null));
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Your key is only used for requests from your organization and is not logged.
                </p>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div className="p-6 rounded-lg border bg-card">
                <h2 className="font-semibold mb-1">Theme</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose how Aegis looks to you. System will match your OS preference.
                </p>
                <div className="flex gap-3">
                  {([
                    { value: "light", label: "Light", icon: "☀️", description: "Always light" },
                    { value: "system", label: "System", icon: "💻", description: "Match OS setting" },
                    { value: "dark", label: "Dark", icon: "🌙", description: "Always dark" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      className={`flex-1 flex flex-col items-center gap-2 px-4 py-5 rounded-lg border-2 transition-colors ${
                        theme === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-accent/50"
                      }`}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                      {theme === opt.value && (
                        <span className="text-xs text-primary font-medium">Active</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
