"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskReportData {
  organization_name: string;
  generated_at: string;
  stats: {
    total: number;
    by_status: Record<string, number>;
    by_score: { critical: number; high: number; medium: number; low: number };
    avg_inherent_score: number;
    avg_residual_score: number;
    risks_with_controls: number;
    risks_without_controls: number;
  };
  risks: Array<{
    id: string;
    risk_id?: string;
    title: string;
    description?: string;
    inherent_likelihood: number;
    inherent_impact: number;
    residual_likelihood?: number;
    residual_impact?: number;
    inherent_score: number;
    residual_score: number;
    score_band: string;
    status: string;
    risk_response?: string;
    controls: Array<{ code: string; title: string; effectiveness_rating: number; status: string }>;
  }>;
}

interface ComplianceReportData {
  organization_name: string;
  generated_at: string;
  overall_score: number;
  frameworks: Array<{
    code: string;
    name: string;
    version?: string;
    total_requirements: number;
    implemented: number;
    in_progress: number;
    not_started: number;
    not_applicable: number;
    progress: number;
    by_domain: Array<{ name: string; total: number; implemented: number; progress: number }>;
    gaps: Array<{ code: string; title: string; domain: string }>;
  }>;
  evidence: {
    total: number;
    validated: number;
    pending: number;
    expired: number;
    expiring_soon: number;
  };
}

interface PolicyReportData {
  organization_name: string;
  generated_at: string;
  stats: {
    total: number;
    by_status: { draft: number; active: number; archived: number };
    overdue_review: number;
    review_due_30d: number;
    review_due_90d: number;
    attestation_required: number;
  };
  by_category: Array<{ category: string; count: number }>;
  upcoming_reviews: Array<{
    id: string;
    policy_id: string;
    title: string;
    category: string;
    status: string;
    review_date: string;
    owner_name?: string;
  }>;
  policies: Array<{
    id: string;
    policy_id: string;
    title: string;
    category: string;
    status: string;
    version: string;
    effective_date?: string;
    review_date?: string;
    attestation_required: boolean;
    owner_name?: string;
  }>;
}

interface VendorRiskReportData {
  organization_name: string;
  generated_at: string;
  stats: {
    total: number;
    by_tier: { critical: number; high: number; medium: number; low: number };
    by_status: { active: number; under_review: number; approved: number; suspended: number };
    avg_risk_score: number;
    contracts_expiring_90d: number;
    contracts_expired: number;
    never_assessed: number;
  };
  high_risk_vendors: Array<{
    id: string;
    name: string;
    category: string;
    tier: string;
    risk_score: number;
    status: string;
    contract_expiry?: string;
    last_assessed_at?: string;
  }>;
  expiring_contracts: Array<{
    id: string;
    name: string;
    tier: string;
    contract_expiry: string;
    risk_score: number;
  }>;
  vendors: Array<{
    id: string;
    name: string;
    category: string;
    tier: string;
    status: string;
    risk_score: number;
    contract_expiry?: string;
    last_assessed_at?: string;
    contact_name?: string;
    contact_email?: string;
  }>;
}

interface IncidentReportData {
  organization_name: string;
  generated_at: string;
  stats: {
    total: number;
    open: number;
    resolved: number;
    by_severity: { critical: number; high: number; medium: number; low: number };
    by_status: {
      detected: number;
      contained: number;
      resolved: number;
      post_mortem: number;
      closed: number;
    };
    mttr_hours: number | null;
    critical_open: number;
  };
  open_incidents: Array<{
    id: string;
    incident_id: string;
    title: string;
    severity: string;
    status: string;
    discovered_at: string;
    contained_at?: string;
    impact?: string;
    owner_name?: string;
  }>;
  recent_resolved: Array<{
    id: string;
    incident_id: string;
    title: string;
    severity: string;
    discovered_at: string;
    resolved_at?: string;
  }>;
  incidents: Array<{
    id: string;
    incident_id: string;
    title: string;
    severity: string;
    status: string;
    discovered_at: string;
    resolved_at?: string;
    impact?: string;
  }>;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function bandColor(band: string) {
  if (band === "critical") return "bg-red-500 text-white";
  if (band === "high") return "bg-orange-500 text-white";
  if (band === "medium") return "bg-yellow-400 text-black";
  return "bg-green-500 text-white";
}

function bandBorder(band: string) {
  if (band === "critical") return "border-red-400";
  if (band === "high") return "border-orange-400";
  if (band === "medium") return "border-yellow-400";
  return "border-green-400";
}

function scoreToCell(likelihood: number, impact: number): { row: number; col: number } {
  // Row 1 = likelihood 5 (top), row 5 = likelihood 1 (bottom)
  return { row: 6 - likelihood, col: impact };
}

function cellBg(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 15) return "bg-red-100 border border-red-200";
  if (score >= 10) return "bg-orange-100 border border-orange-200";
  if (score >= 5) return "bg-yellow-100 border border-yellow-200";
  return "bg-green-100 border border-green-200";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function progressColor(p: number) {
  if (p >= 80) return "bg-green-500";
  if (p >= 50) return "bg-yellow-400";
  return "bg-red-500";
}

// ─── Risk Heat Map ─────────────────────────────────────────────────────────────

function RiskHeatMap({ risks }: { risks: RiskReportData["risks"] }) {
  // Build a 5x5 grid of cells (likelihood 5→1 top→bottom, impact 1→5 left→right)
  const grid: RiskReportData["risks"][][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => [])
  );

