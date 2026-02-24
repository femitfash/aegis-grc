"use client";

import { useState, useEffect, useCallback } from "react";

interface Evidence {
  id: string;
  evidenceId: string;
  title: string;
  description: string;
  sourceType: "manual" | "automated" | "integration";
  controlCode: string;
  sourceUrl: string;
  status: "collected" | "pending" | "overdue" | "stale" | "rejected";
  collectedAt: string;
  collector: string;
  frameworks: string[];
}

const STATUS_COLORS: Record<Evidence["status"], string> = {
  collected: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  stale: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  rejected: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_ICONS: Record<Evidence["status"], string> = {
  collected: "✅", pending: "⏳", overdue: "🚨", stale: "⚠️", rejected: "❌",
};

const SOURCE_ICONS: Record<Evidence["sourceType"], string> = {
  manual: "👤", automated: "🤖", integration: "🔗",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbEvidence(row: any): Evidence {
  const meta = row.metadata || {};
  return {
    id: row.id,
    evidenceId: row.evidence_id || `EVD-${row.id?.slice(0, 6).toUpperCase()}`,
    title: row.title || "Untitled Evidence",
    description: row.description || "",
    sourceType: row.source_type || "manual",
    controlCode: row.control_code || "",
    sourceUrl: row.source_url || "",
    status: row.status || "collected",
    collectedAt: (row.collected_at || row.created_at || "").slice(0, 10),
    collector: row.collector_name || row.collected_by || "Team member",
    frameworks: Array.isArray(meta.frameworks) ? meta.frameworks : [],
  };
}

// ─── Create Evidence Dialog ───────────────────────────────────────────────────

function CreateEvidenceDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<{
    title: string;
    description: string;
    source_type: Evidence["sourceType"];
    source_url: string;
    control_code: string;
    frameworks: string;
  }>({
    title: "",
    description: "",
    source_type: "manual",
    source_url: "",
    control_code: "",
    frameworks: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          frameworks: form.frameworks
            ? form.frameworks.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
            : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed to create");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border rounded-xl shadow-xl w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Create Evidence Record</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Q1 2026 Access Review Report"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Source Type</label>
              <select
                value={form.source_type}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "manual" || v === "automated" || v === "integration") {
                    setForm({ ...form, source_type: v });
                  }
                }}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="manual">Manual</option>
                <option value="automated">Automated</option>
                <option value="integration">Integration</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Control Code</label>
              <input
                type="text"
                value={form.control_code}
                onChange={(e) => setForm({ ...form, control_code: e.target.value })}
                placeholder="e.g. MFA-01"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Source URL</label>
            <input
              type="url"
              value={form.source_url}
              onChange={(e) => setForm({ ...form, source_url: e.target.value })}
              placeholder="https://docs.google.com/... or GitHub PR link"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">Link to the evidence document, report, screenshot, or PR</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Frameworks</label>
            <input
              type="text"
              value={form.frameworks}
              onChange={(e) => setForm({ ...form, frameworks: e.target.value })}
              placeholder="SOC2, ISO27001, NIST"
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this evidence demonstrate?"
              rows={2}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Create Evidence"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [statusFilter, setStatusFilter] = useState<Evidence["status"] | "all">("all");
  const [search, setSearch] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState("all");

  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/evidence");
      const data = await res.json();
      setEvidence((data.evidence || []).map(mapDbEvidence));
    } catch {
      setEvidence([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvidence(); }, [fetchEvidence]);

  useEffect(() => {
    const handler = () => fetchEvidence();
    window.addEventListener("grc:evidence-created", handler);
    return () => window.removeEventListener("grc:evidence-created", handler);
  }, [fetchEvidence]);

  const allFrameworks = Array.from(new Set(evidence.flatMap((e) => e.frameworks))).sort();

  const filtered = evidence.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (frameworkFilter !== "all" && !e.frameworks.includes(frameworkFilter)) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.controlCode.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    collected: evidence.filter((e) => e.status === "collected").length,
    pending: evidence.filter((e) => e.status === "pending").length,
    overdue: evidence.filter((e) => e.status === "overdue").length,
    stale: evidence.filter((e) => e.status === "stale").length,
  };

  return (
    <div>
      {showCreate && (
        <CreateEvidenceDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => { fetchEvidence(); window.dispatchEvent(new CustomEvent("grc:evidence-created")); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Evidence Collection</h1>
          <p className="text-muted-foreground mt-1">
            Collect and manage compliance evidence for your controls
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>('[placeholder="Ask anything about GRC..."]');
              if (input) { input.value = "Create evidence for "; input.focus(); }
            }}
            className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors"
          >
            🤖 Ask Copilot
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + Add Evidence
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Collected", value: stats.collected, color: "text-green-600", icon: "✅" },
          { label: "Pending", value: stats.pending, color: "text-blue-600", icon: "⏳" },
          { label: "Overdue", value: stats.overdue, color: "text-red-600", icon: "🚨" },
          { label: "Stale", value: stats.stale, color: "text-orange-600", icon: "⚠️" },
        ].map(({ label, value, color, icon }) => (
          <div
            key={label}
            className="p-4 rounded-lg border bg-card cursor-pointer hover:bg-accent/30 transition-colors"
            onClick={() => setStatusFilter(label.toLowerCase() as Evidence["status"])}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
              <span>{icon}</span>
            </div>
            <p className={`text-3xl font-bold mt-1 ${color}`}>
              {loading ? <span className="text-muted-foreground">—</span> : value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search evidence..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-56"
        />
        <div className="flex gap-1">
          {(["all", "collected", "pending", "overdue", "stale"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground" : "border hover:bg-accent"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {allFrameworks.length > 0 && (
          <div className="flex gap-1">
            {["all", ...allFrameworks].map((f) => (
              <button
                key={f}
                onClick={() => setFrameworkFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  frameworkFilter === f ? "bg-primary/20 text-primary border border-primary/30" : "border hover:bg-accent"
                }`}
              >
                {f === "all" ? "All Frameworks" : f}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {loading ? "Loading..." : `${filtered.length} items`}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading evidence...</p>
          </div>
        ) : evidence.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-4xl mb-3">📁</p>
            <p className="text-lg font-medium">No evidence records yet</p>
            <p className="text-sm mt-1 max-w-md mx-auto">
              Add your first evidence record — link to a Google Doc, GitHub PR, Confluence page, or any URL that proves a control is working.
            </p>
            <div className="flex gap-3 justify-center mt-4">
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                + Add Evidence
              </button>
              <button
                onClick={() => {
                  const input = document.querySelector<HTMLInputElement>('[placeholder="Ask anything about GRC..."]');
                  if (input) { input.value = "Create evidence for our MFA control"; input.focus(); }
                }}
                className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors"
              >
                🤖 Use Copilot
              </button>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Evidence</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Control</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Collected</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Frameworks</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev, i) => (
                <tr
                  key={ev.id}
                  className={`border-b last:border-0 hover:bg-accent/30 transition-colors ${
                    i % 2 === 0 ? "" : "bg-muted/10"
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{ev.evidenceId}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>📎</span>
                      <div>
                        <p className="font-medium">
                          {ev.sourceUrl ? (
                            <a
                              href={ev.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {ev.title}
                            </a>
                          ) : (
                            ev.title
                          )}
                        </p>
                        {ev.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{ev.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {ev.controlCode ? (
                      <span className="font-mono text-xs font-semibold">{ev.controlCode}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs flex items-center gap-1">
                      <span>{SOURCE_ICONS[ev.sourceType]}</span>
                      <span className="capitalize text-muted-foreground">{ev.sourceType}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{ev.collectedAt}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${STATUS_COLORS[ev.status]}`}>
                      <span>{STATUS_ICONS[ev.status]}</span>
                      {ev.status.charAt(0).toUpperCase() + ev.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {ev.frameworks.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 rounded text-xs bg-secondary text-secondary-foreground">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && evidence.length > 0 && filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground border-t">
            <p className="text-lg">No evidence matches your filter</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
