"use client";

import { useState, useCallback, useEffect } from "react";

interface Policy {
  id: string;
  policy_id: string;
  title: string;
  description: string;
  category: string;
  status: "draft" | "active" | "archived";
  version: string;
  effective_date?: string;
  review_date?: string;
  attestation_required: boolean;
  owner_id?: string;
  owner_name?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<Policy["status"], string> = {
  draft: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-500",
};

const CATEGORIES = ["General", "Access Control", "Data Protection", "Incident Response", "Acceptable Use", "Change Management", "Business Continuity", "Vendor Management", "HR Security"];

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isOverdue(date?: string) {
  return date ? new Date(date) < new Date() : false;
}

function isDueSoon(date?: string) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return d >= now && d <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Policy["status"] | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("General");
  const [formVersion, setFormVersion] = useState("1.0");
  const [formEffective, setFormEffective] = useState("");
  const [formReview, setFormReview] = useState("");
  const [formAttestation, setFormAttestation] = useState(false);
  const [formDescription, setFormDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Policy>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/policies");
      const { policies: data, error: apiError } = await res.json();
      if (apiError) throw new Error(apiError);
      setPolicies(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);
  useEffect(() => {
    const handler = () => fetchPolicies();
    window.addEventListener("grc:policy-created", handler);
    return () => window.removeEventListener("grc:policy-created", handler);
  }, [fetchPolicies]);

  const filtered = policies
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) => {
      const q = search.toLowerCase();
      return !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.policy_id.toLowerCase().includes(q);
    });

  const stats = {
    total: policies.length,
    active: policies.filter((p) => p.status === "active").length,
    draft: policies.filter((p) => p.status === "draft").length,
    overdueReview: policies.filter((p) => isOverdue(p.review_date)).length,
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) { setCreateError("Title is required"); return; }
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: formTitle, category: formCategory, version: formVersion, effective_date: formEffective || null, review_date: formReview || null, attestation_required: formAttestation, description: formDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed");
      setShowCreate(false);
      setFormTitle(""); setFormCategory("General"); setFormVersion("1.0"); setFormEffective(""); setFormReview(""); setFormAttestation(false); setFormDescription("");
      await fetchPolicies();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(p: Policy) {
    setEditing(true);
    setEditForm({ title: p.title, description: p.description, category: p.category, status: p.status, version: p.version, effective_date: p.effective_date, review_date: p.review_date, attestation_required: p.attestation_required });
    setSaveError("");
  }

  async function handleSave(id: string) {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/policies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed");
      setEditing(false);
      await fetchPolicies();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/policies/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setExpandedId(null);
      await fetchPolicies();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Policies</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your organization's policies and procedures</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          + Add Policy
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total },
          { label: "Active", value: stats.active, cls: "text-green-600" },
          { label: "Draft", value: stats.draft, cls: "text-yellow-600" },
          { label: "Review Overdue", value: stats.overdueReview, cls: stats.overdueReview > 0 ? "text-red-600" : "" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <div className={`text-3xl font-bold ${cls ?? ""}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search policies…"
          className="px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-52"
        />
        <div className="flex gap-1">
          {(["all", "active", "draft", "archived"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s as Policy["status"] | "all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${statusFilter === s ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-accent"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading policies…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <p className="text-4xl mb-3">📜</p>
          <p className="text-lg font-medium">No policies yet</p>
          <p className="text-sm mt-1">Use the GRC Copilot to create your first policy, or click "+ Add Policy"</p>
          <p className="text-xs mt-3 opacity-60">Try: "Create an acceptable use policy"</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Version</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Review Date</th>
                <th className="text-left p-3">Attestation</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <>
                  <tr
                    key={p.id}
                    onClick={() => { setExpandedId(expandedId === p.id ? null : p.id); setEditing(false); }}
                    className={`cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"} ${expandedId === p.id ? "bg-primary/5" : "hover:bg-muted/30"}`}
                  >
                    <td className="p-3 font-mono text-xs text-muted-foreground">{p.policy_id}</td>
                    <td className="p-3 font-medium">{p.title}</td>
                    <td className="p-3 text-muted-foreground">{p.category}</td>
                    <td className="p-3 text-muted-foreground">v{p.version}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                    </td>
                    <td className={`p-3 text-xs ${isOverdue(p.review_date) ? "text-red-600 font-semibold" : isDueSoon(p.review_date) ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
                      {fmtDate(p.review_date)}
                      {isOverdue(p.review_date) && " ⚠"}
                      {isDueSoon(p.review_date) && " ⏰"}
                    </td>
                    <td className="p-3 text-center">{p.attestation_required ? "✅" : "—"}</td>
                  </tr>
                  {expandedId === p.id && (
                    <tr key={`${p.id}-detail`} className="bg-primary/5">
                      <td colSpan={7} className="p-5 border-t">
                        {!editing ? (
                          <div className="space-y-3">
                            {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                              <span>Owner: {p.owner_name || "Unassigned"}</span>
                              <span>Effective: {fmtDate(p.effective_date)}</span>
                              <span>Created: {fmtDate(p.created_at)}</span>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => startEdit(p)} className="px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent transition-colors">Edit</button>
                              <button onClick={() => handleDelete(p.id, p.title)} disabled={deleting} className="px-3 py-1.5 rounded-md border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50">Delete</button>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={(e) => { e.preventDefault(); handleSave(p.id); }} className="space-y-3 max-w-lg">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Title *</label>
                                <input value={editForm.title ?? ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Category</label>
                                <select value={editForm.category ?? "General"} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Status</label>
                                <select value={editForm.status ?? "draft"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Policy["status"] })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                  <option value="draft">Draft</option>
                                  <option value="active">Active</option>
                                  <option value="archived">Archived</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Version</label>
                                <input value={editForm.version ?? "1.0"} onChange={(e) => setEditForm({ ...editForm, version: e.target.value })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Review Date</label>
                                <input type="date" value={editForm.review_date ?? ""} onChange={(e) => setEditForm({ ...editForm, review_date: e.target.value || null as unknown as string })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Effective Date</label>
                                <input type="date" value={editForm.effective_date ?? ""} onChange={(e) => setEditForm({ ...editForm, effective_date: e.target.value || null as unknown as string })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Description</label>
                              <textarea rows={2} value={editForm.description ?? ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                            </div>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input type="checkbox" checked={editForm.attestation_required ?? false} onChange={(e) => setEditForm({ ...editForm, attestation_required: e.target.checked })} className="rounded" />
                              Requires employee attestation
                            </label>
                            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                            <div className="flex gap-2">
                              <button type="submit" disabled={saving} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {saving ? "Saving…" : "Save Changes"}
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

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="bg-card rounded-xl border shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Add Policy</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title *</label>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Acceptable Use Policy"
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Version</label>
                  <input value={formVersion} onChange={(e) => setFormVersion(e.target.value)} placeholder="1.0"
                    className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Effective Date</label>
                  <input type="date" value={formEffective} onChange={(e) => setFormEffective(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Review Date</label>
                  <input type="date" value={formReview} onChange={(e) => setFormReview(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea rows={3} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="What does this policy cover?"
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={formAttestation} onChange={(e) => setFormAttestation(e.target.checked)} className="rounded" />
                Requires employee attestation
              </label>
              {createError && <p className="text-xs text-red-600">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={creating} className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {creating ? "Creating…" : "Create Policy"}
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