  for (const r of risks) {
    const l = Math.min(5, Math.max(1, r.inherent_likelihood));
    const i = Math.min(5, Math.max(1, r.inherent_impact));
    const { row, col } = scoreToCell(l, i);
    if (row >= 1 && row <= 5 && col >= 1 && col <= 5) {
      grid[row - 1][col - 1].push(r);
    }
  }

  return (
    <div className="overflow-auto print:overflow-visible">
      <div className="flex gap-2">
        {/* Y-axis label */}
        <div className="flex flex-col justify-between items-center w-6 text-xs text-muted-foreground print:text-gray-500 py-8">
          <span className="[writing-mode:vertical-rl] rotate-180 tracking-wider">← LIKELIHOOD →</span>
        </div>
        <div className="flex-1">
          {/* Grid */}
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            {grid.map((row, rowIdx) =>
              row.map((cell, colIdx) => {
                const l = 5 - rowIdx;
                const impact = colIdx + 1;
                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    className={`relative min-h-[72px] rounded p-1.5 ${cellBg(l, impact)}`}
                  >
                    <span className="absolute top-1 right-1.5 text-[9px] text-muted-foreground font-mono">
                      {l * impact}
                    </span>
                    <div className="flex flex-wrap gap-0.5 mt-3">
                      {cell.map((r) => (
                        <span
                          key={r.id}
                          title={r.title}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-bold cursor-default ${bandColor(r.score_band)}`}
                        >
                          {(r.risk_id || r.id).slice(-2).toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* X-axis */}
          <div className="grid gap-1 mt-1" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="text-center text-xs text-muted-foreground print:text-gray-500">
                {n}
              </div>
            ))}
          </div>
          <div className="text-center text-xs text-muted-foreground print:text-gray-500 mt-0.5 tracking-wider">
            ← IMPACT →
          </div>
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-xs">
        {[
          { label: "Critical (15-25)", cls: "bg-red-500" },
          { label: "High (10-14)", cls: "bg-orange-500" },
          { label: "Medium (5-9)", cls: "bg-yellow-400" },
          { label: "Low (1-4)", cls: "bg-green-500" },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${cls}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Risk Assessment Report ───────────────────────────────────────────────────

function RiskAssessmentReport({ data }: { data: RiskReportData }) {
  const { stats, risks } = data;
  return (
    <div className="space-y-8 print:space-y-6">
      {/* Header */}
      <div className="border-b pb-4 print:pb-2">
        <h1 className="text-2xl font-bold">Risk Assessment Report</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data.organization_name} · Generated {fmtDate(data.generated_at)}
        </p>
      </div>

      {/* Summary Stats */}
      <section>
        <h2 className="text-base font-semibold mb-3">Executive Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Risks", value: stats.total },
            { label: "Critical", value: stats.by_score.critical, cls: "text-red-600 font-bold" },
            { label: "High", value: stats.by_score.high, cls: "text-orange-600 font-bold" },
            { label: "Without Controls", value: stats.risks_without_controls, cls: "text-yellow-600 font-bold" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-lg border bg-card p-3 text-center">
              <div className={`text-2xl font-bold ${cls ?? ""}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded border p-3 bg-muted/30">
            <span className="text-muted-foreground">Avg inherent score: </span>
            <span className="font-semibold">{stats.avg_inherent_score}</span>
          </div>
          <div className="rounded border p-3 bg-muted/30">
            <span className="text-muted-foreground">Avg residual score: </span>
            <span className="font-semibold">{stats.avg_residual_score}</span>
          </div>
          <div className="rounded border p-3 bg-muted/30">
            <span className="text-muted-foreground">Risks with controls: </span>
            <span className="font-semibold">{stats.risks_with_controls} / {stats.total}</span>
          </div>
        </div>
      </section>

      {/* Heat Map */}
      <section>
        <h2 className="text-base font-semibold mb-3">Risk Heat Map (Inherent)</h2>
        <RiskHeatMap risks={risks} />
      </section>

      {/* Status breakdown */}
      <section>
        <h2 className="text-base font-semibold mb-3">Risk Status Breakdown</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.entries(stats.by_status).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2 rounded border px-3 py-1.5 bg-card">
              <span className="capitalize text-muted-foreground">{status.replace("_", " ")}</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Risk Register Table */}
      <section>
        <h2 className="text-base font-semibold mb-3">Risk Register ({risks.length} risks)</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">ID</th>
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Band</th>
                <th className="text-center p-3 font-medium">Inherent</th>
                <th className="text-center p-3 font-medium">Residual</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Response</th>
                <th className="text-center p-3 font-medium">Controls</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {r.risk_id || r.id.slice(0, 8)}
                  </td>
                  <td className="p-3 font-medium max-w-[200px] truncate" title={r.title}>
                    {r.title}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${bandColor(r.score_band)}`}>
                      {r.score_band.charAt(0).toUpperCase() + r.score_band.slice(1)}
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono">
                    {r.inherent_likelihood}×{r.inherent_impact}={r.inherent_score}
                  </td>
                  <td className="p-3 text-center font-mono text-muted-foreground">
                    {r.residual_score !== r.inherent_score ? (
                      <span className="text-green-600">{r.residual_score}</span>
                    ) : (
                      <span>{r.residual_score}</span>
                    )}
                  </td>
                  <td className="p-3 capitalize text-muted-foreground">{r.status}</td>
                  <td className="p-3 text-muted-foreground capitalize">
                    {r.risk_response?.replace("_", " ") || "—"}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${r.controls.length > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {r.controls.length}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mitigation Detail for top critical/high risks */}
      {risks.filter((r) => r.score_band === "critical" || r.score_band === "high").length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">Mitigation Progress — Critical &amp; High Risks</h2>
          <div className="space-y-3">
            {risks
              .filter((r) => r.score_band === "critical" || r.score_band === "high")
              .map((r) => (
                <div key={r.id} className={`rounded-lg border-l-4 p-4 bg-card ${bandBorder(r.score_band)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold">{r.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        Score: {r.inherent_score} → {r.residual_score}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${bandColor(r.score_band)}`}>
                      {r.score_band}
                    </span>
                  </div>
                  {r.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                  )}
                  {r.controls.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.controls.map((c) => (
                        <span key={c.code} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
                          <span className="font-mono">{c.code}</span>
                          <span className="text-muted-foreground">{c.title}</span>
                          <span className="text-green-600 font-semibold">eff:{c.effectiveness_rating}/5</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-red-600">⚠ No mitigating controls linked</p>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Compliance Report ────────────────────────────────────────────────────────

function ComplianceReport({ data }: { data: ComplianceReportData }) {
  const { frameworks, evidence } = data;
  return (
    <div className="space-y-8 print:space-y-6">
      {/* Header */}
      <div className="border-b pb-4 print:pb-2">
        <h1 className="text-2xl font-bold">Compliance &amp; Audit Readiness Report</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data.organization_name} · Generated {fmtDate(data.generated_at)}
        </p>
      </div>

      {/* Overall Score */}
      <section className="flex items-center gap-6">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={data.overall_score >= 80 ? "#22c55e" : data.overall_score >= 50 ? "#eab308" : "#ef4444"}
              strokeWidth="3"
              strokeDasharray={`${data.overall_score} ${100 - data.overall_score}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold">{data.overall_score}%</span>
          </div>
        </div>
        <div>
          <p className="text-lg font-semibold">Overall Compliance Score</p>
          <p className="text-sm text-muted-foreground mt-1">
            Average across {frameworks.length} active framework{frameworks.length !== 1 ? "s" : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {evidence.total} evidence items · {evidence.validated} validated · {evidence.expired} expired
          </p>
        </div>
      </section>

      {/* Evidence Summary */}
      <section>
        <h2 className="text-base font-semibold mb-3">Evidence Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: evidence.total },
            { label: "Validated", value: evidence.validated, cls: "text-green-600 font-bold" },
            { label: "Pending", value: evidence.pending, cls: "text-yellow-600 font-bold" },
            { label: "Expiring (30d)", value: evidence.expiring_soon, cls: "text-orange-600 font-bold" },
            { label: "Expired", value: evidence.expired, cls: "text-red-600 font-bold" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-lg border bg-card p-3 text-center">
              <div className={`text-2xl font-bold ${cls ?? ""}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Per-Framework */}
      {frameworks.map((fw) => (
        <section key={fw.code} className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">
                {fw.name} {fw.version ? `(${fw.version})` : ""}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fw.implemented} / {fw.total_requirements - fw.not_applicable} requirements implemented
                {fw.not_applicable > 0 ? ` · ${fw.not_applicable} N/A` : ""}
              </p>
            </div>
            <div className="text-right">
              <span className={`text-3xl font-bold ${fw.progress >= 80 ? "text-green-600" : fw.progress >= 50 ? "text-yellow-500" : "text-red-600"}`}>
                {fw.progress}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-4">
            <div className={`h-full rounded-full ${progressColor(fw.progress)}`} style={{ width: `${fw.progress}%` }} />
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-2 mb-4 text-xs">
            <span className="px-2 py-1 rounded bg-green-100 text-green-700 font-medium">{fw.implemented} Implemented</span>
            <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 font-medium">{fw.in_progress} In Progress</span>
            <span className="px-2 py-1 rounded bg-red-100 text-red-700 font-medium">{fw.not_started} Not Started</span>
            {fw.not_applicable > 0 && (
              <span className="px-2 py-1 rounded bg-muted text-muted-foreground font-medium">{fw.not_applicable} N/A</span>
            )}
          </div>

          {/* Domain breakdown */}
          {fw.by_domain.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">By Domain</p>
              <div className="space-y-1.5">
                {fw.by_domain.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span className="w-40 shrink-0 truncate text-muted-foreground text-xs" title={d.name}>{d.name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${progressColor(d.progress)}`} style={{ width: `${d.progress}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs text-muted-foreground">{d.progress}%</span>
                    <span className="w-16 text-right text-xs text-muted-foreground">{d.implemented}/{d.total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top gaps */}
          {fw.gaps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Top Gaps ({fw.not_started} total not started)
              </p>
              <div className="grid gap-1 sm:grid-cols-2">
                {fw.gaps.slice(0, 10).map((g) => (
                  <div key={g.code} className="flex items-start gap-2 text-xs rounded border bg-muted/30 px-2 py-1.5">
                    <span className="font-mono text-muted-foreground shrink-0">{g.code}</span>
                    <span className="truncate" title={g.title}>{g.title}</span>
                  </div>
                ))}
              </div>
              {fw.gaps.length > 10 && (
                <p className="mt-1 text-xs text-muted-foreground">…and {fw.not_started - 10} more</p>
              )}
            </div>
          )}
        </section>
      ))}

      {frameworks.length === 0 && (
        <div className="rounded-xl border bg-muted/30 p-8 text-center text-muted-foreground">
          <p>No active compliance frameworks found.</p>
          <p className="text-sm mt-1">Add frameworks from the Frameworks page or via Copilot.</p>
        </div>
      )}
    </div>
  );
}

// ─── Policy Report ────────────────────────────────────────────────────────────

function policyStatusColor(status: string) {
  if (status === "active") return "bg-green-100 text-green-700";
  if (status === "draft") return "bg-yellow-100 text-yellow-700";
  return "bg-muted text-muted-foreground";
}

function PolicyReport({ data }: { data: PolicyReportData }) {
  const { stats } = data;
  return (
    <div className="space-y-8 print:space-y-6">
      {/* Header */}
      <div className="border-b pb-4 print:pb-2">
        <h1 className="text-2xl font-bold">Policy &amp; Procedure Report</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data.organization_name} · Generated {fmtDate(data.generated_at)}
        </p>
      </div>

      {/* Stats */}
      <section>
        <h2 className="text-base font-semibold mb-3">Executive Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Policies", value: stats.total },
            { label: "Active", value: stats.by_status.active, cls: "text-green-600 font-bold" },
            { label: "Overdue Review", value: stats.overdue_review, cls: stats.overdue_review > 0 ? "text-red-600 font-bold" : "" },
            { label: "Require Attestation", value: stats.attestation_required, cls: "text-yellow-600 font-bold" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-lg border bg-card p-3 text-center">
              <div className={`text-2xl font-bold ${cls ?? ""}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {[
            { label: "Draft", value: stats.by_status.draft, cls: "bg-yellow-100 text-yellow-700" },
            { label: "Active", value: stats.by_status.active, cls: "bg-green-100 text-green-700" },
            { label: "Archived", value: stats.by_status.archived, cls: "bg-muted text-muted-foreground" },
            { label: "Review due 30d", value: stats.review_due_30d, cls: "bg-orange-100 text-orange-700" },
            { label: "Review due 90d", value: stats.review_due_90d, cls: "bg-yellow-100 text-yellow-700" },
          ].map(({ label, value, cls }) => (
            <span key={label} className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${cls}`}>
              {label}: <strong>{value}</strong>
            </span>
          ))}
        </div>
      </section>

      {/* By Category */}
      {data.by_category.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">Coverage by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.by_category.map(({ category, count }) => (
              <div key={category} className="rounded border bg-muted/30 px-3 py-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{category}</span>
                <span className="font-semibold ml-2">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Reviews */}
      {data.upcoming_reviews.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">Upcoming Reviews (next 90 days)</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Policy</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Review Date</th>
                  <th className="text-left p-3 font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {data.upcoming_reviews.map((p, i) => {
                  const daysUntil = Math.ceil((new Date(p.review_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={p.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="p-3 font-medium">{p.title}</td>
                      <td className="p-3 text-muted-foreground text-xs">{p.category}</td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${policyStatusColor(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={daysUntil < 0 ? "text-red-600 font-semibold" : daysUntil <= 30 ? "text-orange-600 font-semibold" : "text-muted-foreground"}>
                          {fmtDate(p.review_date)}
                          {daysUntil < 0 ? " (overdue)" : daysUntil <= 30 ? ` (${daysUntil}d)` : ""}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{p.owner_name || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Full Policy Register */}
      <section>
        <h2 className="text-base font-semibold mb-3">Policy Register ({data.policies.length})</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">ID</th>
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Version</th>
                <th className="text-left p-3 font-medium">Review Date</th>
                <th className="text-center p-3 font-medium">Attestation</th>
              </tr>
            </thead>
            <tbody>
              {data.policies.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{p.policy_id}</td>
                  <td className="p-3 font-medium max-w-[200px] truncate" title={p.title}>{p.title}</td>
                  <td className="p-3 text-muted-foreground text-xs">{p.category}</td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${policyStatusColor(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">v{p.version}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {p.review_date ? fmtDate(p.review_date) : "—"}
                  </td>
                  <td className="p-3 text-center text-xs">
                    {p.attestation_required ? (
                      <span className="text-yellow-600 font-semibold">Yes</span>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Vendor Risk Report ───────────────────────────────────────────────────────

function tierColor(tier: string) {
  if (tier === "critical") return "bg-red-100 text-red-700";
  if (tier === "high") return "bg-orange-100 text-orange-700";
  if (tier === "medium") return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
}

function VendorRiskReport({ data }: { data: VendorRiskReportData }) {
  const { stats } = data;
  return (
    <div className="space-y-8 print:space-y-6">
      {/* Header */}
      <div className="border-b pb-4 print:pb-2">
        <h1 className="text-2xl font-bold">Vendor / Third-Party Risk Report</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data.organization_name} · Generated {fmtDate(data.generated_at)}
        </p>
      </div>

      {/* Stats */}
      <section>
        <h2 className="text-base font-semibold mb-3">Executive Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Vendors", value: stats.total },
            { label: "Critical Tier", value: stats.by_tier.critical, cls: stats.by_tier.critical > 0 ? "text-red-600 font-bold" : "" },
            { label: "Avg Risk Score", value: stats.avg_risk_score, cls: stats.avg_risk_score >= 15 ? "text-red-600 font-bold" : stats.avg_risk_score >= 10 ? "text-orange-600 font-bold" : "" },
            { label: "Contracts Expiring (90d)", value: stats.contracts_expiring_90d, cls: stats.contracts_expiring_90d > 0 ? "text-orange-600 font-bold" : "" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-lg border bg-card p-3 text-center">
              <div className={`text-2xl font-bold ${cls ?? ""}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {[
            { label: "Critical", value: stats.by_tier.critical, cls: "bg-red-100 text-red-700" },
            { label: "High", value: stats.by_tier.high, cls: "bg-orange-100 text-orange-700" },
            { label: "Medium", value: stats.by_tier.medium, cls: "bg-yellow-100 text-yellow-700" },
            { label: "Low", value: stats.by_tier.low, cls: "bg-green-100 text-green-700" },
            { label: "Never Assessed", value: stats.never_assessed, cls: "bg-muted text-muted-foreground" },
            { label: "Expired Contracts", value: stats.contracts_expired, cls: stats.contracts_expired > 0 ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground" },
          ].map(({ label, value, cls }) => (
            <span key={label} className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${cls}`}>
              {label}: <strong>{value}</strong>
            </span>
          ))}
        </div>
      </section>

      {/* High & Critical Risk Vendors */}
      {data.high_risk_vendors.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">High &amp; Critical Risk Vendors</h2>
          <div className="space-y-2">
            {data.high_risk_vendors.map((v) => (
              <div key={v.id} className={`rounded-lg border-l-4 p-4 bg-card ${v.tier === "critical" ? "border-red-400" : "border-orange-400"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{v.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{v.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${tierColor(v.tier)}`}>
                      {v.tier}
                    </span>
                    <span className="text-sm font-mono font-bold">
                      Score: {v.risk_score}/25
                    </span>
                  </div>
                </div>
                <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                  {v.contract_expiry && (
                    <span>Contract: {fmtDate(v.contract_expiry)}</span>
                  )}
                  {v.last_assessed_at ? (
                    <span>Last assessed: {fmtDate(v.last_assessed_at)}</span>
                  ) : (
                    <span className="text-orange-600">Never assessed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Expiring Contracts */}
      {data.expiring_contracts.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">Contracts Expiring (next 90 days)</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Vendor</th>
                  <th className="text-left p-3 font-medium">Tier</th>
                  <th className="text-left p-3 font-medium">Expiry Date</th>
                  <th className="text-left p-3 font-medium">Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {data.expiring_contracts.map((v, i) => {
                  const daysUntil = Math.ceil((new Date(v.contract_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={v.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="p-3 font-medium">{v.name}</td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${tierColor(v.tier)}`}>
                          {v.tier}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={daysUntil < 0 ? "text-red-600 font-semibold" : daysUntil <= 30 ? "text-orange-600 font-semibold" : "text-yellow-600"}>
                          {fmtDate(v.contract_expiry)}
                          {daysUntil < 0 ? " (expired)" : ` (${daysUntil}d)`}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{v.risk_score}/25</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Full Vendor Register */}
      <section>
        <h2 className="text-base font-semibold mb-3">Vendor Register ({data.vendors.length})</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-left p-3 font-medium">Tier</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-center p-3 font-medium">Risk</th>
                <th className="text-left p-3 font-medium">Contract Expiry</th>
                <th className="text-left p-3 font-medium">Last Assessed</th>
              </tr>
            </thead>
            <tbody>
              {data.vendors.map((v, i) => (
                <tr key={v.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                  <td className="p-3 font-medium">{v.name}</td>
                  <td className="p-3 text-muted-foreground text-xs">{v.category}</td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${tierColor(v.tier)}`}>
                      {v.tier}
                    </span>
                  </td>
                  <td className="p-3 capitalize text-xs text-muted-foreground">{v.status.replace("_", " ")}</td>
                  <td className="p-3 text-center font-mono text-sm">{v.risk_score}/25</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {v.contract_expiry ? fmtDate(v.contract_expiry) : "—"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {v.last_assessed_at ? fmtDate(v.last_assessed_at) : <span className="text-orange-500">Never</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Incident Report ──────────────────────────────────────────────────────────

function severityColor(severity: string) {
  if (severity === "critical") return "bg-red-500 text-white";
  if (severity === "high") return "bg-orange-500 text-white";
  if (severity === "medium") return "bg-yellow-400 text-black";
  return "bg-green-500 text-white";
}

function incidentStatusColor(status: string) {
  if (status === "detected") return "bg-red-100 text-red-700";
  if (status === "contained") return "bg-yellow-100 text-yellow-700";
  if (status === "resolved") return "bg-green-100 text-green-700";
  if (status === "post_mortem") return "bg-blue-100 text-blue-700";
  return "bg-muted text-muted-foreground";
}

function IncidentReport({ data }: { data: IncidentReportData }) {
  const { stats } = data;
  return (
    <div className="space-y-8 print:space-y-6">
      {/* Header */}
      <div className="border-b pb-4 print:pb-2">
        <h1 className="text-2xl font-bold">Incident Management Report</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data.organization_name} · Generated {fmtDate(data.generated_at)}
        </p>
      </div>

      {/* Stats */}
      <section>
        <h2 className="text-base font-semibold mb-3">Executive Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Incidents", value: stats.total },
            { label: "Open", value: stats.open, cls: stats.open > 0 ? "text-orange-600 font-bold" : "" },
            { label: "Critical Open", value: stats.critical_open, cls: stats.critical_open > 0 ? "text-red-600 font-bold" : "" },
            {
              label: "Avg MTTR",
              value: stats.mttr_hours != null
                ? stats.mttr_hours < 24 ? `${stats.mttr_hours}h` : `${Math.round(stats.mttr_hours / 24)}d`
                : "—",
              cls: "",
            },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-lg border bg-card p-3 text-center">
              <div className={`text-2xl font-bold ${cls ?? ""}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {[
            { label: "Critical", value: stats.by_severity.critical, cls: "bg-red-100 text-red-700" },
            { label: "High", value: stats.by_severity.high, cls: "bg-orange-100 text-orange-700" },
            { label: "Medium", value: stats.by_severity.medium, cls: "bg-yellow-100 text-yellow-700" },
            { label: "Low", value: stats.by_severity.low, cls: "bg-green-100 text-green-700" },
            { label: "Resolved", value: stats.resolved, cls: "bg-green-100 text-green-700" },
          ].map(({ label, value, cls }) => (
            <span key={label} className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${cls}`}>
              {label}: <strong>{value}</strong>
            </span>
          ))}
        </div>
      </section>

      {/* Open Incidents */}
      {data.open_incidents.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">Open Incidents ({data.open_incidents.length})</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">ID</th>
                  <th className="text-left p-3 font-medium">Title</th>
                  <th className="text-left p-3 font-medium">Severity</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Discovered</th>
                  <th className="text-left p-3 font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {data.open_incidents.map((inc, i) => (
                  <tr key={inc.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{inc.incident_id}</td>
                    <td className="p-3 font-medium max-w-[200px] truncate" title={inc.title}>{inc.title}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${severityColor(inc.severity)}`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${incidentStatusColor(inc.status)}`}>
                        {inc.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{fmtDate(inc.discovered_at)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{inc.owner_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Recent Resolved */}
      {data.recent_resolved.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">Recently Resolved</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">ID</th>
                  <th className="text-left p-3 font-medium">Title</th>
                  <th className="text-left p-3 font-medium">Severity</th>
                  <th className="text-left p-3 font-medium">Discovered</th>
                  <th className="text-left p-3 font-medium">Resolved</th>
                  <th className="text-left p-3 font-medium">MTTR</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_resolved.map((inc, i) => {
                  const mttr = inc.resolved_at && inc.discovered_at
                    ? Math.round((new Date(inc.resolved_at).getTime() - new Date(inc.discovered_at).getTime()) / (1000 * 60 * 60))
                    : null;
                  return (
                    <tr key={inc.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{inc.incident_id}</td>
                      <td className="p-3 font-medium max-w-[200px] truncate" title={inc.title}>{inc.title}</td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${severityColor(inc.severity)}`}>
                          {inc.severity}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{fmtDate(inc.discovered_at)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{inc.resolved_at ? fmtDate(inc.resolved_at) : "—"}</td>
                      <td className="p-3 text-xs font-mono">
                        {mttr != null ? (mttr < 24 ? `${mttr}h` : `${Math.round(mttr / 24)}d`) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Full Incident Register */}
      <section>
        <h2 className="text-base font-semibold mb-3">Incident Register ({data.incidents.length})</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">ID</th>
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Severity</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Discovered</th>
                <th className="text-left p-3 font-medium">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {data.incidents.map((inc, i) => (
                <tr key={inc.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{inc.incident_id}</td>
                  <td className="p-3 font-medium max-w-[200px] truncate" title={inc.title}>{inc.title}</td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${severityColor(inc.severity)}`}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${incidentStatusColor(inc.status)}`}>
                      {inc.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{fmtDate(inc.discovered_at)}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {inc.resolved_at ? fmtDate(inc.resolved_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Main Reports Page ────────────────────────────────────────────────────────

type ReportType = "risk" | "compliance" | "policy" | "vendor-risk" | "incident";

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>("risk");
  const [riskData, setRiskData] = useState<RiskReportData | null>(null);
  const [complianceData, setComplianceData] = useState<ComplianceReportData | null>(null);
  const [policyData, setPolicyData] = useState<PolicyReportData | null>(null);
  const [vendorData, setVendorData] = useState<VendorRiskReportData | null>(null);
  const [incidentData, setIncidentData] = useState<IncidentReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateReport(type: ReportType) {
    setActiveReport(type);
    setLoading(true);
    setError(null);
    try {
      const urls: Record<ReportType, string> = {
        risk: "/api/reports/risk-assessment",
        compliance: "/api/reports/compliance",
        policy: "/api/reports/policy",
        "vendor-risk": "/api/reports/vendor-risk",
        incident: "/api/reports/incident",
      };
      const res = await fetch(urls[type]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate report");
      if (type === "risk") setRiskData(json);
      else if (type === "compliance") setComplianceData(json);
      else if (type === "policy") setPolicyData(json);
      else if (type === "vendor-risk") setVendorData(json);
      else setIncidentData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const currentData =
    activeReport === "risk" ? riskData :
    activeReport === "compliance" ? complianceData :
    activeReport === "policy" ? policyData :
    activeReport === "vendor-risk" ? vendorData :
    incidentData;

  function summaryText() {
    if (activeReport === "risk" && riskData)
      return `${riskData.stats.total} risks · ${riskData.stats.by_score.critical} critical`;
    if (activeReport === "compliance" && complianceData)
      return `${complianceData.overall_score}% overall compliance`;
    if (activeReport === "policy" && policyData)
      return `${policyData.stats.total} policies · ${policyData.stats.overdue_review} overdue reviews`;
    if (activeReport === "vendor-risk" && vendorData)
      return `${vendorData.stats.total} vendors · ${vendorData.stats.by_tier.critical} critical tier`;
    if (activeReport === "incident" && incidentData)
      return `${incidentData.stats.total} incidents · ${incidentData.stats.open} open`;
    return "";
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate compliance and risk reports. Use the Copilot to generate reports conversationally.
        </p>
      </div>

      {/* Report selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          {
            type: "risk" as const,
            title: "Risk Assessment",
            description: "Heat map, risk register, mitigation progress, score analysis",
            icon: "⚠️",
          },
          {
            type: "compliance" as const,
            title: "Compliance & Audit",
            description: "Framework readiness, gap analysis, evidence coverage",
            icon: "📋",
          },
          {
            type: "policy" as const,
            title: "Policy & Procedure",
            description: "Policy register, review schedule, attestation status",
            icon: "📜",
          },
          {
            type: "vendor-risk" as const,
            title: "Vendor / Third-Party Risk",
            description: "Vendor tier breakdown, contract expiry, risk scores",
            icon: "🏢",
          },
          {
            type: "incident" as const,
            title: "Incident Management",
            description: "Open incidents, MTTR, severity breakdown, resolution history",
            icon: "🚨",
          },
        ].map(({ type, title, description, icon }) => (
          <button
            key={type}
            onClick={() => generateReport(type)}
            disabled={loading}
            className={`text-left rounded-xl border p-5 transition-all shadow-sm hover:shadow-md disabled:opacity-50 ${
              activeReport === type && currentData
                ? "border-primary bg-primary/5"
                : "bg-card hover:border-primary/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{icon}</span>
              {activeReport === type && loading && (
                <span className="text-xs text-muted-foreground animate-pulse">Generating…</span>
              )}
              {activeReport === type && currentData && !loading && (
                <span className="text-xs text-green-600 font-medium">✓ Ready</span>
              )}
            </div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium">
                {activeReport === type && loading ? "Generating…" : "Generate Report"}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Report output */}
      {currentData && !loading && (
        <div>
          {/* Actions bar */}
          <div className="flex items-center justify-between mb-4 no-print">
            <p className="text-sm text-muted-foreground">{summaryText()}</p>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent transition-colors"
            >
              🖨 Print / Save PDF
            </button>
          </div>

          {/* Printable report */}
          <div
            id="report-content"
            className="rounded-xl border bg-card p-8 shadow-sm print:shadow-none print:border-none print:p-0"
          >
            {activeReport === "risk" && riskData && <RiskAssessmentReport data={riskData} />}
            {activeReport === "compliance" && complianceData && <ComplianceReport data={complianceData} />}
            {activeReport === "policy" && policyData && <PolicyReport data={policyData} />}
            {activeReport === "vendor-risk" && vendorData && <VendorRiskReport data={vendorData} />}
            {activeReport === "incident" && incidentData && <IncidentReport data={incidentData} />}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!currentData && !loading && !error && (
        <div className="rounded-xl border border-dashed bg-muted/20 p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Select a report above to generate it, or ask the Copilot:<br />
            <span className="font-mono text-xs mt-1 block">&ldquo;Generate a risk assessment report&rdquo;</span>
          </p>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-content, #report-content * { visibility: visible; }
          #report-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
