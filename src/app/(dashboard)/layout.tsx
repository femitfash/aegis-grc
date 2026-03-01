"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/shared/components/brand-logo";
import { CopilotPanel } from "@/features/copilot/components/CopilotPanel";
import { UserMenu } from "@/features/auth/components/UserMenu";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: "📊" },
  { name: "Risks", href: "/dashboard/risks", icon: "⚠️" },
  { name: "Controls", href: "/dashboard/controls", icon: "🛡️" },
  { name: "Evidence", href: "/dashboard/evidence", icon: "📁" },
  { name: "Frameworks", href: "/dashboard/frameworks", icon: "📋" },
  { name: "Policies", href: "/dashboard/policies", icon: "📜" },
  { name: "Vendors", href: "/dashboard/vendors", icon: "🏢" },
  { name: "Incidents", href: "/dashboard/incidents", icon: "🚨" },
  { name: "Agents", href: "/dashboard/agents", icon: "🤖" },
  { name: "Integrations", href: "/dashboard/integrations", icon: "🔌" },
  { name: "Reports", href: "/dashboard/reports", icon: "📈" },
  { name: "Audit Log", href: "/dashboard/audit-log", icon: "🔒" },
  { name: "Settings", href: "/dashboard/settings", icon: "⚙️" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [plan, setPlan] = useState<string>("builder");
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    fetch("/api/billing/subscription")
      .then((r) => r.json())
      .then((data) => { if (data.subscription?.plan) setPlan(data.subscription.plan); })
      .catch(() => {});

    // Check if user has completed onboarding
    fetch("/api/user/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (!data.onboarded) {
          setShowOnboarding(true);
          setCopilotOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    fetch("/api/user/onboarding", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className={`w-64 border-r bg-card flex flex-col ${showOnboarding ? "pointer-events-none select-none" : ""}`}>
        <div className="p-4 border-b">
          <Link href="/dashboard" className="flex items-center" suppressHydrationWarning>
            <BrandLogo className="text-2xl" />
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                suppressHydrationWarning
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <span>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Upgrade CTA — only shown on free Builder plan */}
        {plan === "builder" && (
          <div className="px-4 pt-2">
            <Link
              href="/dashboard/settings?tab=billing"
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
            >
              <span>⚡</span>
              <span className="flex-1">Upgrade to Growth</span>
              <span className="text-xs opacity-70">$39/mo</span>
            </Link>
          </div>
        )}

        {/* Copilot toggle */}
        <div className="px-4 pt-2 pb-3">
          <button
            onClick={() => setCopilotOpen(!copilotOpen)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <span>🤖</span>
            {copilotOpen ? "Hide Copilot" : "Show Copilot"}
          </button>
        </div>

        {/* User menu */}
        <div className="px-4 py-3 border-t">
          <UserMenu />
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 overflow-auto ${showOnboarding ? "pointer-events-none select-none" : ""}`}>
        <div className="p-8">{children}</div>
      </main>

      {/* Onboarding overlay — grays out sidebar + main, highlights copilot */}
      {showOnboarding && (
        <>
          {/* Semi-transparent overlay covering sidebar + main content (not copilot) */}
          <div className="fixed inset-0 bg-black/50 z-40" style={{ right: copilotOpen ? "384px" : "0" }} />

          {/* Onboarding callout card — positioned left of copilot */}
          <div
            className="fixed z-50 flex items-start gap-3"
            style={{ right: copilotOpen ? "400px" : "16px", top: "30%" }}
          >
            <div className="bg-card border-2 border-primary rounded-xl shadow-2xl p-5 max-w-xs">
              <h3 className="text-base font-bold mb-2">Welcome to FastGRC!</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Meet your <strong className="text-primary">AI Copilot</strong> &mdash; the fastest way to manage compliance.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                <strong className="text-foreground">Click a suggestion</strong> in the Copilot panel to see it in action, or type your own request.
              </p>
              <button
                onClick={dismissOnboarding}
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
              >
                Skip intro
              </button>
              {/* Arrow pointing right toward copilot */}
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[8px] border-y-transparent border-l-[8px] border-l-primary" />
            </div>
          </div>
        </>
      )}

      {/* Copilot Panel — receives current page context so the AI can tailor suggestions */}
      {copilotOpen && (
        <div className={showOnboarding ? "relative z-50 ring-2 ring-primary ring-offset-2 rounded-l-lg" : ""}>
          <CopilotPanel
            onClose={() => { if (!showOnboarding) setCopilotOpen(false); }}
            context={{ page: pathname }}
            onFirstMessage={showOnboarding ? dismissOnboarding : undefined}
            highlightPrompts={showOnboarding}
          />
        </div>
      )}
    </div>
  );
}
