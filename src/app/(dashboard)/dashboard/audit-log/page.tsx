"use client";

import { useState, useEffect, useCallback } from "react";

interface AuditEntry {
  id: string;
  sequence_number: number;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  entry_hash: string;
  previous_hash: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  READ: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const ENTITY_ICONS: Record<string, string> = {
  risk: "⚠️",
  control: "🛡️",
  evidence: "📁",
  framework: "📋",
  requirement: "✅",
  user: "👤",
  organization: "🏢",
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (entityFilter !== "all") params.set("entity_type", entityFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);

      const res = await fetch(`/api/audit-log?${params}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [entityFilter, actionFilter, offset]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const allEntityTypes = Array.from(new Set(entries.map((e) => e.entity_type))).filter(Boolean);

  function hashShort(hash: string | null) {
    if (!hash) return "—";
    return hash.slice(0, 8) + "…" + hash.slice(-4);
  }

  function formatChanges(oldVals: Record<string, unknown> | null, newVals: Record<string, unknown> | null) {
    if (!oldVals && !newVals) return null;
    const keys = new Set([...Object.keys(oldVals || {}), ...Object.keys(newVals || {})]);
    return Array.from(keys)
      .filter((k) => !["id", "created_at", "updated_at"].includes(k))
      .map((key) => {
        const oldV = oldVals?.[key];
        const newV = newVals?.[key];
        if (oldV === newV) return null;
        return { key, oldV, newV };
      })
      .filter(Boolean) as { key: string; oldV: unknown; newV: unknown }[];
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            Immutable record of all GRC actions with cryptographic hash chain verification
          </p>
        </div>
        <button
          onClick={fetchLog}
          disabled={loading}
          className="px-3 py-2 rounded-md border text-sm hover:bg-accent transition-colors disabled:opacity-50"
        >
          {loading ? "⟳" : "↻"} Refresh
        </button>
      </div>

      {/* Hash chain info banner */}
      <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-3">
        <span className="text-lg">🔒</span>
        <div>
          <p className="text-sm font-medium">SHA-512 Hash Chain Verification</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every entry is cryptographically chained to the previous entry. Database triggers prevent any modification or deletion — this log is tamper-proof and audit-ready.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {["all", "CREATE", "UPDATE", "DELETE"].map((a) => (
            <button
              key={a}
              onClick={() => { setActionFilter(a); setOffset(0); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                actionFilter === a ? "bg-primary text-primary-foreground" : "border hover:bg-accent"
              }`}
            >
              {a === "all" ? "All Actions" : a}
            </button>
          ))}
        </div>

        {allEntityTypes.length > 0 && (
          <div className="flex gap-1">
            {["all", ...allEntityTypes].map((t) => (
              <button
                key={t}
                onClick={() => { setEntityFilter(t); setOffset(0); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  entityFilter === t ? "bg-primary/20 text-primary border border-primary/30" : "border hover:bg-accent"
                }`}
              >
                {t === "all" ? "All Types" : t}
              </button>
            ))}
          </div>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {loading ? "Loading..." : `${entries.length} entries`}
        </span>
      </div>

      {/* Log table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading audit log...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-lg font-medium">No audit log entries yet</p>
            <p className="text-sm mt-1 max-w-md mx-auto">
              Entries are automatically recorded when you create risks, controls, frameworks, or evidence.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-12">#</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-20">Action</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Hash</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-12"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const changes = formatChanges(entry.old_values, entry.new_values);
                const isExpanded = expandedId === entry.id;
                return (
                  <>
                    <tr
                      key={entry.id}
                      className={`border-b hover:bg-accent/30 cursor-pointer transition-colors ${
                        isExpanded ? "bg-primary/5" : i % 2 === 0 ? "" : "bg-muted/10"
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {entry.sequence_number}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ACTION_COLORS[entry.action] || "bg-gray-100 text-gray-600"}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs">
                          <span>{ENTITY_ICONS[entry.entity_type] || "📄"}</span>
                          <span className="font-medium capitalize">{entry.entity_type}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {entry.entity_id?.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {hashShort(entry.entry_hash)}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {isExpanded ? "▲" : "▼"}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`detail-${entry.id}`}>
                        <td colSpan={7} className="p-0">
                          <div className="bg-muted/20 border-b px-6 py-4 space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-muted-foreground mb-1 font-medium">Entry Hash</p>
                                <code className="font-mono text-[10px] break-all bg-muted px-2 py-1 rounded block">
                                  {entry.entry_hash || "—"}
                                </code>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-1 font-medium">Previous Hash</p>
                                <code className="font-mono text-[10px] break-all bg-muted px-2 py-1 rounded block">
                                  {entry.previous_hash || "Genesis (first entry)"}
                                </code>
                              </div>
                            </div>

                            {changes && changes.length > 0 && (
                              <div>
                                <p className="text-muted-foreground mb-2 font-medium">Changes</p>
                                <div className="space-y-1">
                                  {changes.map(({ key, oldV, newV }) => (
                                    <div key={key} className="flex items-start gap-2">
                                      <span className="font-mono font-semibold text-foreground min-w-[120px]">{key}:</span>
                                      {oldV !== undefined && (
                                        <span className="line-through text-muted-foreground">
                                          {String(oldV)}
                                        </span>
                                      )}
                                      {oldV !== undefined && newV !== undefined && <span className="text-muted-foreground">→</span>}
                                      {newV !== undefined && (
                                        <span className="text-foreground font-medium">{String(newV)}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {entries.length >= LIMIT && (
        <div className="mt-4 flex justify-center gap-3">
          {offset > 0 && (
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
            >
              ← Previous
            </button>
          )}
          <button
            onClick={() => setOffset(offset + LIMIT)}
            className="px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
