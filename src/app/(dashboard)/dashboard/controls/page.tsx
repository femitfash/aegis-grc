"use client";

import { useState, useEffect, useCallback } from "react";
import { ConfirmModal } from "@/shared/components/modals";

interface Control {
  id: string;
  code: string;
  title: string;
  type: string;
  automation: string;
  effectiveness: number; // 1-5
  status: string;
  owner: string;
  frameworks: string[];
}

const TYPE_COLORS: Record<string, string> = {
  technical: "bg-blue-100 text-blue-700",
  administrative: "bg-purple-100 text-purple-700",
  operational: "bg-orange-100 text-orange-700",
  physical: "bg-gray-100 text-gray-700",
  preventive: "bg-blue-100 text-blue-700",
  detective: "bg-yellow-100 text-yellow-700",
  corrective: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  implemented: "bg-green-100 text-green-700",
  active: "bg-green-100 text-green-700",
  testing: "bg-blue-100 text-blue-700",
  planned: "bg-yellow-100 text-yellow-700",
  draft: "bg-yellow-100 text-yellow-700",
  "not-started": "bg-gray-100 text-gray-600",
  deprecated: "bg-gray-100 text-gray-500",
};

const STATUS_DISPLAY: Record<string, string> = {
  implemented: "Implemented",
  active: "Implemented",
  testing: "Testing",
  planned: "Planned",
  draft: "Planned",
  "not-started": "Not Started",
  deprecated: "Deprecated",
};

const AUTO_ICONS: Record<string, string> = {
  automated: "🤖",
  "semi-automated": "⚡",
  manual: "👤",
};

