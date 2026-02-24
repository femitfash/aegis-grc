"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskRow {
  id: string;
  title: string;
  inherent_score: number | null;
  status: string;
  risk_id?: string;
}

interface EvidenceRow {
  id: string;
  title: string;
  evidence_id?: string;
  metadata?: { control_code?: string };
  valid_to?: string | null;
  status: string;
}

interface FrameworkStatus {
  name: string;
  color: "blue" | "purple" | "green";
  total: number;
  implemented: number;
  progress: number;
}

// ─── Stats computation helpers ────────────────────────────────────────────────

function computeFrameworkStats(
  requirementStatuses: Record<string, string>,
  frameworkKey: string,
  totalRequirements: number
): { implemented: number; progress: number } {
  const statusEntries = Object.entries(requirementStatuses).filter(([key]) =>
    key.startsWith(`${frameworkKey}-`)
  );
  const implemented = statusEntries.filter(([, v]) => v === "implemented").length;
  const progress =
    totalRequirements > 0 ? Math.round((implemented / totalRequirements) * 100) : 0;
  return { implemented, progress };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [frameworkStatuses, setFrameworkStatuses] = useState<FrameworkStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [risksRes, evidenceRes, frameworkStatusRes] = await Promise.all([
          fetch("/api/risks"),
          fetch("/api/evidence"),
          fetch("/api/frameworks/status"),
        ]);

        const [risksData, evidenceData, frameworkStatusData] = await Promise.all([
          risksRes.json(),
          evidenceRes.json(),
          frameworkStatusRes.json(),
        ]);

        setRisks(risksData.risks || []);
        setEvidence(evidenceData.evidence || []);

        // Compute framework readiness from real status data
        const reqStatuses: Record<string, string> =
          frameworkStatusData.requirement_statuses || {};

        const FRAMEWORK_CONFIGS = [
          { key: "SOC2", name: "SOC 2 Type II", total: 60, color: "blue" as const },
          { key: "ISO27001", name: "ISO 27001:2022", total: 93, color: "purple" as const },
          { key: "NIST_CSF", name: "NIST CSF", total: 108, color: "green" as const },
        ];

        const computed = FRAMEWORK_CONFIGS.map((fw) => {
          const { implemented, progress } = computeFrameworkStats(
            reqStatuses,
            fw.key,
            fw.total
          );
          return {
            name: fw.name,
            color: fw.color,
            total: fw.total,
            implemented,
            progress,
          };
        });

        setFrameworkStatuses(computed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

  // Derived stats
  const totalRisks = risks.length;
  const criticalRisks = risks.filter(
    (r) => typeof r.inherent_score === "number" && r.inherent_score >= 20
  ).length;
  const recentRisks = risks.slice(0, 4);

  // Evidence expiry helpers
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingEvidence = evidence
    .filter((e) => e.status === "pending" || e.status === "overdue")
    .slice(0, 4);

  function getEvidenceExpiry(ev: EvidenceRow): { label: string; overdue: boolean } {
    if (!ev.valid_to) return { label: "No expiry set", overdue: false };
    const expiry = new Date(ev.valid_to);
    expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.round((expiry.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return { label: `${Math.abs(diffDays)} days ago`, overdue: true };
    if (diffDays === 0) return { label: "today", overdue: true };
    if (diffDays === 1) return { label: "tomorrow", overdue: false };
    if (diffDays <= 7) return { label: `${diffDays} days`, overdue: false };
    return { label: `${Math.ceil(diffDays / 7)} weeks`, overdue: false };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back. Here&apos;s your GRC posture at a glance.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Last updated:{" "}
          {new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-md bg-orange-50 border border-orange-200 text-orange-800 text-sm">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Risks"
          value={loading ? "—" : String(totalRisks)}
          change={loading ? "" : `${criticalRisks} critical`}
          trend={criticalRisks > 0 ? "down" : "neutral"}
          icon="⚠️"
        />
        <StatCard
          title="Critical Risks"
          value={loading ? "—" : String(criticalRisks)}
          change={loading ? "" : "Score ≥ 20"}
          trend={criticalRisks > 0 ? "down" : "neutral"}
          icon="🔴"
        />
        <StatCard
          title="Pending Evidence"
          value={loading ? "—" : String(pendingEvidence.length)}
          change={loading ? "" : "awaiting review"}
          trend="neutral"
          icon="📁"
        />
        <StatCard
          title="SOC 2 Readiness"
          value={
            loading
              ? "—"
              : frameworkStatuses[0]
              ? `${frameworkStatuses[0].progress}%`
              : "—"
          }
          change={
            loading
              ? ""
              : frameworkStatuses[0]
              ? `${frameworkStatuses[0].implemented} / ${frameworkStatuses[0].total} requirements`
              : ""
          }
          trend={
            !loading && frameworkStatuses[0] && frameworkStatuses[0].progress >= 75
              ? "up"
              : "neutral"
          }
          icon="✅"
        />
      </div>

      {/* Framework Progress */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Compliance Frameworks</h2>
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-5 rounded-lg border bg-card animate-pulse">
                <div className="h-5 bg-muted rounded w-3/4 mb-3" />
                <div className="h-8 bg-muted rounded w-1/4 mb-3" />
                <div className="h-2 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {frameworkStatuses.map((fw) => (
              <FrameworkCard
                key={fw.name}
                name={fw.name}
                progress={fw.progress}
                controls={fw.total}
                implemented={fw.implemented}
                color={fw.color}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-3">
          <QuickAction icon="⚠️" label="Register Risk" href="/dashboard/risks" />
          <QuickAction icon="📁" label="Upload Evidence" href="/dashboard/evidence" />
          <QuickAction icon="🛡️" label="Map Control" href="/dashboard/controls" />
          <QuickAction icon="📋" label="View Frameworks" href="/dashboard/frameworks" />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Risks</h2>
            <Link
              href="/dashboard/risks"
              className="text-sm text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-md border bg-card animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : recentRisks.length === 0 ? (
            <div className="p-6 rounded-md border bg-card text-center text-muted-foreground">
              <p className="text-sm">No risks registered yet.</p>
              <Link
                href="/dashboard/risks"
                className="text-sm text-primary hover:underline mt-1 inline-block"
              >
                Register your first risk →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRisks.map((risk) => (
                <RiskItem
                  key={risk.id}
                  title={risk.title}
                  score={risk.inherent_score ?? 0}
                  status={risk.status}
                  id={risk.risk_id || `RISK-${risk.id.slice(0, 6).toUpperCase()}`}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Pending Evidence</h2>
            <Link
              href="/dashboard/evidence"
              className="text-sm text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-md border bg-card animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : pendingEvidence.length === 0 ? (
            <div className="p-6 rounded-md border bg-card text-center text-muted-foreground">
              <p className="text-sm">No pending evidence items.</p>
              <Link
                href="/dashboard/evidence"
                className="text-sm text-primary hover:underline mt-1 inline-block"
              >
                Add evidence →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingEvidence.map((ev) => {
                const expiry = getEvidenceExpiry(ev);
                const controlCode = ev.metadata?.control_code || "";
                return (
                  <EvidenceItem
                    key={ev.id}
                    title={ev.title}
                    control={controlCode || "—"}
                    dueIn={expiry.label}
                    overdue={expiry.overdue}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  change,
  trend,
  icon,
}: {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: string;
}) {
  return (
    <div className="p-6 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{title}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      <p
        className={`text-sm mt-2 ${
          trend === "up"
            ? "text-green-600"
            : trend === "down"
            ? "text-red-600"
            : "text-muted-foreground"
        }`}
      >
        {trend === "up" ? "↑" : trend === "down" ? "↓" : ""} {change}
      </p>
    </div>
  );
}

function FrameworkCard({
  name,
  progress,
  controls,
  implemented,
  color,
}: {
  name: string;
  progress: number;
  controls: number;
  implemented: number;
  color: "blue" | "purple" | "green";
}) {
  const colorClasses = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    green: "bg-green-500",
  };

  return (
    <div className="p-5 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">{name}</h3>
        <span className="text-2xl font-bold">{progress}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full ${colorClasses[color]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {implemented} of {controls} requirements implemented
      </p>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  href,
}: {
  icon: string;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-2 rounded-md border bg-card hover:bg-accent transition-colors"
    >
      <span>{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function RiskItem({
  title,
  score,
  status,
  id,
}: {
  title: string;
  score: number;
  status: string;
  id: string;
}) {
  const scoreClass =
    score >= 20
      ? "bg-red-100 text-red-700"
      : score >= 15
      ? "bg-orange-100 text-orange-700"
      : score >= 10
      ? "bg-yellow-100 text-yellow-700"
      : "bg-green-100 text-green-700";

  const statusColors: Record<string, string> = {
    identified: "text-red-600",
    assessed: "text-orange-600",
    mitigated: "text-green-600",
    accepted: "text-blue-600",
    closed: "text-muted-foreground",
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p
          className={`text-xs capitalize ${
            statusColors[status] || "text-muted-foreground"
          }`}
        >
          {id} · {status}
        </p>
      </div>
      <span className={`px-2 py-1 rounded text-sm font-bold ${scoreClass}`}>
        {score}
      </span>
    </div>
  );
}

function EvidenceItem({
  title,
  control,
  dueIn,
  overdue,
}: {
  title: string;
  control: string;
  dueIn: string;
  overdue: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">
          {control !== "—" ? `Control: ${control}` : "No control linked"}
        </p>
      </div>
      <span
        className={`text-xs font-medium ${
          overdue ? "text-red-600" : "text-orange-600"
        }`}
      >
        {overdue ? "⚠ " : ""}Due {dueIn}
      </span>
    </div>
  );
}
