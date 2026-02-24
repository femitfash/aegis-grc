"use client";

import { useState, useEffect, useCallback } from "react";

interface Risk {
  id: string;     // human-readable risk_id (RISK-XXXXX)
  dbId: string;   // UUID for API calls
  title: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  score: number;
  residualScore: number | null;
  status: "identified" | "assessed" | "mitigated" | "accepted" | "closed";
  treatment: string;
  owner: string;
  updatedAt: string;
}

interface LinkedControl {
  mappingId: string;
  controlId: string;
  code: string;
  title: string;
  control_type: string;
  effectiveness_rating: number;
  status: string;
}

interface OrgControl {
  id: string;
  code: string;
  title: string;
  effectiveness_rating: number;
}

const STATUS_LABELS: Record<Risk["status"], string> = {
  identified: "Identified",
  assessed: "Assessed",
  mitigated: "Mitigated",
  accepted: "Accepted",
  closed: "Closed",
};

const STATUS_COLORS: Record<Risk["status"], string> = {
  identified: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  assessed: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  mitigated: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  accepted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

function RiskScoreBadge({ score, label }: { score: number; label?: string }) {
  const cls =
    score >= 20
      ? "bg-red-100 text-red-700 font-bold dark:bg-red-900/30 dark:text-red-400"
      : score >= 15
      ? "bg-orange-100 text-orange-700 font-bold dark:bg-orange-900/30 dark:text-orange-400"
      : score >= 10
      ? "bg-yellow-100 text-yellow-700 font-semibold dark:bg-yellow-900/30 dark:text-yellow-400"
      : "bg-green-100 text-green-700 font-semibold dark:bg-green-900/30 dark:text-green-400";
  const tier =
    score >= 20 ? "Critical" : score >= 15 ? "High" : score >= 10 ? "Medium" : "Low";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${cls}`}>
      <span className="font-mono">{score}</span>
      <span className="opacity-70">·</span>
      <span>{label ?? tier}</span>
    </span>
  );
}

type SortField = "score" | "title" | "updatedAt" | "status";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbRisk(row: any): Risk {
  // Compute scores app-side in case the DB doesn't have generated columns
  const likelihood = row.inherent_likelihood ?? 0;
  const impact = row.inherent_impact ?? 0;
  const inherentScore = row.inherent_score ?? (likelihood * impact || 0);

  const residualLikelihood = row.residual_likelihood ?? null;
  const residualImpact = row.residual_impact ?? null;
  const residualScore =
    row.residual_score ??
    (residualLikelihood !== null && residualImpact !== null
      ? residualLikelihood * residualImpact
      : null);

  return {
    id: row.risk_id || row.id,
    dbId: row.id,
    title: row.title || "Untitled Risk",
    description: row.description || "",
    category: row.metadata?.category || row.category || "Security",
    likelihood,
    impact,
    score: inherentScore,
    residualScore,
    status: (row.status as Risk["status"]) || "identified",
    treatment: row.risk_response || "mitigate",
    owner: row.owner_name || "Team member",
    updatedAt: (row.updated_at || row.created_at || "").slice(0, 10),
  };
}

// ─── Control Detail Panel ────────────────────────────────────────────────────

function RiskControlPanel({
  risk,
  onClose,
  onControlLinked,
}: {
  risk: Risk;
  onClose: () => void;
  onControlLinked: () => void;
}) {
  const [linkedControls, setLinkedControls] = useState<LinkedControl[]>([]);
  const [orgControls, setOrgControls] = useState<OrgControl[]>([]);
  const [loadingControls, setLoadingControls] = useState(true);
  const [selectedControlId, setSelectedControlId] = useState("");
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const fetchLinked = useCallback(async () => {
    setLoadingControls(true);
    try {
      const [linkedRes, allRes] = await Promise.all([
        fetch(`/api/risks/${risk.dbId}/controls`),
        fetch("/api/controls"),
      ]);
      const linked = await linkedRes.json();
      const all = await allRes.json();
      setLinkedControls(linked.controls || []);
      setOrgControls(all.controls || []);
    } catch {
      // ignore
    } finally {
      setLoadingControls(false);
    }
  }, [risk.dbId]);

  useEffect(() => {
    fetchLinked();
  }, [fetchLinked]);

  const handleLink = async () => {
    if (!selectedControlId || linking) return;
    setLinking(true);
    try {
      await fetch(`/api/risks/${risk.dbId}/controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ control_id: selectedControlId }),
      });
      setSelectedControlId("");
      await fetchLinked();
      onControlLinked();
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (controlId: string) => {
    setUnlinkingId(controlId);
    try {
      await fetch(`/api/risks/${risk.dbId}/controls?control_id=${controlId}`, { method: "DELETE" });
      await fetchLinked();
      onControlLinked();
    } finally {
      setUnlinkingId(null);
    }
  };

  const linkedIds = new Set(linkedControls.map((c) => c.controlId));
  const availableControls = orgControls.filter((c) => !linkedIds.has(c.id));

  const EFFECTIVENESS_LABELS: Record<number, string> = {
    1: "Very Low", 2: "Low", 3: "Moderate", 4: "High", 5: "Very High",
  };

  return (
    <tr>
      <td colSpan={10} className="p-0">
        <div className="bg-muted/20 border-b px-6 py-4 space-y-4">
          {/* Risk summary */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Inherent Score</span>
              <RiskScoreBadge score={risk.score} />
            </div>
            {risk.residualScore !== null && (
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Residual Score</span>
                <RiskScoreBadge score={risk.residualScore} label="Residual" />
              </div>
            )}
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Treatment</span>
              <span className="capitalize font-medium">{risk.treatment}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Status</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[risk.status]}`}>
                {STATUS_LABELS[risk.status]}
              </span>
            </div>
          </div>

          {risk.description && (
            <p className="text-sm text-muted-foreground">{risk.description}</p>
          )}

          {/* Linked Controls */}
          <div>
            <h4 className="text-sm font-semibold mb-2">
              Mitigating Controls
              {linkedControls.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({linkedControls.length} linked)
                </span>
              )}
            </h4>

            {loadingControls ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : linkedControls.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground italic">
                  {orgControls.length === 0
                    ? "No controls in your library yet. Add controls via the Copilot or the Controls page."
                    : "No controls linked yet. Select a control below to start reducing this risk."}
                </p>
                {orgControls.length === 0 && (
                  <a
                    href="/dashboard/controls"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-background text-xs font-medium hover:bg-accent transition-colors"
                  >
                    Go to Controls page →
                  </a>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {linkedControls.map((ctrl) => (
                  <div
                    key={ctrl.mappingId}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card text-xs"
                  >
                    <span className="font-mono font-semibold text-primary">{ctrl.code}</span>
                    <span className="text-muted-foreground">{ctrl.title}</span>
                    <span className="text-[10px] text-muted-foreground/70">
                      eff: {EFFECTIVENESS_LABELS[ctrl.effectiveness_rating] ?? ctrl.effectiveness_rating}
                    </span>
                    <button
                      onClick={() => handleUnlink(ctrl.controlId)}
                      disabled={unlinkingId === ctrl.controlId}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="Unlink control"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add control selector */}
            {availableControls.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <select
                  value={selectedControlId}
                  onChange={(e) => setSelectedControlId(e.target.value)}
                  className="flex-1 max-w-xs px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a control to link…</option>
                  {availableControls.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleLink}
                  disabled={!selectedControlId || linking}
                  className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {linking ? "Linking…" : "+ Link Control"}
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-md border text-xs hover:bg-accent transition-colors"
                >
                  Close
                </button>
              </div>
            )}
            {availableControls.length === 0 && orgControls.length > 0 && !loadingControls && (
              <div className="mt-3 flex items-center gap-2">
                <p className="text-xs text-muted-foreground">All controls are linked. Add more controls in the Controls page.</p>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-md border text-xs hover:bg-accent transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RisksPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<Risk["status"] | "all">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRisks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/risks");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { risks: data, error: apiError } = await res.json();
      if (apiError) console.warn("Risks API warning:", apiError);
      setRisks((data || []).map(mapDbRisk));
    } catch (err) {
      console.error("Failed to fetch risks:", err);
      setError("Could not load risks. Check the console for details.");
      setRisks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRisks(); }, [fetchRisks]);

  useEffect(() => {
    const handler = () => fetchRisks();
    window.addEventListener("grc:risk-created", handler);
    window.addEventListener("grc:risk-controls-updated", handler);
    return () => {
      window.removeEventListener("grc:risk-created", handler);
      window.removeEventListener("grc:risk-controls-updated", handler);
    };
  }, [fetchRisks]);

  const filtered = risks
    .filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "score") return (a.score - b.score) * dir;
      if (sortBy === "title") return a.title.localeCompare(b.title) * dir;
      if (sortBy === "updatedAt") return a.updatedAt.localeCompare(b.updatedAt) * dir;
      if (sortBy === "status") return a.status.localeCompare(b.status) * dir;
      return 0;
    });

  const stats = {
    total: risks.length,
    critical: risks.filter((r) => r.score >= 20).length,
    high: risks.filter((r) => r.score >= 15 && r.score < 20).length,
    open: risks.filter((r) => r.status === "identified" || r.status === "assessed").length,
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <span className="opacity-30">↕</span>;
    return <span>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const toggleExpand = (risk: Risk) => {
    setExpandedId((prev) => (prev === risk.dbId ? null : risk.dbId));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Risk Register</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your organization&apos;s risk landscape
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRisks}
            disabled={loading}
            className="px-3 py-2 rounded-md border text-sm hover:bg-accent transition-colors disabled:opacity-50"
            title="Refresh"
          >
            {loading ? "⟳" : "↻"} Refresh
          </button>
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>('[placeholder="Ask anything about GRC..."]');
              if (input) { input.value = "Register a new risk: "; input.focus(); }
            }}
          >
            + Register Risk
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Risks", value: stats.total, color: "text-foreground" },
          { label: "Critical", value: stats.critical, color: "text-red-600" },
          { label: "High", value: stats.high, color: "text-orange-600" },
          { label: "Open", value: stats.open, color: "text-blue-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 rounded-lg border bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>
              {loading ? <span className="text-muted-foreground">—</span> : value}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-orange-50 border border-orange-200 text-sm text-orange-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search risks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-64"
        />
        <div className="flex gap-1">
          {(["all", "identified", "assessed", "mitigated", "accepted"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground" : "border hover:bg-accent"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-muted-foreground">
          {loading ? "Loading..." : `${filtered.length} of ${risks.length} risks`}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading risks...</p>
          </div>
        ) : risks.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-lg font-medium">No risks registered yet</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">
              Use the GRC Copilot on the right to register your first risk — just describe it in plain English.
            </p>
            <p className="text-xs mt-3 text-muted-foreground/60">
              Try: &quot;Register a risk about our S3 buckets being publicly accessible&quot;
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">ID</th>
                <th
                  className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort("title")}
                >
                  Risk Title <SortIcon field="title" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground w-10">L</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground w-10">I</th>
                <th
                  className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground w-36"
                  onClick={() => toggleSort("score")}
                >
                  Inherent <SortIcon field="score" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Residual</th>
                <th
                  className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort("status")}
                >
                  Status <SortIcon field="status" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Owner</th>
                <th
                  className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort("updatedAt")}
                >
                  Updated <SortIcon field="updatedAt" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((risk, i) => (
                <>
                  <tr
                    key={risk.dbId}
                    onClick={() => toggleExpand(risk)}
                    className={`border-b hover:bg-accent/30 cursor-pointer transition-colors ${
                      expandedId === risk.dbId ? "bg-primary/5" : i % 2 === 0 ? "" : "bg-muted/10"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{risk.id}</td>
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-1.5">
                        {risk.title}
                        <span className="text-[10px] text-muted-foreground/50">
                          {expandedId === risk.dbId ? "▲" : "▼"}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-secondary text-secondary-foreground">
                        {risk.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{risk.likelihood}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{risk.impact}</td>
                    <td className="px-4 py-3"><RiskScoreBadge score={risk.score} /></td>
                    <td className="px-4 py-3">
                      {risk.residualScore !== null ? (
                        <RiskScoreBadge score={risk.residualScore} label="Residual" />
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[risk.status]}`}>
                        {STATUS_LABELS[risk.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{risk.owner}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{risk.updatedAt}</td>
                  </tr>
                  {expandedId === risk.dbId && (
                    <RiskControlPanel
                      key={`panel-${risk.dbId}`}
                      risk={risk}
                      onClose={() => setExpandedId(null)}
                      onControlLinked={() => {
                        fetchRisks();
                        window.dispatchEvent(new CustomEvent("grc:risk-controls-updated"));
                      }}
                    />
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}

        {!loading && risks.length > 0 && filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground border-t">
            <p className="text-lg">No risks match your filter</p>
            <p className="text-sm mt-1">Try adjusting your search or status filter</p>
          </div>
        )}
      </div>

      {risks.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Tip: Click any row to link mitigating controls and see residual risk scores.
        </p>
      )}
    </div>
  );
}
