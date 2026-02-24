"use client";

import { useState, useCallback, useEffect } from "react";

interface Incident {
  id: string;
  incident_id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "detected" | "contained" | "resolved" | "post_mortem" | "closed";
  discovered_at: string;
  contained_at?: string;
  resolved_at?: string;
  impact: string;
  affected_systems: string;
  root_cause: string;
  owner_id?: string;
  owner_name?: string;
  created_at: string;
}

const SEVERITY_COLORS: Record<Incident["severity"], string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

const STATUS_COLORS: Record<Incident["status"], string> = {
  detected: "bg-red-100 text-red-700",
  contained: "bg-orange-100 text-orange-700",
  resolved: "bg-green-100 text-green-700",
  post_mortem: "bg-blue-100 text-blue-700",
  closed: "bg-gray-100 text-gray-500",
};

const OPEN_STATUSES = ["detected", "contained", "post_mortem"];

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function mttrHours(discovered: string, resolved?: string): string {
  if (!resolved) return "—";
  const h = Math.round((new Date(resolved).getTime() - new Date(discovered).getTime()) / (1000 * 60 * 60));
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Incident["severity"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [formTitle, setFormTitle] = useState("");
  const [formSeverity, setFormSeverity] = useState<Incident["severity"]>("medium");
  const [formDiscovered, setFormDiscovered] = useState("");
  const [formImpact, setFormImpact] = useState("");
  const [formAffected, setFormAffected] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Incident>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/incidents");
      const { incidents: data, error: apiError } = await res.json();
      if (apiError) throw new Error(apiError);
      setIncidents(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);
  useEffect(() => {
    const handler = () => fetchIncidents();
    window.addEventListener("grc:incident-created", handler);
    return () => window.removeEventListener("grc:incident-created", handler);
  }, [fetchIncidents]);

  const filtered = incidents
    .filter((i) => severityFilter === "all" || i.severity === severityFilter)
    .filter((i) => {
      if (statusFilter === "open") return OPEN_STATUSES.includes(i.status);
      if (statusFilter === "closed") return i.status === "resolved" || i.status === "closed";
      return true;
    })
    .filter((i) => {
      const q = search.toLowerCase();
      return !q || i.title.toLowerCase().includes(q) || i.incident_id.toLowerCase().includes(q);
    });

  const stats = {
    total: incidents.length,
    open: incidents.filter((i) => OPEN_STATUSES.includes(i.status)).length,
    critical: incidents.filter((i) => i.severity === "critical").length,
    resolved: incidents.filter((i) => i.status === "resolved" || i.status === "closed").length,
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) { setCreateError("Title is required"); return; }
    setCreating(true); setCreateError("");
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: formTitle, severity: formSeverity, discovered_at: formDiscovered || null, impact: formImpact, affected_systems: formAffected, description: formDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed");
      setShowCreate(false);
      setFormTitle(""); setFormSeverity("medium"); setFormDiscovered(""); setFormImpact(""); setFormAffected(""); setFormDescription("");
      await fetchIncidents();
    } catch (err) { setCreateError(err instanceof Error ? err.message : "Failed"); }
    finally { setCreating(false); }
  }

  function startEdit(i: Incident) {
    setEditing(true);
    setEditForm({ title: i.title, description: i.description, severity: i.severity, status: i.status, impact: i.impact, affected_systems: i.affected_systems, root_cause: i.root_cause, discovered_at: i.discovered_at, contained_at: i.contained_at, resolved_at: i.resolved_at });
    setSaveError("");
  }

  async function handleSave(id: string) {
    setSaving(true); setSaveError("");
    try {
      const res = await fetch(`/api/incidents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed");
      setEditing(false);
      await fetchIncidents();
    } catch (err) { setSaveError(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/incidents/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setExpandedId(null);
      await fetchIncidents();
    } catch (err) { alert(err instanceof Error ? err.message : "Failed to delete"); }
    finally { setDeleting(false); }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Incidents</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track and manage security incidents and remediation</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          + Log Incident
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total },
          { label: "Open", value: stats.open, cls: stats.open > 0 ? "text-orange-600" : "" },
          { label: "Critical", value: stats.critical, cls: stats.critical > 0 ? "text-red-600" : "" },
          { label: "Resolved", value: stats.resolved, cls: "text-green-600" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <div className={`text-3xl font-bold ${cls ?? ""}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search incidents…"
          className="px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-52" />
        <div className="flex gap-1">
          {(["all", "open", "closed"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${statusFilter === s ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-accent"}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["all", "critical", "high", "medium", "low"] as const).map((sev) => (
            <button key={sev} onClick={() => setSeverityFilter(sev as Incident["severity"] | "all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${severityFilter === sev ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-accent"}`}>
              {sev}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading incidents…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <p className="text-4xl mb-3">🚨</p>
          <p className="text-lg font-medium">{incidents.length === 0 ? "No incidents logged" : "No incidents match filters"}</p>
          <p className="text-sm mt-1">
            {incidents.length === 0 ? 'Use the GRC Copilot or click "+ Log Incident" to record a security incident' : "Clear filters to see all incidents"}
          </p>
          {incidents.length === 0 && <p className="text-xs mt-3 opacity-60">Try: "Log a critical incident: our database credentials were exposed"</p>}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">Severity</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Discovered</th>
                <th className="text-left p-3">MTTR</th>
                <th className="text-left p-3">Owner</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inc, i) => (
                <>
                  <tr key={inc.id} onClick={() => { setExpandedId(expandedId === inc.id ? null : inc.id); setEditing(false); }}
                    className={`cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"} ${expandedId === inc.id ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{inc.incident_id}</td>
                    <td className="p-3 font-medium">{inc.title}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${SEVERITY_COLORS[inc.severity]}`}>{inc.severity}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[inc.status]}`}>{inc.status.replace("_", " ")}</span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{fmtDate(inc.discovered_at)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{mttrHours(inc.discovered_at, inc.resolved_at)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{inc.owner_name || "—"}</td>
                  </tr>
                  {expandedId === inc.id && (
                    <tr key={`${inc.id}-detail`} className="bg-primary/5">
                      <td colSpan={7} className="p-5 border-t">
                        {!editing ? (
                          <div className="space-y-3">
                            {inc.description && <p className="text-sm text-muted-foreground">{inc.description}</p>}
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted-foreground">
                              {inc.impact && <div><span className="font-medium text-foreground">Impact:</span> {inc.impact}</div>}
                              {inc.affected_systems && <div><span className="font-medium text-foreground">Affected Systems:</span> {inc.affected_systems}</div>}
                              {inc.root_cause && <div className="col-span-2"><span className="font-medium text-foreground">Root Cause:</span> {inc.root_cause}</div>}
                              <div><span className="font-medium text-foreground">Contained:</span> {fmtDate(inc.contained_at)}</div>
                              <div><span className="font-medium text-foreground">Resolved:</span> {fmtDate(inc.resolved_at)}</div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => startEdit(inc)} className="px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent transition-colors">Edit</button>
                              <button onClick={() => handleDelete(inc.id, inc.title)} disabled={deleting} className="px-3 py-1.5 rounded-md border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50">Delete</button>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={(e) => { e.preventDefault(); handleSave(inc.id); }} className="space-y-3 max-w-2xl">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground">Title *</label>
                                <input value={editForm.title ?? ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Severity</label>
                                <select value={editForm.severity ?? "medium"} onChange={(e) => setEditForm({ ...editForm, severity: e.target.value as Incident["severity"] })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                  <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Status</label>
                                <select value={editForm.status ?? "detected"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Incident["status"] })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                  <option value="detected">Detected</option><option value="contained">Contained</option><option value="resolved">Resolved</option><option value="post_mortem">Post Mortem</option><option value="closed">Closed</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Contained At</label>
                                <input type="datetime-local" value={editForm.contained_at ? editForm.contained_at.slice(0, 16) : ""} onChange={(e) => setEditForm({ ...editForm, contained_at: e.target.value || null as unknown as string })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Resolved At</label>
                                <input type="datetime-local" value={editForm.resolved_at ? editForm.resolved_at.slice(0, 16) : ""} onChange={(e) => setEditForm({ ...editForm, resolved_at: e.target.value || null as unknown as string })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                              <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground">Impact</label>
                                <input value={editForm.impact ?? ""} onChange={(e) => setEditForm({ ...editForm, impact: e.target.value })} placeholder="What was the business impact?"
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                              <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground">Affected Systems</label>
                                <input value={editForm.affected_systems ?? ""} onChange={(e) => setEditForm({ ...editForm, affected_systems: e.target.value })} placeholder="e.g. prod-db, auth-service"
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                              <div className="col-span-2">
                                <label className="text-xs font-medium text-muted-foreground">Root Cause</label>
                                <textarea rows={2} value={editForm.root_cause ?? ""} onChange={(e) => setEditForm({ ...editForm, root_cause: e.target.value })} placeholder="Root cause analysis..."
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                              </div>
                            </div>
                            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                            <div className="flex gap-2">
                              <button type="submit" disabled={saving} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {saving ? "Saving…" : "Save"}
                              </button>
                              <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent transition-colors">Cancel</button>
                            </div>
                          </form>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="bg-card rounded-xl border shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Log Incident</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title *</label>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Database credentials exposed in logs"
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Severity</label>
                  <select value={formSeverity} onChange={(e) => setFormSeverity(e.target.value as Incident["severity"])}
                    className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Discovered At</label>
                  <input type="datetime-local" value={formDiscovered} onChange={(e) => setFormDiscovered(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Impact</label>
                <input value={formImpact} onChange={(e) => setFormImpact(e.target.value)} placeholder="e.g. Unauthorized access to customer data"
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Affected Systems</label>
                <input value={formAffected} onChange={(e) => setFormAffected(e.target.value)} placeholder="e.g. prod-db, auth-service, API gateway"
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea rows={3} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Describe what happened..."
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              {createError && <p className="text-xs text-red-600">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={creating} className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {creating ? "Logging…" : "Log Incident"}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
