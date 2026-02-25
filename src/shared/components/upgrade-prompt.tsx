"use client";

import { useState } from "react";
import { X, Zap, ArrowRight } from "lucide-react";

interface UpgradePromptProps {
  reason: "ai_limit" | "feature_locked" | "seat_limit";
  featureName?: string;
  onDismiss?: () => void;
  variant?: "banner" | "modal" | "inline";
  contributors?: number;
}

const COPY = {
  ai_limit: {
    title: "You've used all 10 free AI sessions",
    body: "Upgrade to Growth for unlimited AI copilot sessions, all compliance frameworks, and Slack/Jira/GitHub integrations.",
    cta: "Upgrade to Growth",
  },
  feature_locked: {
    title: "This feature requires Growth",
    body: "Unlock unlimited AI, multi-framework gap analysis, integrations, and audit-ready exports.",
    cta: "Unlock this feature",
  },
  seat_limit: {
    title: "Seat limit reached",
    body: "Add more contributor seats to invite additional team members who can create and edit records.",
    cta: "Add seats",
  },
} as const;

export function UpgradePrompt({
  reason,
  featureName,
  onDismiss,
  variant = "banner",
  contributors = 2,
}: UpgradePromptProps) {
  const [loading, setLoading] = useState(false);
  const copy = COPY[reason];
  const title = featureName ? `${featureName} requires Growth` : copy.title;

  async function handleUpgrade() {
    setLoading(true);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contributors, readonly_users: 0, interval: "year" }),
    });
    if (res.status === 401) {
      window.location.href = "/register?plan=growth";
      return;
    }
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading(false);
  }

  if (variant === "inline") {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
        <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{copy.body}</p>
        </div>
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="shrink-0 flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "…" : copy.cta}
          {!loading && <ArrowRight className="h-3 w-3" />}
        </button>
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div className="relative rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3">
        <Zap className="h-4 w-4 text-primary shrink-0" />
        <p className="flex-1 text-sm">
          <span className="font-semibold">{title}. </span>
          <span className="text-muted-foreground">{copy.body}</span>
        </p>
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="shrink-0 flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "…" : copy.cta}
        </button>
        {onDismiss && (
          <button onClick={onDismiss} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // modal
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border bg-card shadow-2xl p-8 text-center">
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute right-4 top-4 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{copy.body}</p>
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Redirecting…" : copy.cta}
        </button>
        <p className="mt-3 text-xs text-muted-foreground">14-day free trial · No credit card required</p>
      </div>
    </div>
  );
}