function EffectivenessBar({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-sm ${i <= value ? "bg-primary" : "bg-muted"}`}
        />
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbControl(row: any): Control {
  return {
    id: row.id,
    code: row.code || "?",
    title: row.title || "Untitled Control",
    type: row.control_type || "technical",
    automation: row.automation_level || "manual",
    effectiveness: row.effectiveness_rating || 1,
    status: row.status || "draft",
    owner: row.owner_name || "Unassigned",
    frameworks: Array.isArray(row.metadata?.frameworks) ? row.metadata.frameworks : [],
  };
}

// ─── Edit Control Panel ───────────────────────────────────────────────────────

function EditControlPanel({
  control,
  onClose,
  onSaved,
}: {
  control: Control;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: control.title,
    control_type: control.type,
    automation_level: control.automation,
    effectiveness_rating: control.effectiveness,
    status: control.status,
    frameworks: control.frameworks.join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/controls/${control.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          control_type: form.control_type,
          automation_level: form.automation_level,
          effectiveness_rating: Number(form.effectiveness_rating),
          status: form.status,
          frameworks: form.frameworks.split(",").map((f) => f.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed to update");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setConfirmModal({
      title: "Delete Control",
      message: `Delete control "${control.title}"? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        setDeleting(true);
        setDeleteError("");
        try {
          const res = await fetch(`/api/controls/${control.id}`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || data.error || "Failed to delete");
          onSaved();
          onClose();
        } catch (err) {
          setDeleteError(err instanceof Error ? err.message : "Failed to delete");
          setDeleting(false);
        }
      },
    });
  };

  return (
  <>
    <tr>
      <td colSpan={9} className="p-0">
        <div className="bg-muted/20 border-b px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Edit Control: {control.code}</h4>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1 rounded-md border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1 rounded-md border text-xs hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          {deleteError && <p className="text-xs text-destructive mb-2">{deleteError}</p>}
          <form onSubmit={handleSave} className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="draft">Planned</option>
                <option value="testing">Testing</option>
                <option value="implemented">Implemented</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <select
                value={form.control_type}
                onChange={(e) => setForm({ ...form, control_type: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {["technical", "administrative", "operational", "physical", "preventive", "detective", "corrective"].map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Automation</label>
              <select
                value={form.automation_level}
                onChange={(e) => setForm({ ...form, automation_level: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="manual">Manual</option>
                <option value="semi-automated">Semi-automated</option>
                <option value="automated">Automated</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Effectiveness (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={form.effectiveness_rating}
                onChange={(e) => setForm({ ...form, effectiveness_rating: Number(e.target.value) })}
                className="w-full px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="col-span-3 sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Frameworks (comma-separated)</label>
              <input
                type="text"
                value={form.frameworks}
                onChange={(e) => setForm({ ...form, frameworks: e.target.value })}
                className="w-full px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="col-span-3">
              {error && <p className="text-xs text-destructive mb-2">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </td>
    </tr>
    {confirmModal && (
      <ConfirmModal title={confirmModal.title} message={confirmModal.message} confirmLabel="Delete" confirmVariant="danger" onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)} />
    )}
  </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ControlsPage() {
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [frameworkFilter, setFrameworkFilter] = useState("all");
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);

  // Add control form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState("technical");
  const [formAutomation, setFormAutomation] = useState("manual");
  const [formEffectiveness, setFormEffectiveness] = useState(3);
  const [formStatus, setFormStatus] = useState("draft");
  const [formFrameworks, setFormFrameworks] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchControls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/controls");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { controls: data, error: apiError } = await res.json();
      if (apiError) console.warn("Controls API warning:", apiError);
      setControls((data || []).map(mapDbControl));
    } catch (err) {
      console.error("Failed to fetch controls:", err);
      setError("Could not load controls. Check the console for details.");
      setControls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchControls();
  }, [fetchControls]);

  // Refresh when copilot creates a control
  useEffect(() => {
    const handler = () => fetchControls();
    window.addEventListener("grc:control-created", handler);
    return () => window.removeEventListener("grc:control-created", handler);
  }, [fetchControls]);

  const handleAddControl = useCallback(async () => {
    if (!formTitle.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formCode.trim() || undefined,
          title: formTitle.trim(),
          control_type: formType,
          automation_level: formAutomation,
          effectiveness_rating: formEffectiveness,
          status: formStatus,
          frameworks: formFrameworks.split(",").map((f) => f.trim()).filter(Boolean),
          description: formDescription.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Failed");
      // Reset and refresh
      setFormTitle(""); setFormCode(""); setFormDescription("");
      setFormFrameworks(""); setFormEffectiveness(3);
      setFormType("technical"); setFormAutomation("manual"); setFormStatus("draft");
      setShowAddForm(false);
      fetchControls();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create control");
    } finally {
      setSubmitting(false);
    }
  }, [formTitle, formCode, formType, formAutomation, formEffectiveness, formStatus, formFrameworks, formDescription, fetchControls]);

  const allFrameworks = [
    ...new Set(controls.flatMap((c) => c.frameworks)),
  ].filter(Boolean);

  const filtered = controls.filter((c) => {
    if (statusFilter !== "all") {
      // Normalize: "active" and "implemented" both count as "implemented"
      const normalized = c.status === "active" ? "implemented" : c.status === "draft" ? "planned" : c.status;
      if (normalized !== statusFilter) return false;
    }
    if (frameworkFilter !== "all" && !c.frameworks.includes(frameworkFilter)) return false;
    if (
      search &&
      !c.title.toLowerCase().includes(search.toLowerCase()) &&
      !c.code.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const stats = {
    total: controls.length,
    implemented: controls.filter((c) => c.status === "implemented" || c.status === "active").length,
    testing: controls.filter((c) => c.status === "testing").length,
    automated: controls.filter((c) => c.automation === "automated").length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Control Library</h1>
          <p className="text-muted-foreground mt-1">
            Manage your security and compliance controls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchControls}
            disabled={loading}
            className="px-3 py-2 rounded-md border text-sm hover:bg-accent transition-colors disabled:opacity-50"
            title="Refresh"
          >
            {loading ? "⟳" : "↻"} Refresh
          </button>
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            onClick={() => setShowAddForm((v) => !v)}
          >
            {showAddForm ? "✕ Cancel" : "+ Add Control"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Controls", value: stats.total, color: "text-foreground" },
          { label: "Implemented", value: stats.implemented, color: "text-green-600" },
          { label: "Testing", value: stats.testing, color: "text-blue-600" },
          { label: "Automated", value: stats.automated, color: "text-purple-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 rounded-lg border bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>
              {loading ? <span className="text-muted-foreground">—</span> : value}
            </p>
          </div>
        ))}
      </div>

      {/* Add Control Form */}
      {showAddForm && (
        <div className="mb-6 p-5 rounded-lg border bg-card">
          <h2 className="font-semibold mb-4">New Control</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Multi-Factor Authentication"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Code <span className="text-muted-foreground">(optional)</span></label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="Auto-generated"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none"
              >
                {["technical", "administrative", "operational", "physical", "preventive", "detective", "corrective"].map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Automation</label>
              <select
                value={formAutomation}
                onChange={(e) => setFormAutomation(e.target.value)}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none"
              >
                <option value="manual">Manual</option>
                <option value="semi-automated">Semi-automated</option>
                <option value="automated">Automated</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none"
              >
                <option value="draft">Planned</option>
                <option value="testing">Testing</option>
                <option value="implemented">Implemented</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Effectiveness (1–5)</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={formEffectiveness}
                  onChange={(e) => setFormEffectiveness(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-semibold w-4">{formEffectiveness}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Frameworks <span className="text-muted-foreground">(comma-separated)</span></label>
              <input
                type="text"
                value={formFrameworks}
                onChange={(e) => setFormFrameworks(e.target.value)}
                placeholder="SOC2, ISO27001, NIST_CSF"
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Description <span className="text-muted-foreground">(optional)</span></label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                placeholder="What this control does..."
                className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>
          {submitError && (
            <p className="mt-3 text-sm text-red-600">{submitError}</p>
          )}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddControl}
              disabled={submitting || !formTitle.trim()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Saving..." : "Save Control"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 rounded-md bg-orange-50 border border-orange-200 text-sm text-orange-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search controls..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-56"
        />
        <div className="flex gap-1">
          {(["all", "implemented", "testing", "planned", "not-started"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground" : "border hover:bg-accent"
              }`}
            >
              {s === "all" ? "All" : s.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
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
                  frameworkFilter === f
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "border hover:bg-accent"
                }`}
              >
                {f === "all" ? "All Frameworks" : f}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {loading ? "Loading..." : `${filtered.length} of ${controls.length} controls`}
        </span>
      </div>

      {/* Table / Empty / Loading */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading controls...</p>
          </div>
        ) : controls.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-4xl mb-3">🛡️</p>
            <p className="text-lg font-medium">No controls in your library yet</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">
              Use the GRC Copilot to add controls — describe the control and it will be structured for you.
            </p>
            <p className="text-xs mt-3 text-muted-foreground/60">
              Try: &quot;Add a control for multi-factor authentication&quot;
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-20">Code</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Control Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Automation</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Effectiveness</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Frameworks</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Owner</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((control, i) => (
                <>
                  <tr
                    key={control.id}
                    onClick={() => setSelectedControlId((prev) => prev === control.id ? null : control.id)}
                    className={`border-b hover:bg-accent/30 cursor-pointer transition-colors ${
                      selectedControlId === control.id ? "bg-primary/5" : i % 2 === 0 ? "" : "bg-muted/10"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold">
                      <span className="flex items-center gap-1">
                        {control.code}
                        <span className="text-[10px] text-muted-foreground/50">
                          {selectedControlId === control.id ? "▲" : "▼"}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{control.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                          TYPE_COLORS[control.type] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {control.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs">
                        <span>{AUTO_ICONS[control.automation] || "👤"}</span>
                        <span className="text-muted-foreground capitalize">
                          {control.automation.replace("-", " ")}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <EffectivenessBar value={control.effectiveness} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[control.status] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_DISPLAY[control.status] ||
                          control.status.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {control.frameworks.length > 0 ? (
                          control.frameworks.map((f) => (
                            <span
                              key={f}
                              className="px-1.5 py-0.5 rounded text-xs bg-secondary text-secondary-foreground"
                            >
                              {f}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{control.owner}</td>
                  </tr>
                  {selectedControlId === control.id && (
                    <EditControlPanel
                      key={`edit-${control.id}`}
                      control={control}
                      onClose={() => setSelectedControlId(null)}
                      onSaved={() => {
                        setSelectedControlId(null);
                        fetchControls();
                      }}
                    />
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}

        {!loading && controls.length > 0 && filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground border-t">
            <p className="text-lg">No controls match your filter</p>
            <p className="text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
