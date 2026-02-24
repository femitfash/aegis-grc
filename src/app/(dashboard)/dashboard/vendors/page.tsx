"use client";

import { useState, useCallback, useEffect } from "react";

interface Vendor {
  id: string;
  name: string;
  category: string;
  tier: "critical" | "high" | "medium" | "low";
  status: "active" | "under_review" | "approved" | "suspended";
  contact_name: string;
  contact_email: string;
  website: string;
  contract_expiry?: string;
  risk_score: number;
  last_assessed_at?: string;
  notes: string;
  created_at: string;
}

const TIER_COLORS: Record<Vendor["tier"], string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

const STATUS_COLORS: Record<Vendor["status"], string> = {
  active: "bg-green-100 text-green-700",
  under_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  suspended: "bg-red-100 text-red-700",
};

const CATEGORIES = ["Technology", "Cloud", "SaaS", "Professional Services", "Infrastructure", "Security", "Payroll", "Legal", "Marketing", "Other"];

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function scoreBand(score: number): Vendor["tier"] {
  if (score >= 15) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

function isContractExpired(d?: string) { return d ? new Date(d) < new Date() : false; }
function isContractExpiringSoon(d?: string) {
  if (!d) return false;
  const dt = new Date(d);
  const now = new Date();
  return dt >= now && dt <= new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<Vendor["tier"] | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Technology");
  const [formTier, setFormTier] = useState<Vendor["tier"]>("medium");
  const [formContactName, setFormContactName] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [formExpiry, setFormExpiry] = useState("");
  const [formRiskScore, setFormRiskScore] = useState(5);
  const [formNotes, setFormNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Vendor>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vendors");
      const { vendors: data, error: apiError } = await res.json();
      if (apiError) throw new Error(apiError);
      setVendors(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const filtered = vendors
    .filter((v) => tierFilter === "all" || v.tier === tierFilter)
    .filter((v) => {
      const q = search.toLowerCase();
      return !q || v.name.toLowerCase().includes(q) || v.category.toLowerCase().includes(q);
    });

  const stats = {
    total: vendors.length,
    critical: vendors.filter((v) => v.tier === "critical").length,
    high: vendors.filter((v) => v.tier === "high").length,
    expiringContracts: vendors.filter((v) => isContractExpiringSoon(v.contract_expiry) || isContractExpired(v.contract_expiry)).length,
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) { setCreateError("Name is required"); return; }
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, category: formCategory, tier: formTier, contact_name: formContactName, contact_email: formContactEmail, website: formWebsite, contract_expiry: formExpiry || null, risk_score: formRiskScore, notes: formNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed");
      setShowCreate(false);
      setFormName(""); setFormCategory("Technology"); setFormTier("medium"); setFormContactName(""); setFormContactEmail(""); setFormWebsite(""); setFormExpiry(""); setFormRiskScore(5); setFormNotes("");
      await fetchVendors();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(v: Vendor) {
    setEditing(true);
    setEditForm({ name: v.name, category: v.category, tier: v.tier, status: v.status, contact_name: v.contact_name, contact_email: v.contact_email, website: v.website, contract_expiry: v.contract_expiry, risk_score: v.risk_score, notes: v.notes });
    setSaveError("");
  }

  async function handleSave(id: string) {
    setSaving(true); setSaveError("");
    try {
      const res = await fetch(`/api/vendors/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed");
      setEditing(false);
      await fetchVendors();
    } catch (err) { setSaveError(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/vendors/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setExpandedId(null);
      await fetchVendors();
    } catch (err) { alert(err instanceof Error ? err.message : "Failed to delete"); }
    finally { setDeleting(false); }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Vendors</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track third-party vendor risk and contract status</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          + Add Vendor
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Vendors", value: stats.total },
          { label: "Critical Tier", value: stats.critical, cls: stats.critical > 0 ? "text-red-600" : "" },
          { label: "High Tier", value: stats.high, cls: stats.high > 0 ? "text-orange-600" : "" },
          { label: "Contract Alerts", value: stats.expiringContracts, cls: stats.expiringContracts > 0 ? "text-amber-600" : "" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <div className={`text-3xl font-bold ${cls ?? ""}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors…"
          className="px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-52" />
        <div className="flex gap-1">
          {(["all", "critical", "high", "medium", "low"] as const).map((t) => (
            <button key={t} onClick={() => setTierFilter(t as Vendor["tier"] | "all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${tierFilter === t ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-accent"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading vendors…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <p className="text-4xl mb-3">🏢</p>
          <p className="text-lg font-medium">No vendors yet</p>
          <p className="text-sm mt-1">Use the GRC Copilot or click "+ Add Vendor" to add your first third-party vendor</p>
          <p className="text-xs mt-3 opacity-60">Try: "Add AWS as a critical cloud vendor"</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">Vendor</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Tier</th>
                <th className="text-left p-3">Risk Score</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Contract Expiry</th>
                <th className="text-left p-3">Last Assessed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <>
                  <tr key={v.id} onClick={() => { setExpandedId(expandedId === v.id ? null : v.id); setEditing(false); }}
                    className={`cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"} ${expandedId === v.id ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                    <td className="p-3 font-medium">{v.name}</td>
                    <td className="p-3 text-muted-foreground">{v.category}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TIER_COLORS[v.tier]}`}>{v.tier}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_COLORS[scoreBand(v.risk_score)]}`}>{v.risk_score}/25</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[v.status]}`}>{v.status.replace("_", " ")}</span>
                    </td>
                    <td className={`p-3 text-xs ${isContractExpired(v.contract_expiry) ? "text-red-600 font-semibold" : isContractExpiringSoon(v.contract_expiry) ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
                      {fmtDate(v.contract_expiry)}
                      {isContractExpired(v.contract_expiry) && " ⚠"}
                      {isContractExpiringSoon(v.contract_expiry) && " ⏰"}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{fmtDate(v.last_assessed_at)}</td>
                  </tr>
                  {expandedId === v.id && (
                    <tr key={`${v.id}-detail`} className="bg-primary/5">
                      <td colSpan={7} className="p-5 border-t">
                        {!editing ? (
                          <div className="space-y-3">
                            {v.notes && <p className="text-sm text-muted-foreground">{v.notes}</p>}
                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                              {v.contact_name && <span>Contact: {v.contact_name}{v.contact_email ? ` (${v.contact_email})` : ""}</span>}
                              {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{v.website}</a>}
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => startEdit(v)} className="px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent transition-colors">Edit</button>
                              <button onClick={() => handleDelete(v.id, v.name)} disabled={deleting} className="px-3 py-1.5 rounded-md border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50">Delete</button>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={(e) => { e.preventDefault(); handleSave(v.id); }} className="space-y-3 max-w-lg">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Name *</label>
                                <input value={editForm.name ?? ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Category</label>
                                <select value={editForm.category ?? "Technology"} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Tier</label>
                                <select value={editForm.tier ?? "medium"} onChange={(e) => setEditForm({ ...editForm, tier: e.target.value as Vendor["tier"] })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                  <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Status</label>
                                <select value={editForm.status ?? "active"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as Vendor["status"] })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                  <option value="active">Active</option><option value="under_review">Under Review</option><option value="approved">Approved</option><option value="suspended">Suspended</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Risk Score (1-25)</label>
                                <input type="number" min={1} max={25} value={editForm.risk_score ?? 5} onChange={(e) => setEditForm({ ...editForm, risk_score: Number(e.target.value) })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Contract Expiry</label>
                                <input type="date" value={editForm.contract_expiry ?? ""} onChange={(e) => setEditForm({ ...editForm, contract_expiry: e.target.value || null as unknown as string })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Contact Name</label>
                                <input value={editForm.contact_name ?? ""} onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Contact Email</label>
                                <input type="email" value={editForm.contact_email ?? ""} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                                  className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Notes</label>
                              <textarea rows={2} value={editForm.notes ?? ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                className="mt-1 w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
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
            <h2 className="text-lg font-semibold mb-4">Add Vendor</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vendor Name *</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Amazon Web Services"
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
                  <label className="text-xs font-medium text-muted-foreground">Risk Tier</label>
                  <select value={formTier} onChange={(e) => setFormTier(e.target.value as Vendor["tier"])}
                    className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Risk Score (1-25)</label>
                  <input type="number" min={1} max={25} value={formRiskScore} onChange={(e) => setFormRiskScore(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Contract Expiry</label>
                  <input type="date" value={formExpiry} onChange={(e) => setFormExpiry(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Contact Name</label>
                  <input value={formContactName} onChange={(e) => setFormContactName(e.target.value)} placeholder="Jane Smith"
                    className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Contact Email</label>
                  <input type="email" value={formContactEmail} onChange={(e) => setFormContactEmail(e.target.value)} placeholder="jane@vendor.com"
                    className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Website</label>
                <input value={formWebsite} onChange={(e) => setFormWebsite(e.target.value)} placeholder="https://vendor.com"
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea rows={2} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Any notes about this vendor..."
                  className="mt-1 w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              {createError && <p className="text-xs text-red-600">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={creating} className="flex-1 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {creating ? "Adding…" : "Add Vendor"}
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
