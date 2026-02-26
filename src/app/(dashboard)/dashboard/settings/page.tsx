"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/shared/hooks/useTheme";
import { DISPLAY_PRICES } from "@/shared/lib/stripe";

type Tab = "organization" | "team" | "billing" | "integrations" | "notifications" | "security" | "appearance" | "ai";

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  last_active_at: string | null;
  created_at: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

interface Subscription {
  plan: string;
  billing_interval: string;
  status: string;
  seats_contributors: number;
  seats_readonly: number;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
}

const ROLES = ["Admin", "Compliance Manager", "Risk Owner", "Auditor", "Viewer"];

const INTEGRATIONS = [
  { id: "jira", name: "Jira", description: "Sync risks and controls as Jira issues", icon: "🔵", status: "connected", detail: "Connected to acme.atlassian.net" },
  { id: "slack", name: "Slack", description: "Get notifications and create items via Slack", icon: "💬", status: "connected", detail: "Connected to #grc-alerts" },
  { id: "github", name: "GitHub Actions", description: "Auto-collect evidence from CI/CD pipelines", icon: "⚙️", status: "available", detail: null },
  { id: "aws", name: "AWS Security Hub", description: "Import findings as risks automatically", icon: "☁️", status: "available", detail: null },
  { id: "azure", name: "Azure Defender", description: "Sync security alerts and compliance data", icon: "🔷", status: "available", detail: null },
  { id: "okta", name: "Okta", description: "Auto-collect access reviews and user activity", icon: "🔑", status: "available", detail: null },
];

function fmt(n: number) {
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}

