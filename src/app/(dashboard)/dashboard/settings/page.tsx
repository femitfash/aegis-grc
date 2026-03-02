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
  status: string; // active | suspended
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

const ROLES = ["Owner", "Admin", "Compliance Manager", "Risk Owner", "Auditor", "Viewer"];

interface ConfirmDialog {
  open: boolean;
  title: string;
  message: string;
  irreversible: boolean;
  confirmLabel: string;
  variant: "danger" | "warning";
  onConfirm: () => void;
}

const CLOSED_DIALOG: ConfirmDialog = {
  open: false,
  title: "",
  message: "",
  irreversible: false,
  confirmLabel: "Confirm",
  variant: "danger",
  onConfirm: () => {},
};

interface DbIntegration {
  id: string;
  provider: string;
  name: string;
  status: string;
  last_sync_at: string | null;
  config: Record<string, string>;
}

interface ProviderMeta {
  id: string;
  name: string;
  icon: string;
  description: string;
  comingSoon?: boolean;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
}

const PROVIDER_META: ProviderMeta[] = [
  {
    id: "jira",
    name: "Jira",
    icon: "🔵",
    description: "Sync risks and controls as Jira issues",
    fields: [
      { key: "host", label: "Jira URL", placeholder: "https://yourcompany.atlassian.net" },
      { key: "email", label: "Atlassian Account Email", placeholder: "you@company.com" },
      { key: "token", label: "API Token", placeholder: "Atlassian API token", type: "password" },
      { key: "project_key", label: "Project Key", placeholder: "e.g. PROJ" },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    icon: "💬",
    description: "Get notifications and create items via Slack",
    fields: [
      { key: "bot_token", label: "Bot Token", placeholder: "xoxb-...", type: "password" },
      { key: "channel", label: "Default Channel", placeholder: "#grc-alerts" },
    ],
  },
  {
    id: "github",
    name: "GitHub Actions",
    icon: "⚙️",
    description: "Auto-collect evidence from CI/CD pipelines",
    fields: [
      { key: "token", label: "Personal Access Token", placeholder: "ghp_...", type: "password" },
      { key: "org", label: "GitHub Organization", placeholder: "my-org" },
      { key: "repo", label: "Repository (optional)", placeholder: "my-repo" },
    ],
  },
  { id: "aws", name: "AWS Security Hub", icon: "☁️", description: "Import findings as risks automatically", comingSoon: true, fields: [] },
  { id: "azure", name: "Azure Defender", icon: "🔷", description: "Sync security alerts and compliance data", comingSoon: true, fields: [] },
  { id: "okta", name: "Okta", icon: "🔑", description: "Auto-collect access reviews and user activity", comingSoon: true, fields: [] },
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

  // Current user role (for tab access control)
  const [userRole, setUserRole] = useState<string | null>(null);

  const ADMIN_ONLY_TABS: Tab[] = ["team", "billing", "integrations", "notifications", "security"];
  // null = still loading; don't restrict until we actually know the role
  const isAdminOrOwner = userRole === null || userRole === "owner" || userRole === "admin";

  // Read ?tab and ?upgraded from URL on first mount (after role is known)
  useEffect(() => {
    if (userRole === null) return; // wait until role is loaded
    const validTabs: Tab[] = ["organization", "team", "billing", "integrations", "notifications", "security", "appearance", "ai"];
    const urlTab = searchParams.get("tab") as Tab | null;
    if (urlTab && validTabs.includes(urlTab)) {
      // Redirect restricted tabs to "organization" for non-admins
      if (ADMIN_ONLY_TABS.includes(urlTab) && !isAdminOrOwner) {
        setActiveTab("organization");
      } else {
        setActiveTab(urlTab);
      }
    }
  }, [userRole]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(CLOSED_DIALOG);
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);

  // Billing
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeContributors, setUpgradeContributors] = useState(2);
  const [upgradeReadonly, setUpgradeReadonly] = useState(0);
  const [upgradeInterval, setUpgradeInterval] = useState<"month" | "year">("year");

  // AI Copilot
  const [aiUsage, setAiUsage] = useState<{ write_count: number; has_custom_key: boolean; limit: number } | null>(null);
  const [agentUsage, setAgentUsage] = useState<{
    allowed: boolean; runCount: number; trialStartedAt: string | null; trialExpired: boolean;
    trialDaysRemaining: number; freeActionsRemaining: number; creditsRemaining: number;
    hasUnlimitedPlan: boolean;
  } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKeyError, setApiKeyError] = useState("");
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  // Integrations
  const [integrations, setIntegrations] = useState<DbIntegration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [connectForm, setConnectForm] = useState<Record<string, string>>({});
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [connectSuccess, setConnectSuccess] = useState("");
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Fetch role once on mount (independent of active tab)
  useEffect(() => {
    fetch("/api/settings/organization")
      .then((r) => r.json())
      .then((data) => {
        if (data.user_role) setUserRole(data.user_role);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "organization") {
      fetch("/api/settings/organization")
        .then((r) => r.json())
        .then((data) => {
          if (data.user_role) setUserRole(data.user_role);
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
          if (data.current_user_id) setCurrentUserId(data.current_user_id);
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
      fetch("/api/settings/agent-usage")
        .then((r) => r.json())
        .then(setAgentUsage)
        .catch(() => {});
    }
    if (activeTab === "integrations") {
      setIntegrationsLoading(true);
      fetch("/api/integrations")
        .then((r) => r.json())
        .then((data) => setIntegrations(data.integrations ?? []))
        .catch(() => {})
        .finally(() => setIntegrationsLoading(false));
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

  const handleResendInvite = async (invite: PendingInvite) => {
    setResendingId(invite.id);
    setInviteError("");
    setInviteSuccess("");
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invite.email, role: invite.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend invite");
      setInviteSuccess(`Invite resent to ${invite.email}`);
      setTimeout(() => setInviteSuccess(""), 4000);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to resend invite");
    } finally {
      setResendingId(null);
    }
  };

  const handleChangeRole = async (member: TeamMember, newRole: string) => {
    setChangingRoleId(member.id);
    setInviteError("");
    try {
      const res = await fetch(`/api/team/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change role");
      setTeamMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role: data.member?.role ?? newRole } : m));
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to change role");
    } finally {
      setChangingRoleId(null);
    }
  };

  const refreshTeam = () =>
    fetch("/api/team/members")
      .then((r) => r.json())
      .then((d) => {
        setTeamMembers(d.members ?? []);
        setPendingInvites(d.invites ?? []);
        if (d.current_user_id) setCurrentUserId(d.current_user_id);
      })
      .catch(() => {});

  const handleCancelInvite = (invite: PendingInvite) => {
    setConfirmDialog({
      open: true,
      title: "Cancel invite",
      message: `Cancel the pending invite for ${invite.email}? They will no longer be able to use this invite link.`,
      irreversible: true,
      confirmLabel: "Cancel invite",
      variant: "danger",
      onConfirm: async () => {
        setConfirmDialog(CLOSED_DIALOG);
        setCancelingInviteId(invite.id);
        try {
          await fetch("/api/team/invite", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: invite.id }),
          });
          await refreshTeam();
        } catch {
          // silently ignore
        } finally {
          setCancelingInviteId(null);
        }
      },
    });
  };

  const handleToggleSuspend = (member: TeamMember) => {
    const isSuspended = member.status === "suspended";
    setConfirmDialog({
      open: true,
      title: isSuspended ? "Unsuspend member" : "Suspend member",
      message: isSuspended
        ? `Restore access for ${member.full_name || member.email}? They will be able to log in again immediately.`
        : `Suspend ${member.full_name || member.email}? They will lose access to the platform immediately.`,
      irreversible: false,
      confirmLabel: isSuspended ? "Unsuspend" : "Suspend",
      variant: "warning",
      onConfirm: async () => {
        setConfirmDialog(CLOSED_DIALOG);
        setSuspendingId(member.id);
        try {
          const res = await fetch(`/api/team/members/${member.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: isSuspended ? "active" : "suspended" }),
          });
          const data = await res.json();
          if (data.member) {
            setTeamMembers((prev) =>
              prev.map((m) => (m.id === member.id ? { ...m, status: data.member.status } : m))
            );
          }
        } catch {
          // silently ignore
        } finally {
          setSuspendingId(null);
        }
      },
    });
  };

  const handleRemoveMember = (member: TeamMember) => {
    setConfirmDialog({
      open: true,
      title: "Remove member",
      message: `Remove ${member.full_name || member.email} from the organization? They will immediately lose access to all data and workspaces.`,
      irreversible: true,
      confirmLabel: "Remove member",
      variant: "danger",
      onConfirm: async () => {
        setConfirmDialog(CLOSED_DIALOG);
        setRemovingId(member.id);
        try {
          await fetch(`/api/team/members/${member.id}`, { method: "DELETE" });
          setTeamMembers((prev) => prev.filter((m) => m.id !== member.id));
        } catch {
          // silently ignore
        } finally {
          setRemovingId(null);
        }
      },
    });
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setAlertModal({ title: "Error", message: data.error || "Billing portal unavailable" });
    } catch {
      setAlertModal({ title: "Error", message: "Could not open billing portal" });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleUpgradeClick = async () => {
    setShowUpgradeModal(false);
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contributors: upgradeContributors,
          readonly_users: upgradeReadonly,
          interval: upgradeInterval,
        }),
      });
      let data: { url?: string; error?: string } = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        setAlertModal({ title: "Checkout Error", message: data.error || `Checkout failed (HTTP ${res.status}). Please contact support@fastgrc.ai.` });
      }
    } catch (err) {
      setAlertModal({ title: "Error", message: `Could not reach the billing service. ${err instanceof Error ? err.message : ""} Please try again or contact support@fastgrc.ai.` });
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

  // ── Integration handlers ───────────────────────────────────────────────────
  const loadIntegrations = () => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((data) => setIntegrations(data.integrations ?? []))
      .catch(() => {});
  };

  const handleOpenConnect = (providerId: string) => {
    setConnectingProvider(providerId);
    setConnectForm({});
    setConnectError("");
    setConnectSuccess("");
  };

  const handleSaveConnect = async () => {
    if (!connectingProvider) return;
    setConnectLoading(true);
    setConnectError("");
    setConnectSuccess("");
    try {
      // 1. Save config to DB
      const saveRes = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: connectingProvider, name: connectingProvider.charAt(0).toUpperCase() + connectingProvider.slice(1), config: connectForm }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        setConnectError(saveData.error || "Failed to save integration");
        return;
      }
      const integrationId = saveData.integration?.id;

      // 2. Test the connection
      const testRes = await fetch(`/api/integrations/${connectingProvider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", integration_id: integrationId }),
      });
      const testData = await testRes.json();
      if (!testRes.ok || !testData.success) {
        setConnectError(testData.error || "Connection test failed — please check your credentials");
        return;
      }

      setConnectSuccess(testData.message || "Connected successfully!");
      loadIntegrations();
      setTimeout(() => {
        setConnectingProvider(null);
        setConnectSuccess("");
      }, 1500);
    } catch {
      setConnectError("An unexpected error occurred. Please try again.");
    } finally {
      setConnectLoading(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    setDisconnectingId(id);
    try {
      await fetch(`/api/integrations?id=${id}`, { method: "DELETE" });
      loadIntegrations();
    } catch {
      // ignore
    } finally {
      setDisconnectingId(null);
    }
  };

  // ── Monthly cost calculation ────────────────────────────────────────────────
  const monthlyBillingCost = subscription
    ? (subscription.seats_contributors ?? 0) *
        (subscription.billing_interval === "year" ? DISPLAY_PRICES.contributor_annual : DISPLAY_PRICES.contributor_monthly) / 100 +
      (subscription.seats_readonly ?? 0) *
        (subscription.billing_interval === "year" ? DISPLAY_PRICES.readonly_annual : DISPLAY_PRICES.readonly_monthly) / 100
    : 0;

  const allTabs: { id: Tab; label: string; icon: string; adminOnly?: boolean }[] = [
    { id: "organization", label: "Organization", icon: "🏢" },
    { id: "team", label: "Team", icon: "👥", adminOnly: true },
    { id: "billing", label: "Billing", icon: "💳", adminOnly: true },
    { id: "integrations", label: "Integrations", icon: "🔗", adminOnly: true },
    { id: "notifications", label: "Notifications", icon: "🔔", adminOnly: true },
    { id: "security", label: "Security", icon: "🔒", adminOnly: true },
    { id: "appearance", label: "Appearance", icon: "🎨" },
    { id: "ai", label: "AI Copilot", icon: "🤖" },
  ];
  const tabs = allTabs.filter((t) => !t.adminOnly || isAdminOrOwner);

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
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="font-semibold">Organization Details</h2>
                  {!isAdminOrOwner && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                      View only
                    </span>
                  )}
                </div>
                <div className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-sm font-medium mb-1">Organization Name</label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => isAdminOrOwner && setOrgName(e.target.value)}
                      readOnly={!isAdminOrOwner}
                      className={`w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isAdminOrOwner ? "cursor-default opacity-70" : ""}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Slug</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">fastgrc.ai/</span>
                      <input
                        type="text"
                        value={orgSlug}
                        onChange={(e) => isAdminOrOwner && setOrgSlug(e.target.value)}
                        readOnly={!isAdminOrOwner}
                        className={`flex-1 px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${!isAdminOrOwner ? "cursor-default opacity-70" : ""}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Industry</label>
                    <select
                      value={orgIndustry}
                      onChange={(e) => setOrgIndustry(e.target.value)}
                      disabled={!isAdminOrOwner}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:cursor-default"
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
                      disabled={!isAdminOrOwner}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:cursor-default"
                    >
                      <option>1-50 employees</option>
                      <option>51-200 employees</option>
                      <option>201-1000 employees</option>
                      <option>1000+ employees</option>
                    </select>
                  </div>
                  {isAdminOrOwner && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Team ─────────────────────────────────────────────────────── */}
          {activeTab === "team" && isAdminOrOwner && (
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
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Actions</th>
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
                                {/* Admins/owners can change roles of others; owners can change owner role */}
                                {isAdminOrOwner && member.id !== currentUserId && (userRole === "owner" || member.role !== "owner") ? (
                                  <select
                                    value={member.role}
                                    onChange={(e) => handleChangeRole(member, e.target.value)}
                                    disabled={changingRoleId === member.id}
                                    className="px-2 py-0.5 rounded text-xs bg-secondary border border-transparent hover:border-border focus:outline-none focus:ring-1 focus:ring-primary capitalize disabled:opacity-50 cursor-pointer"
                                  >
                                    {userRole === "owner" && <option value="owner">owner</option>}
                                    <option value="admin">admin</option>
                                    <option value="compliance_manager">compliance manager</option>
                                    <option value="risk_owner">risk owner</option>
                                    <option value="auditor">auditor</option>
                                    <option value="viewer">viewer</option>
                                  </select>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-xs bg-secondary capitalize">
                                    {member.role.replace(/_/g, " ")}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {member.status === "suspended" ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Suspended</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{lastActive}</td>
                              <td className="px-4 py-3">
                                {member.id === currentUserId ? (
                                  <span className="text-xs text-muted-foreground italic">You</span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleToggleSuspend(member)}
                                      disabled={suspendingId === member.id}
                                      className="px-2 py-1 rounded text-xs border border-orange-300 text-orange-700 hover:bg-orange-50 transition-colors disabled:opacity-50"
                                    >
                                      {suspendingId === member.id
                                        ? "…"
                                        : member.status === "suspended"
                                          ? "Unsuspend"
                                          : "Suspend"}
                                    </button>
                                    <button
                                      onClick={() => handleRemoveMember(member)}
                                      disabled={removingId === member.id}
                                      className="px-2 py-1 rounded text-xs border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                                    >
                                      {removingId === member.id ? "…" : "Remove"}
                                    </button>
                                  </div>
                                )}
                              </td>
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
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleResendInvite(invite)}
                                  disabled={resendingId === invite.id || cancelingInviteId === invite.id}
                                  className="px-2 py-1 rounded text-xs border border-primary/30 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                                >
                                  {resendingId === invite.id ? "Sending…" : "Resend"}
                                </button>
                                <button
                                  onClick={() => handleCancelInvite(invite)}
                                  disabled={cancelingInviteId === invite.id || resendingId === invite.id}
                                  className="px-2 py-1 rounded text-xs border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                  {cancelingInviteId === invite.id ? "…" : "Cancel"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {teamMembers.length === 0 && pendingInvites.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
          {activeTab === "billing" && isAdminOrOwner && (
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
                              onClick={() => setShowUpgradeModal(true)}
                              disabled={upgradeLoading}
                              className="shrink-0 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
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

                  {/* Period / cancellation info */}
                  {subscription?.current_period_end && (
                    subscription.cancel_at_period_end ? (
                      <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm space-y-1">
                        <p className="font-medium text-yellow-700 dark:text-yellow-400">
                          Subscription cancelled — access continues until{" "}
                          <strong>{new Date(subscription.current_period_end).toLocaleDateString()}</strong>
                        </p>
                        <p className="text-yellow-600 dark:text-yellow-500 text-xs">
                          You will <strong>not</strong> be charged again. All your data remains accessible until that date.
                        </p>
                      </div>
                    ) : subscription.trial_end && new Date(subscription.trial_end) > new Date() ? (
                      <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                        Trial ends <strong>{new Date(subscription.trial_end).toLocaleDateString()}</strong> — no charge until then.
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                        Next billing date: <strong>{new Date(subscription.current_period_end).toLocaleDateString()}</strong>
                      </div>
                    )
                  )}

                  {/* Plan comparison — always visible */}
                  {(() => {
                    const plan = subscription?.plan ?? "builder";
                    const isFreePlan = plan === "builder";
                    const isGrowth = plan === "growth";
                    const isEnterprise = plan === "enterprise";
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
                                <th className="text-left pb-2 font-medium text-muted-foreground" style={{ width: "40%" }}>Feature</th>
                                <th className={`text-center pb-2 font-medium ${isFreePlan ? "text-foreground" : "text-muted-foreground"}`} style={{ width: "20%" }}>
                                  Builder<br /><span className="text-xs font-normal text-muted-foreground">Free forever</span>
                                </th>
                                <th className={`text-center pb-2 font-medium ${isGrowth ? "text-primary" : "text-muted-foreground"}`} style={{ width: "20%" }}>
                                  Growth<br /><span className="text-xs font-normal">$39/seat/mo</span>
                                </th>
                                <th className={`text-center pb-2 font-medium ${isEnterprise ? "text-purple-600" : "text-muted-foreground"}`} style={{ width: "20%" }}>
                                  Enterprise<br /><span className="text-xs font-normal">Custom pricing</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {[
                                ["AI copilot sessions", "10 total", "Unlimited", "Unlimited"],
                                ["Compliance frameworks", "3 (SOC 2, ISO, NIST)", "All + HIPAA", "All + Custom"],
                                ["Contributor seats", "1", "Unlimited", "Unlimited"],
                                ["Read-only users", "—", "Unlimited ($7.99/mo)", "Unlimited"],
                                ["Slack / Jira / GitHub", "—", "✓", "✓"],
                                ["Audit-ready exports", "—", "✓", "✓"],
                                ["Custom frameworks", "—", "✓", "✓"],
                                ["SSO / SAML", "—", "—", "✓"],
                                ["Dedicated CSM", "—", "—", "✓"],
                                ["SLA & uptime guarantee", "—", "—", "✓"],
                                ["On-prem / private cloud", "—", "—", "✓"],
                                ["Priority support", "—", "Email", "24/7 phone & email"],
                              ].map(([feature, builder, growth, enterprise]) => (
                                <tr key={feature} className="hover:bg-muted/30">
                                  <td className="py-2 text-muted-foreground">{feature}</td>
                                  <td className={`py-2 text-center ${isFreePlan ? "font-medium" : "text-muted-foreground"}`}>{builder}</td>
                                  <td className={`py-2 text-center ${isGrowth ? "font-medium text-primary" : "text-muted-foreground"}`}>{growth}</td>
                                  <td className={`py-2 text-center ${isEnterprise ? "font-medium text-purple-600" : "text-muted-foreground"}`}>{enterprise}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Action row */}
                        <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row gap-3">
                          {isFreePlan && (
                            <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
                              <p className="text-xs text-muted-foreground">14-day free trial · Cancel anytime · No credit card required to start</p>
                              <button
                                onClick={() => setShowUpgradeModal(true)}
                                disabled={upgradeLoading}
                                className="shrink-0 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                              >
                                {upgradeLoading ? "Opening…" : "Upgrade to Growth →"}
                              </button>
                            </div>
                          )}
                          <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/30 rounded-lg px-4 py-3 ${isFreePlan ? "sm:max-w-xs" : "flex-1"}`}>
                            <div>
                              <p className="text-xs font-medium text-purple-700 dark:text-purple-300">Enterprise</p>
                              <p className="text-xs text-muted-foreground">SSO, SLA, custom deployment, dedicated support</p>
                            </div>
                            <a
                              href="mailto:sales@fastgrc.ai?subject=Enterprise inquiry"
                              className="shrink-0 rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition-colors"
                            >
                              Contact us →
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* ── Integrations ─────────────────────────────────────────────── */}
          {activeTab === "integrations" && isAdminOrOwner && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
                <p className="text-sm text-primary">
                  <strong>Pro tip:</strong> Integrations automatically collect evidence and sync risk data, reducing manual effort by up to 70%.
                </p>
              </div>

              {integrationsLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-5 rounded-lg border bg-card animate-pulse">
                      <div className="h-5 w-32 bg-muted rounded mb-2" />
                      <div className="h-4 w-48 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {PROVIDER_META.map((meta) => {
                    const connected = integrations.find((i) => i.provider === meta.id && i.status === "active");
                    const isConnecting = connectingProvider === meta.id;
                    return (
                      <div key={meta.id} className={`rounded-lg border bg-card transition-colors ${meta.comingSoon ? "opacity-60" : "hover:border-primary/30"}`}>
                        <div className="p-5">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{meta.icon}</span>
                              <div>
                                <h3 className="font-semibold">{meta.name}</h3>
                                {connected && (
                                  <p className="text-xs text-green-600">
                                    {meta.id === "jira" && connected.config?.host
                                      ? `Connected to ${(connected.config.host as string).replace(/^https?:\/\//, "")}`
                                      : meta.id === "slack" && connected.config?.channel
                                      ? `Connected to ${connected.config.channel}`
                                      : meta.id === "github" && connected.config?.org
                                      ? `Connected to ${connected.config.org}`
                                      : "Connected"}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {meta.comingSoon ? (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">Coming soon</span>
                              ) : connected ? (
                                <>
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Connected</span>
                                  <button
                                    onClick={() => handleDisconnect(connected.id)}
                                    disabled={disconnectingId === connected.id}
                                    className="px-2 py-0.5 rounded text-xs border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                  >
                                    {disconnectingId === connected.id ? "…" : "Disconnect"}
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleOpenConnect(meta.id)}
                                  className="px-3 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                >
                                  Connect
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{meta.description}</p>
                        </div>

                        {/* Inline connect form */}
                        {isConnecting && (
                          <div className="border-t p-5 space-y-3 bg-muted/30">
                            {meta.fields.map((field) => (
                              <div key={field.key} className="space-y-1">
                                <label className="text-xs font-medium">{field.label}</label>
                                <input
                                  type={field.type === "password" ? "password" : "text"}
                                  placeholder={field.placeholder}
                                  value={connectForm[field.key] ?? ""}
                                  onChange={(e) => setConnectForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                              </div>
                            ))}
                            {connectError && (
                              <p className="text-xs text-destructive">{connectError}</p>
                            )}
                            {connectSuccess && (
                              <p className="text-xs text-green-600 font-medium">{connectSuccess}</p>
                            )}
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={handleSaveConnect}
                                disabled={connectLoading}
                                className="px-4 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                              >
                                {connectLoading ? "Testing connection…" : "Save & Test"}
                              </button>
                              <button
                                onClick={() => { setConnectingProvider(null); setConnectError(""); }}
                                className="px-4 py-1.5 rounded-md text-xs border hover:bg-accent transition-colors"
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
              )}
            </div>
          )}

          {/* ── Notifications ────────────────────────────────────────────── */}
          {activeTab === "notifications" && isAdminOrOwner && (
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
          {activeTab === "security" && isAdminOrOwner && (
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
                              onClick={() => setShowUpgradeModal(true)}
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

              {/* Agent Actions usage */}
              <div className="p-6 rounded-lg border bg-card">
                <h2 className="font-semibold mb-1">Agent Actions</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Autonomous agents run scheduled compliance tasks. Each run counts as one action.
                </p>
                {agentUsage ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {agentUsage.hasUnlimitedPlan ? (
                          <span className="text-green-600">Unlimited agent actions</span>
                        ) : (
                          <span>
                            <strong>{agentUsage.runCount}</strong> actions used
                            {!agentUsage.trialExpired && ` · ${agentUsage.freeActionsRemaining} of 10 free remaining`}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {agentUsage.hasUnlimitedPlan && (
                          <button
                            onClick={() => {
                              setConfirmDialog({
                                open: true,
                                title: "Cancel Agent Unlimited",
                                message: "Your unlimited agent actions will remain active until the end of the current billing period. After that, you'll revert to pay-as-you-go pricing.",
                                irreversible: false,
                                confirmLabel: "Cancel Plan",
                                variant: "warning",
                                onConfirm: async () => {
                                  setConfirmDialog(CLOSED_DIALOG);
                                  try {
                                    const res = await fetch("/api/billing/agent-cancel", { method: "POST" });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error ?? "Failed to cancel");
                                    setAlertModal({ title: "Plan Canceled", message: data.message ?? "Agent unlimited plan will cancel at the end of the billing period." });
                                    // Refresh usage
                                    const usageRes = await fetch("/api/settings/agent-usage");
                                    const usage = await usageRes.json();
                                    setAgentUsage(usage);
                                  } catch (err) {
                                    setAlertModal({ title: "Error", message: err instanceof Error ? err.message : "Could not cancel agent plan" });
                                  }
                                },
                              });
                            }}
                            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          >
                            Cancel Plan
                          </button>
                        )}
                        {!agentUsage.hasUnlimitedPlan && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            !agentUsage.allowed ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            agentUsage.freeActionsRemaining <= 3 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          }`}>
                            {!agentUsage.allowed ? "Limit reached" :
                             agentUsage.trialExpired ? `${agentUsage.creditsRemaining} credits left` :
                             `${agentUsage.trialDaysRemaining}d trial remaining`}
                          </span>
                        )}
                      </div>
                    </div>
                    {!agentUsage.hasUnlimitedPlan && (
                      <>
                        {!agentUsage.trialExpired && (
                          <div className="w-full bg-muted rounded-full h-2 mb-3">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                agentUsage.freeActionsRemaining <= 0 ? "bg-red-500" :
                                agentUsage.freeActionsRemaining <= 3 ? "bg-yellow-500" : "bg-green-500"
                              }`}
                              style={{ width: `${Math.min((agentUsage.runCount / 10) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                        {agentUsage.creditsRemaining > 0 && (
                          <p className="text-xs text-muted-foreground mb-3">
                            +{agentUsage.creditsRemaining} purchased actions available
                          </p>
                        )}
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            {!agentUsage.allowed
                              ? "Purchase more actions or subscribe to unlimited."
                              : "Need more agent actions?"}
                          </p>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={async () => {
                                const res = await fetch("/api/billing/agent-checkout", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ type: "action_pack" }),
                                });
                                const data = await res.json();
                                if (data.url) window.open(data.url, "_blank");
                              }}
                              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                            >
                              10 actions · $10
                            </button>
                            <button
                              onClick={async () => {
                                const res = await fetch("/api/billing/agent-checkout", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ type: "unlimited" }),
                                });
                                const data = await res.json();
                                if (data.url) window.open(data.url, "_blank");
                              }}
                              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                              Unlimited · $99.99/mo
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="h-4 bg-muted rounded animate-pulse w-48" />
                )}
              </div>
            </div>
          )}

          {/* ── Appearance ───────────────────────────────────────────────── */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div className="p-6 rounded-lg border bg-card">
                <h2 className="font-semibold mb-1">Theme</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose how FastGRC.ai looks to you.
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

      {/* ── Confirmation modal ───────────────────────────────────────────── */}
      {confirmDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border bg-card shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-5">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-4 ${
                confirmDialog.variant === "danger" ? "bg-red-100 dark:bg-red-900/30" : "bg-orange-100 dark:bg-orange-900/30"
              }`}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`w-5 h-5 ${confirmDialog.variant === "danger" ? "text-red-600" : "text-orange-600"}`}
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="text-base font-semibold">{confirmDialog.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{confirmDialog.message}</p>
              {confirmDialog.irreversible && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 px-3 py-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-red-600 shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-xs text-red-700 dark:text-red-400 font-medium">This action cannot be undone.</p>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setConfirmDialog(CLOSED_DIALOG)}
                className="flex-1 px-4 py-2 rounded-lg border text-sm hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                  confirmDialog.variant === "danger"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Alert modal (replaces browser alert) ─────────────────────────── */}
      {alertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAlertModal(null)}>
          <div className="w-full max-w-sm rounded-xl border bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-5">
              <h3 className="text-base font-semibold">{alertModal.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{alertModal.message}</p>
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setAlertModal(null)} className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-colors">
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upgrade seat-selector modal ──────────────────────────────────── */}
      {showUpgradeModal && (() => {
        const contribPrice = upgradeInterval === "year"
          ? DISPLAY_PRICES.contributor_annual / 100
          : DISPLAY_PRICES.contributor_monthly / 100;
        const roPrice = upgradeInterval === "year"
          ? DISPLAY_PRICES.readonly_annual / 100
          : DISPLAY_PRICES.readonly_monthly / 100;
        const total = upgradeContributors * contribPrice + upgradeReadonly * roPrice;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl border bg-card shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b">
                <h2 className="text-lg font-semibold">Upgrade to Growth</h2>
                <p className="text-sm text-muted-foreground mt-1">14-day free trial · Cancel anytime · No credit card charged until trial ends</p>
              </div>

              <div className="p-6 space-y-5">
                {/* Billing interval */}
                <div>
                  <p className="text-sm font-medium mb-2">Billing cycle</p>
                  <div className="flex rounded-lg border overflow-hidden text-sm">
                    <button
                      className={`flex-1 px-4 py-2 transition-colors ${upgradeInterval === "year" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent"}`}
                      onClick={() => setUpgradeInterval("year")}
                    >
                      Annual <span className="text-xs opacity-80 ml-1">save ~20%</span>
                    </button>
                    <button
                      className={`flex-1 px-4 py-2 transition-colors ${upgradeInterval === "month" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent"}`}
                      onClick={() => setUpgradeInterval("month")}
                    >
                      Monthly
                    </button>
                  </div>
                </div>

                {/* Contributor seats */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Contributors</p>
                    <p className="text-xs text-muted-foreground">{fmt(contribPrice)}/seat/mo · can create &amp; edit</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className="w-8 h-8 rounded-full border flex items-center justify-center text-lg hover:bg-accent transition-colors disabled:opacity-40"
                      onClick={() => setUpgradeContributors((n) => Math.max(1, n - 1))}
                      disabled={upgradeContributors <= 1}
                    >−</button>
                    <span className="w-6 text-center font-semibold">{upgradeContributors}</span>
                    <button
                      className="w-8 h-8 rounded-full border flex items-center justify-center text-lg hover:bg-accent transition-colors"
                      onClick={() => setUpgradeContributors((n) => n + 1)}
                    >+</button>
                  </div>
                </div>

                {/* Read-only seats */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Read-only users</p>
                    <p className="text-xs text-muted-foreground">{fmt(roPrice)}/seat/mo · view only</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className="w-8 h-8 rounded-full border flex items-center justify-center text-lg hover:bg-accent transition-colors disabled:opacity-40"
                      onClick={() => setUpgradeReadonly((n) => Math.max(0, n - 1))}
                      disabled={upgradeReadonly <= 0}
                    >−</button>
                    <span className="w-6 text-center font-semibold">{upgradeReadonly}</span>
                    <button
                      className="w-8 h-8 rounded-full border flex items-center justify-center text-lg hover:bg-accent transition-colors"
                      onClick={() => setUpgradeReadonly((n) => n + 1)}
                    >+</button>
                  </div>
                </div>

                {/* Price summary */}
                <div className="rounded-lg bg-muted/50 px-4 py-3 border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Estimated total</span>
                    <span className="font-semibold text-base">{fmt(total)}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                      {upgradeInterval === "year" && (
                        <span className="text-xs font-normal text-muted-foreground ml-1">· {fmt(total * 12)}/yr</span>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">No charge for 14 days. You can adjust seats anytime.</p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border text-sm hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpgradeClick}
                  disabled={upgradeLoading}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {upgradeLoading ? "Opening Stripe…" : "Start free trial →"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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
