"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SKILL_CATALOG, SCHEDULE_LABELS } from "@/shared/lib/agents/skills";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentType {
  id: string;
  name: string;
  description: string;
  skills: string[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  status: "active" | "suspended" | "deleted";
  schedule: string;
  last_run_at: string | null;
  next_run_at: string | null;
  config: Record<string, unknown>;
  agent_type: { id: string; name: string; skills: string[]; is_default: boolean };
  created_at: string;
}

interface AgentTask {
  id: string;
  task_id: string;
  agent_id: string;
  run_id: string;
  title: string;
  description: string;
  skill_used: string;
  action_type: "read" | "write";
  status: "pending_approval" | "approved" | "declined" | "completed" | "failed";
  result: Record<string, unknown> | null;
  error_message: string | null;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  agent: { id: string; name: string };
  created_at: string;
}

type Tab = "agents" | "types" | "tasks";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function StatusBadge({ status }: { status: AgentTask["status"] }) {
  const styles: Record<AgentTask["status"], string> = {
    pending_approval: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    approved: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    declined: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    completed: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    failed: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  };
  const labels: Record<AgentTask["status"], string> = {
    pending_approval: "Pending Approval",
    approved: "Approved",
    declined: "Declined",
    completed: "Completed",
    failed: "Failed",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function AgentStatusBadge({ status }: { status: Agent["status"] }) {
  if (status === "active") return <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-200">Active</span>;
  if (status === "suspended") return <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 border border-amber-200">Suspended</span>;
  return <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground border border-border">Deleted</span>;
}

function SkillChip({ skillId }: { skillId: string }) {
  const skill = SKILL_CATALOG.find((s) => s.id === skillId);
  const isWrite = skill?.requiresApproval;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full border mr-1 mb-1 ${isWrite ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800" : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"}`}>
      {skill?.name ?? skillId}
    </span>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function NewAgentTypeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleSkill = (id: string) => {
    setSelectedSkills((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    if (selectedSkills.length === 0) { setError("Select at least one skill"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/agent-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, skills: selectedSkills }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b">
          <h2 className="text-lg font-semibold">New Agent Type</h2>
          <p className="text-sm text-muted-foreground mt-1">Define a reusable agent blueprint with a specific set of skills.</p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. Compliance Monitor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              rows={2}
              placeholder="What does this agent type do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Skills *</label>
            <div className="grid grid-cols-2 gap-2">
              {SKILL_CATALOG.map((skill) => (
                <label key={skill.id} className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${selectedSkills.includes(skill.id) ? "bg-primary/5 border-primary" : "hover:bg-muted"}`}>
                  <input
                    type="checkbox"
                    checked={selectedSkills.includes(skill.id)}
                    onChange={() => toggleSkill(skill.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">{skill.name}</div>
                    <div className="text-xs text-muted-foreground">{skill.description}</div>
                    {skill.requiresApproval && <div className="text-xs text-orange-600 mt-0.5">Requires approval</div>}
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-foreground rounded-lg py-2 text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? "Creating…" : "Create Type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewAgentModal({ agentTypes, onClose, onCreated }: { agentTypes: AgentType[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", agent_type_id: "", schedule: "manual", config: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedType = agentTypes.find((t) => t.id === form.agent_type_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.agent_type_id) { setError("Agent type is required"); return; }

    let config: Record<string, unknown> = {};
    if (form.config.trim()) {
      try { config = JSON.parse(form.config); } catch { setError("Config must be valid JSON"); return; }
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, description: form.description, agent_type_id: form.agent_type_id, schedule: form.schedule, config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b">
          <h2 className="text-lg font-semibold">New Agent</h2>
          <p className="text-sm text-muted-foreground mt-1">Create a scheduled agent instance from a type.</p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Agent Name *</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. NIST Policy Watcher"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">A friendly name to identify this agent</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">What should this agent do?</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. Monitor NIST for policy updates and flag compliance gaps"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Agent Type *</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.agent_type_id}
              onChange={(e) => setForm((f) => ({ ...f, agent_type_id: e.target.value }))}
            >
              <option value="">Choose a type to define the agent&apos;s skills…</option>
              {agentTypes.filter((t) => t.is_active).map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.is_default ? " (Default)" : ""}</option>
              ))}
            </select>
            {selectedType && (
              <div className="mt-2 flex flex-wrap">
                {selectedType.skills.map((s) => <SkillChip key={s} skillId={s} />)}
              </div>
            )}
            {!selectedType && <p className="text-xs text-muted-foreground mt-1">The type determines which skills this agent can use</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">How often should it run?</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.schedule}
              onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
            >
              {Object.entries(SCHEDULE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Custom Config (optional)</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              rows={3}
              placeholder={`{\n  "search_query": "latest NIST CSF updates 2026"\n}`}
              value={form.config}
              onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">JSON key-value pairs passed to the agent at runtime</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-foreground rounded-lg py-2 text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? "Creating…" : "Create Agent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("agents");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [planEligible, setPlanEligible] = useState<boolean | null>(null);

  // Data
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentTypes, setAgentTypes] = useState<AgentType[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);

  // Loading / error states
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [agentsError, setAgentsError] = useState("");
  const [typesError, setTypesError] = useState("");
  const [tasksError, setTasksError] = useState("");

  // Modals
  const [showNewType, setShowNewType] = useState(false);
  const [showNewAgent, setShowNewAgent] = useState(false);

  // Expanded task row
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Task filters
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");
  const [taskAgentFilter, setTaskAgentFilter] = useState<string>("all");

  // Action loading states
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [togglingAgentId, setTogglingAgentId] = useState<string | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);
  const [approvingTaskId, setApprovingTaskId] = useState<string | null>(null);
  const [decliningTaskId, setDecliningTaskId] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const isAdminOrOwner = userRole === null || userRole === "owner" || userRole === "admin";

  // ── Fetchers ──

  const fetchRole = useCallback(async () => {
    try {
      const [orgRes, subRes] = await Promise.all([
        fetch("/api/settings/organization"),
        fetch("/api/billing/subscription"),
      ]);
      const orgData = await orgRes.json() as { user_role?: string };
      if (orgData.user_role) setUserRole(orgData.user_role);
      else setUserRole("viewer");

      const subData = await subRes.json() as { subscription?: { plan?: string; status?: string; current_period_end?: string } };
      const sub = subData.subscription;
      const notExpired = sub?.current_period_end ? new Date(sub.current_period_end) > new Date() : false;
      setPlanEligible(notExpired);
    } catch {
      setUserRole("viewer");
      setPlanEligible(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    setAgentsError("");
    try {
      const res = await fetch("/api/agents");
      const data = await res.json() as { agents?: Agent[]; error?: string };
      setAgents(data.agents ?? []);
    } catch { setAgentsError("Could not load agents"); }
    finally { setLoadingAgents(false); }
  }, []);

  const fetchTypes = useCallback(async () => {
    setLoadingTypes(true);
    setTypesError("");
    try {
      const res = await fetch("/api/agent-types");
      const data = await res.json() as { agent_types?: AgentType[]; error?: string };
      setAgentTypes(data.agent_types ?? []);
    } catch { setTypesError("Could not load agent types"); }
    finally { setLoadingTypes(false); }
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    setTasksError("");
    try {
      const res = await fetch("/api/agent-tasks");
      const data = await res.json() as { tasks?: AgentTask[]; error?: string };
      setTasks(data.tasks ?? []);
    } catch { setTasksError("Could not load tasks"); }
    finally { setLoadingTasks(false); }
  }, []);

  useEffect(() => { fetchRole(); }, [fetchRole]);
  useEffect(() => { fetchAgents(); fetchTypes(); }, [fetchAgents, fetchTypes]);
  useEffect(() => { if (activeTab === "tasks") fetchTasks(); }, [activeTab, fetchTasks]);

  // ── Agent actions ──

  const handleRunAgent = async (agent: Agent) => {
    setRunningAgentId(agent.id);
    setActionErrors((e) => ({ ...e, [agent.id]: "" }));
    try {
      const res = await fetch(`/api/agents/${agent.id}/run`, { method: "POST" });
      const data = await res.json() as { success?: boolean; tasks_created?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to run");
      await fetchAgents();
      // Switch to tasks tab to show results
      setActiveTab("tasks");
      await fetchTasks();
    } catch (err) {
      setActionErrors((e) => ({ ...e, [agent.id]: err instanceof Error ? err.message : "Failed to run" }));
    } finally {
      setRunningAgentId(null);
    }
  };

  const handleToggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === "active" ? "suspended" : "active";
    setTogglingAgentId(agent.id);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      await fetchAgents();
    } catch (err) {
      setActionErrors((e) => ({ ...e, [agent.id]: err instanceof Error ? err.message : "Failed" }));
    } finally {
      setTogglingAgentId(null);
    }
  };

  const handleDeleteAgent = async (agent: Agent) => {
    if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
    setDeletingAgentId(agent.id);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      await fetchAgents();
    } catch (err) {
      setActionErrors((e) => ({ ...e, [agent.id]: err instanceof Error ? err.message : "Failed" }));
    } finally {
      setDeletingAgentId(null);
    }
  };

  const handleDeleteType = async (type: AgentType) => {
    if (type.is_default) return;
    if (!confirm(`Delete agent type "${type.name}"? Agents using this type will also be removed.`)) return;
    setDeletingTypeId(type.id);
    try {
      const res = await fetch(`/api/agent-types/${type.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      await fetchTypes();
    } catch (err) {
      setActionErrors((e) => ({ ...e, [type.id]: err instanceof Error ? err.message : "Failed" }));
    } finally {
      setDeletingTypeId(null);
    }
  };

  // ── Task actions ──

  const handleApprove = async (task: AgentTask) => {
    setApprovingTaskId(task.id);
    try {
      const res = await fetch(`/api/agent-tasks/${task.id}/approve`, { method: "POST" });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      await fetchTasks();
    } catch (err) {
      setActionErrors((e) => ({ ...e, [task.id]: err instanceof Error ? err.message : "Failed to approve" }));
    } finally {
      setApprovingTaskId(null);
    }
  };

  const handleDecline = async (task: AgentTask) => {
    setDecliningTaskId(task.id);
    try {
      const res = await fetch(`/api/agent-tasks/${task.id}/decline`, { method: "POST" });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      await fetchTasks();
    } catch (err) {
      setActionErrors((e) => ({ ...e, [task.id]: err instanceof Error ? err.message : "Failed to decline" }));
    } finally {
      setDecliningTaskId(null);
    }
  };

  // ── Filtered tasks ──

  const filteredTasks = tasks.filter((t) => {
    if (taskStatusFilter !== "all" && t.status !== taskStatusFilter) return false;
    if (taskAgentFilter !== "all" && t.agent_id !== taskAgentFilter) return false;
    return true;
  });

  const pendingCount = tasks.filter((t) => t.status === "pending_approval").length;

  // ─── Render ─────────────────────────────────────────────────────────────────

  // Plan eligibility gate — show upgrade prompt for free-tier users
  if (planEligible === false) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Agents</h1>
        <p className="text-sm text-muted-foreground mb-8">Autonomous GRC agents that run on schedules and require approval for write actions.</p>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4">🤖</div>
          <h2 className="text-xl font-semibold mb-2">Agents require the Growth plan</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            Autonomous GRC agents that monitor compliance, analyze risks, and surface gaps on a schedule are available on the Growth plan.
          </p>
          <Link
            href="/dashboard/settings?tab=billing"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Upgrade to Growth →
          </Link>
        </div>
      </div>
    );
  }

  // Still loading plan status
  if (planEligible === null) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Agents</h1>
        <p className="text-sm text-muted-foreground py-12 text-center">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">Autonomous GRC agents that run on schedules and require approval for write actions.</p>
        </div>
        {isAdminOrOwner && (
          <div className="flex gap-2">
            {activeTab === "types" && (
              <button onClick={() => setShowNewType(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
                + New Type
              </button>
            )}
            {activeTab === "agents" && (
              <button onClick={() => setShowNewAgent(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
                + New Agent
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted p-1 rounded-lg w-fit">
        {(["agents", "types", "tasks"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${activeTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab === "tasks" ? (
              <span className="flex items-center gap-1.5">
                Tasks
                {pendingCount > 0 && (
                  <span className="bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </span>
            ) : tab === "types" ? "Agent Types" : "Agents"}
          </button>
        ))}
      </div>

      {/* ── Tab: Agents ── */}
      {activeTab === "agents" && (
        <div>
          {loadingAgents && <p className="text-sm text-muted-foreground py-8 text-center">Loading agents…</p>}
          {agentsError && <p className="text-sm text-red-600 py-4">{agentsError}</p>}
          {!loadingAgents && agents.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3">🤖</div>
              <p className="font-medium">No agents yet</p>
              <p className="text-sm mt-1">Create an agent to start automating GRC tasks on a schedule.</p>
              {isAdminOrOwner && (
                <button onClick={() => setShowNewAgent(true)} className="mt-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
                  + Create your first agent
                </button>
              )}
            </div>
          )}
          {!loadingAgents && agents.length > 0 && (
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Agent</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Schedule</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last Run</th>
                    {isAdminOrOwner && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{agent.name}</div>
                        {agent.description && <div className="text-xs text-muted-foreground mt-0.5">{agent.description}</div>}
                        {actionErrors[agent.id] && <div className="text-xs text-red-600 mt-1">{actionErrors[agent.id]}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{agent.agent_type?.name ?? "—"}</div>
                        <div className="flex flex-wrap mt-1">
                          {(agent.agent_type?.skills ?? []).slice(0, 3).map((s) => <SkillChip key={s} skillId={s} />)}
                          {(agent.agent_type?.skills ?? []).length > 3 && <span className="text-xs text-muted-foreground">+{(agent.agent_type?.skills ?? []).length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{SCHEDULE_LABELS[agent.schedule] ?? agent.schedule}</td>
                      <td className="px-4 py-3"><AgentStatusBadge status={agent.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(agent.last_run_at)}</td>
                      {isAdminOrOwner && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRunAgent(agent)}
                              disabled={runningAgentId === agent.id || agent.status !== "active"}
                              className="px-2.5 py-1 text-xs border rounded-md hover:bg-muted disabled:opacity-40"
                            >
                              {runningAgentId === agent.id ? "Running…" : "▶ Run"}
                            </button>
                            <button
                              onClick={() => handleToggleStatus(agent)}
                              disabled={togglingAgentId === agent.id}
                              className="px-2.5 py-1 text-xs border rounded-md hover:bg-muted disabled:opacity-40"
                            >
                              {togglingAgentId === agent.id ? "…" : agent.status === "active" ? "Suspend" : "Activate"}
                            </button>
                            <button
                              onClick={() => handleDeleteAgent(agent)}
                              disabled={deletingAgentId === agent.id}
                              className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-40"
                            >
                              {deletingAgentId === agent.id ? "…" : "Delete"}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Agent Types ── */}
      {activeTab === "types" && (
        <div>
          {loadingTypes && <p className="text-sm text-muted-foreground py-8 text-center">Loading agent types…</p>}
          {typesError && <p className="text-sm text-red-600 py-4">{typesError}</p>}
          {!loadingTypes && agentTypes.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3">🧩</div>
              <p className="font-medium">No agent types yet</p>
              <p className="text-sm mt-1">The Default GRC Agent will be available once you&apos;ve connected your organization.</p>
            </div>
          )}
          {!loadingTypes && agentTypes.length > 0 && (
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Skills</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    {isAdminOrOwner && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agentTypes.map((type) => (
                    <tr key={type.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{type.name}</span>
                          {type.is_default && <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">Default</span>}
                        </div>
                        {type.description && <div className="text-xs text-muted-foreground mt-0.5">{type.description}</div>}
                        {actionErrors[type.id] && <div className="text-xs text-red-600 mt-1">{actionErrors[type.id]}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap">
                          {type.skills.map((s) => <SkillChip key={s} skillId={s} />)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full border ${type.is_active ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800" : "bg-muted text-muted-foreground border-border"}`}>
                          {type.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {isAdminOrOwner && (
                        <td className="px-4 py-3 text-right">
                          {!type.is_default && (
                            <button
                              onClick={() => handleDeleteType(type)}
                              disabled={deletingTypeId === type.id}
                              className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-40"
                            >
                              {deletingTypeId === type.id ? "…" : "Delete"}
                            </button>
                          )}
                          {type.is_default && <span className="text-xs text-muted-foreground">Protected</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Tasks ── */}
      {activeTab === "tasks" && (
        <div>
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <select
              value={taskStatusFilter}
              onChange={(e) => setTaskStatusFilter(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={taskAgentFilter}
              onChange={(e) => setTaskAgentFilter(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none"
            >
              <option value="all">All agents</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button onClick={fetchTasks} className="ml-auto border rounded-lg px-3 py-1.5 text-sm hover:bg-muted">
              Refresh
            </button>
          </div>

          {loadingTasks && <p className="text-sm text-muted-foreground py-8 text-center">Loading tasks…</p>}
          {tasksError && <p className="text-sm text-red-600 py-4">{tasksError}</p>}
          {!loadingTasks && filteredTasks.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3">📋</div>
              <p className="font-medium">No tasks yet</p>
              <p className="text-sm mt-1">Run an agent to see tasks appear here.</p>
            </div>
          )}
          {!loadingTasks && filteredTasks.length > 0 && (
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Task</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Agent</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Skill</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                    {isAdminOrOwner && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTasks.map((task) => (
                    <>
                      <tr
                        key={task.id}
                        className={`hover:bg-muted/50 cursor-pointer ${expandedTaskId === task.id ? "bg-primary/5" : ""}`}
                        onClick={() => setExpandedTaskId((prev) => prev === task.id ? null : task.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{task.title}</div>
                          <div className="text-xs text-muted-foreground font-mono">{task.task_id}</div>
                          {actionErrors[task.id] && <div className="text-xs text-red-600 mt-1">{actionErrors[task.id]}</div>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{task.agent?.name ?? "—"}</td>
                        <td className="px-4 py-3"><SkillChip skillId={task.skill_used} /></td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-xs rounded-full border ${task.action_type === "write" ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800" : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"}`}>
                            {task.action_type}
                          </span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(task.created_at)}</td>
                        {isAdminOrOwner && (
                          <td className="px-4 py-3">
                            {task.status === "pending_approval" && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleApprove(task); }}
                                  disabled={approvingTaskId === task.id}
                                  className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-40"
                                >
                                  {approvingTaskId === task.id ? "…" : "Approve"}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDecline(task); }}
                                  disabled={decliningTaskId === task.id}
                                  className="px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-40"
                                >
                                  {decliningTaskId === task.id ? "…" : "Decline"}
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                      {expandedTaskId === task.id && (
                        <tr key={`${task.id}-detail`}>
                          <td colSpan={isAdminOrOwner ? 7 : 6} className="px-4 py-4 bg-muted/50 border-b">
                            <div className="space-y-3">
                              {task.description && (
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
                                  <p className="text-sm text-foreground">{task.description}</p>
                                </div>
                              )}
                              {task.result && (
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">{task.action_type === "write" ? "Proposed Action" : "Result"}</div>
                                  <pre className="text-xs font-mono bg-card border rounded-lg p-3 overflow-auto max-h-48 text-foreground">
                                    {JSON.stringify(task.result, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {task.error_message && (
                                <div>
                                  <div className="text-xs font-medium text-red-500 mb-1">Error</div>
                                  <p className="text-sm text-red-600 font-mono">{task.error_message}</p>
                                </div>
                              )}
                              {task.approved_at && (
                                <div className="text-xs text-muted-foreground">
                                  {task.status === "approved" ? "Approved" : "Declined"} on {formatDate(task.approved_at)}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showNewType && isAdminOrOwner && (
        <NewAgentTypeModal onClose={() => setShowNewType(false)} onCreated={() => { fetchTypes(); }} />
      )}
      {showNewAgent && isAdminOrOwner && (
        <NewAgentModal agentTypes={agentTypes} onClose={() => setShowNewAgent(false)} onCreated={() => { fetchAgents(); }} />
      )}
    </div>
  );
}