function planLabel(plan: string, status: string) {
  if (status === "trialing") return "Growth (Trial)";
  if (plan === "growth") return "Growth";
  if (plan === "enterprise") return "Enterprise";
  return "Builder (Free)";
}

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("organization");
  const { theme, setTheme } = useTheme();

  // Read ?tab and ?upgraded from URL on first mount
  useEffect(() => {
    const validTabs: Tab[] = ["organization", "team", "billing", "integrations", "notifications", "security", "appearance", "ai"];
    const urlTab = searchParams.get("tab") as Tab | null;
    if (urlTab && validTabs.includes(urlTab)) setActiveTab(urlTab);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const justUpgraded = searchParams.get("upgraded") === "true";

  // Organization
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgIndustry, setOrgIndustry] = useState("Technology / SaaS");
  const [orgSize, setOrgSize] = useState("1-50 employees");
  const [orgLoading, setOrgLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Team
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  // Billing
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  // AI Copilot
  const [aiUsage, setAiUsage] = useState<{ write_count: number; has_custom_key: boolean; limit: number } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKeyError, setApiKeyError] = useState("");
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

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
    if (activeTab === "team") {
      setTeamLoading(true);
      fetch("/api/team/members")
        .then((r) => r.json())
        .then((data) => {
          setTeamMembers(data.members ?? []);
          setPendingInvites(data.invites ?? []);
        })
        .catch(() => {})
        .finally(() => setTeamLoading(false));
    }
    if (activeTab === "billing") {
      setBillingLoading(true);
      fetch("/api/billing/subscription")
        .then((r) => r.json())
        .then((data) => setSubscription(data.subscription))
        .catch(() => {})
        .finally(() => setBillingLoading(false));
    }
    if (activeTab === "ai") {
      fetch("/api/settings/copilot")
        .then((r) => r.json())
        .then(setAiUsage)
        .catch(() => {});
    }
  }, [activeTab]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setOrgLoading(true);
    setSaveError("");
    try {
      const res = await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName, slug: orgSlug, industry: orgIndustry, company_size: orgSize }),
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

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError("");
    setInviteSuccess("");
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invite");
      setInviteSuccess(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
      // Refresh invites list
      fetch("/api/team/members")
        .then((r) => r.json())
        .then((d) => { setTeamMembers(d.members ?? []); setPendingInvites(d.invites ?? []); })
        .catch(() => {});
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Billing portal unavailable");
    } catch {
      alert("Could not open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleUpgradeClick = async () => {
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributors: 2, readonly_users: 0, interval: "year" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Billing is not configured yet. Please contact support@fastgrc.ai.");
      }
    } catch {
      alert("Could not start checkout. Please try again or contact support@fastgrc.ai.");
    } finally {
      setUpgradeLoading(false);
    }
  };

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

  // ── Monthly cost calculation ────────────────────────────────────────────────
  const monthlyBillingCost = subscription
    ? (subscription.seats_contributors ?? 0) *
        (subscription.billing_interval === "year" ? DISPLAY_PRICES.contributor_annual : DISPLAY_PRICES.contributor_monthly) / 100 +
      (subscription.seats_readonly ?? 0) *
        (subscription.billing_interval === "year" ? DISPLAY_PRICES.readonly_annual : DISPLAY_PRICES.readonly_monthly) / 100
    : 0;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "organization", label: "Organization", icon: "🏢" },
    { id: "team", label: "Team", icon: "👥" },
    { id: "billing", label: "Billing", icon: "💳" },
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

          {/* ── Organization ─────────────────────────────────────────────── */}
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
                      <span className="text-sm text-muted-foreground">fastgrc.ai/</span>
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
                  {saveError && <p className="text-sm text-destructive">{saveError}</p>}
                  <button
                    onClick={handleSave}
                    disabled={orgLoading}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                      saved ? "bg-green-600 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {saved ? "✅ Saved!" : orgLoading ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Team ─────────────────────────────────────────────────────── */}
          {activeTab === "team" && (
            <div className="space-y-6">
              <div className="p-6 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">Team Members</h2>
                  <span className="text-sm text-muted-foreground">
                    {teamLoading ? "Loading…" : `${teamMembers.length} member${teamMembers.length !== 1 ? "s" : ""}`}
                    {pendingInvites.length > 0 && ` · ${pendingInvites.length} pending`}
                  </span>
                </div>

                {/* Invite form */}
                <div className="mb-4 p-3 rounded-md bg-muted/30 border border-dashed space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                      className="flex-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none"
                    >
                      {ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <button
                      onClick={handleInvite}
                      disabled={inviteLoading || !inviteEmail.trim()}
                      className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      {inviteLoading ? "Sending…" : "Send Invite"}
                    </button>
                  </div>
                  {inviteSuccess && <p className="text-xs text-green-600">✅ {inviteSuccess}</p>}
                  {inviteError && <p className="text-xs text-red-600">⚠ {inviteError}</p>}
                  <p className="text-xs text-muted-foreground">
                    Invite email sent from <span className="font-mono">support@fastgrc.ai</span> · expires in 7 days
                  </p>
                </div>

                {/* Team table */}
                {teamLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Member</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Role</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Last Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamMembers.map((member) => {
                          const initials = (member.full_name || member.email)
                            .split(" ")
                            .map((p) => p[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2);
                          const lastActive = member.last_active_at
                            ? new Date(member.last_active_at).toLocaleDateString()
                            : "Never";
                          return (
                            <tr key={member.id} className="border-t hover:bg-accent/20">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                                    {initials}
                                  </div>
                                  <div>
                                    <p className="font-medium">{member.full_name || "—"}</p>
                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded text-xs bg-secondary capitalize">
                                  {member.role.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{lastActive}</td>
                            </tr>
                          );
                        })}
                        {pendingInvites.map((invite) => (
                          <tr key={invite.id} className="border-t hover:bg-accent/20 opacity-70">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold">
                                  ?
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">{invite.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-xs bg-secondary capitalize">
                                {invite.role.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                Pending invite
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              Expires {new Date(invite.expires_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                        {teamMembers.length === 0 && pendingInvites.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                              No team members yet. Invite your first colleague above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Billing ──────────────────────────────────────────────────── */}
          {activeTab === "billing" && (
            <div className="space-y-6">
              {/* Success banner after upgrade or portal return */}
              {justUpgraded && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                  <span>✓</span>
                  <span><strong>You&apos;re on Growth!</strong> Your plan has been upgraded. Welcome aboard.</span>
                </div>
              )}

              {billingLoading ? (
                <div className="p-6 rounded-lg border bg-card">
                  <div className="h-5 w-32 bg-muted rounded animate-pulse mb-4" />
                  <div className="h-4 w-64 bg-muted rounded animate-pulse" />
                </div>
              ) : (
                <>
                  {/* Current plan — shown regardless of whether a DB subscription row exists */}
                  {(() => {
                    const plan = subscription?.plan ?? "builder";
                    const status = subscription?.status ?? "active";
                    const isFreePlan = plan === "builder";
                    const isGrowth = plan === "growth";
                    return (
                      <div className="p-6 rounded-lg border bg-card">
                        <div className="flex items-start justify-between mb-2">
                          <h2 className="font-semibold">Current Plan</h2>
                          {subscription?.stripe_customer_id && (
                            <button
                              onClick={handleManageBilling}
                              disabled={portalLoading}
                              className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors disabled:opacity-50"
                            >
                              {portalLoading ? "Opening…" : "Manage Billing →"}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                            isGrowth ? "bg-primary/10 text-primary" :
                            plan === "enterprise" ? "bg-purple-100 text-purple-700" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {planLabel(plan, status)}
                          </span>
                          {status === "past_due" && (
                            <span className="text-xs text-red-600 font-medium">⚠ Payment past due</span>
                          )}
                          {subscription?.cancel_at_period_end && (
                            <span className="text-xs text-yellow-600 font-medium">Cancels at period end</span>
                          )}
                        </div>

                        {isFreePlan && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium">Unlock unlimited AI + all frameworks</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Growth plan — from $39/contributor/mo (annual) · 14-day free trial · cancel anytime
                              </p>
                            </div>
                            <button
                              onClick={handleUpgradeClick}
                              disabled={upgradeLoading}
                              className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                              {upgradeLoading ? "Opening…" : "Upgrade to Growth →"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Seat summary — only for paid plans */}
                  {subscription && subscription.plan !== "builder" && (
                    <div className="p-6 rounded-lg border bg-card">
                      <h2 className="font-semibold mb-4">Seats &amp; Billing</h2>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Contributors</span>
                          <span className="font-medium">
                            {subscription.seats_contributors} ×{" "}
                            {fmt(subscription.billing_interval === "year"
                              ? DISPLAY_PRICES.contributor_annual / 100
                              : DISPLAY_PRICES.contributor_monthly / 100)}/mo
                          </span>
                        </div>
                        {subscription.seats_readonly > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Read-only users</span>
                            <span className="font-medium">
                              {subscription.seats_readonly} ×{" "}
                              {fmt(subscription.billing_interval === "year"
                                ? DISPLAY_PRICES.readonly_annual / 100
                                : DISPLAY_PRICES.readonly_monthly / 100)}/mo
                            </span>
                          </div>
                        )}
                        <div className="border-t pt-3 flex items-center justify-between font-semibold">
                          <span>Total</span>
                          <span>{fmt(monthlyBillingCost)}/mo
                            {subscription.billing_interval === "year" && (
                              <span className="text-xs font-normal text-muted-foreground ml-1">
                                ({fmt(monthlyBillingCost * 12)}/yr)
                              </span>
                            )}
                          </span>
                        </div>
                        {subscription.billing_interval === "year" && (
                          <p className="text-xs text-muted-foreground">Billed annually · ~20% savings vs monthly</p>
                        )}
                      </div>
                      <div className="mt-4 flex gap-2">
                        {subscription.stripe_customer_id && (
                          <button
                            onClick={handleManageBilling}
                            disabled={portalLoading}
                            className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors disabled:opacity-50"
                          >
                            {portalLoading ? "Opening…" : "Add / remove seats →"}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Seat changes are prorated immediately by Stripe.
                      </p>
                    </div>
                  )}

                  {/* Period info */}
                  {subscription?.current_period_end && (
                    <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                      {subscription.trial_end && new Date(subscription.trial_end) > new Date() ? (
                        <>Trial ends <strong>{new Date(subscription.trial_end).toLocaleDateString()}</strong> — no charge until then.</>
                      ) : (
                        <>Next billing date: <strong>{new Date(subscription.current_period_end).toLocaleDateString()}</strong></>
                      )}
                    </div>
                  )}

                  {/* Plan comparison — always visible */}
                  {(() => {
                    const plan = subscription?.plan ?? "builder";
                    const isFreePlan = plan === "builder";
                    return (
                      <div className="p-6 rounded-lg border bg-card">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="font-semibold">Compare Plans</h2>
                          <a href="/#pricing" target="_blank" className="text-xs text-primary hover:underline">
                            Full pricing ↗
                          </a>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left pb-2 font-medium text-muted-foreground w-1/2">Feature</th>
                                <th className="text-center pb-2 font-medium w-1/4">
                                  Builder<br /><span className="text-xs font-normal text-muted-foreground">Free forever</span>
                                </th>
                                <th className={`text-center pb-2 font-medium w-1/4 ${!isFreePlan ? "text-primary" : ""}`}>
                                  Growth<br /><span className="text-xs font-normal text-muted-foreground">$39/seat/mo</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {[
                                ["AI copilot sessions", "10 total", "Unlimited"],
                                ["Compliance frameworks", "3 (SOC 2, ISO, NIST)", "All frameworks + HIPAA"],
                                ["Contributor seats", "1", "Unlimited"],
                                ["Read-only users", "—", "Unlimited ($7.99/mo)"],
                                ["Slack / Jira / GitHub", "—", "✓"],
                                ["Audit-ready exports", "—", "✓"],
                                ["Custom frameworks", "—", "✓"],
                                ["Priority support", "—", "✓"],
                              ].map(([feature, builder, growth]) => (
                                <tr key={feature} className="hover:bg-muted/30">
                                  <td className="py-2 text-muted-foreground">{feature}</td>
                                  <td className={`py-2 text-center ${isFreePlan ? "font-medium" : "text-muted-foreground"}`}>{builder}</td>
                                  <td className={`py-2 text-center font-medium ${!isFreePlan ? "text-primary" : ""}`}>{growth}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {isFreePlan && (
                          <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">14-day free trial · Cancel anytime · No credit card required to start</p>
                            <button
                              onClick={handleUpgradeClick}
                              disabled={upgradeLoading}
                              className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                              {upgradeLoading ? "Opening…" : "Upgrade to Growth →"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* ── Integrations ─────────────────────────────────────────────── */}
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
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Connected</span>
                      ) : (
                        <button className="px-3 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Connect</button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Notifications ────────────────────────────────────────────── */}
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
                    <button className={`w-10 h-6 rounded-full transition-colors ${defaultOn ? "bg-primary" : "bg-muted"} relative`}>
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${defaultOn ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Security ─────────────────────────────────────────────────── */}
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
                      <p className="text-xs text-muted-foreground">Single sign-on with your identity provider · Enterprise only</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("billing")}
                      className="px-3 py-1.5 rounded-md text-xs border hover:bg-accent transition-colors"
                    >
                      Upgrade to Enterprise
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
                <a href="/dashboard/audit-log" className="text-sm text-primary hover:underline">
                  View full audit log →
                </a>
              </div>
            </div>
          )}

          {/* ── AI Copilot ───────────────────────────────────────────────── */}
          {activeTab === "ai" && (
            <div className="space-y-6">
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
                          <span><strong>{aiUsage.write_count}</strong> / {aiUsage.limit} free actions used</span>
                        )}
                      </span>
                      {!aiUsage.has_custom_key && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          aiUsage.write_count >= aiUsage.limit ? "bg-red-100 text-red-700" :
                          aiUsage.write_count >= aiUsage.limit * 0.7 ? "bg-yellow-100 text-yellow-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {aiUsage.write_count >= aiUsage.limit ? "Limit reached" : `${aiUsage.limit - aiUsage.write_count} remaining`}
                        </span>
                      )}
                    </div>
                    {!aiUsage.has_custom_key && (
                      <>
                        <div className="w-full bg-muted rounded-full h-2 mb-3">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              aiUsage.write_count >= aiUsage.limit ? "bg-red-500" :
                              aiUsage.write_count >= aiUsage.limit * 0.7 ? "bg-yellow-500" : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min((aiUsage.write_count / aiUsage.limit) * 100, 100)}%` }}
                          />
                        </div>
                        {aiUsage.write_count >= aiUsage.limit * 0.7 && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between gap-3">
                            <p className="text-xs text-muted-foreground">
                              {aiUsage.write_count >= aiUsage.limit
                                ? "You've hit the free limit. Upgrade for unlimited AI actions."
                                : `Almost at the limit. Upgrade to Growth for unlimited AI.`}
                            </p>
                            <button
                              onClick={handleUpgradeClick}
                              className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                              Upgrade →
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="h-4 bg-muted rounded animate-pulse w-48" />
                )}
              </div>

              <div className="p-6 rounded-lg border bg-card">
                <h2 className="font-semibold mb-1">Your AI API Key</h2>
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
                      apiKeySaved ? "bg-green-600 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {apiKeySaved ? "✅ Saved!" : apiKeyLoading ? "Saving..." : "Save Key"}
                  </button>
                  {aiUsage?.has_custom_key && (
                    <button
                      disabled={apiKeyLoading}
                      className="px-4 py-2 rounded-md text-sm border text-red-600 border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
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

          {/* ── Appearance ───────────────────────────────────────────────── */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div className="p-6 rounded-lg border bg-card">
                <h2 className="font-semibold mb-1">Theme</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose how FastGRC looks to you.
                </p>
                <div className="flex gap-3">
                  {([
                    { value: "light", label: "Light", icon: "☀️", description: "Always light" },
                    { value: "dark", label: "Dark", icon: "🌙", description: "Always dark" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      className={`flex-1 flex flex-col items-center gap-2 px-4 py-5 rounded-lg border-2 transition-colors ${
                        theme === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/50"
                      }`}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                      {theme === opt.value && <span className="text-xs text-primary font-medium">Active</span>}
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

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}
