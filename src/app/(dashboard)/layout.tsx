"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CopilotPanel } from "@/features/copilot/components/CopilotPanel";
import { UserMenu } from "@/features/auth/components/UserMenu";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: "📊" },
  { name: "Risks", href: "/dashboard/risks", icon: "⚠️" },
  { name: "Controls", href: "/dashboard/controls", icon: "🛡️" },
  { name: "Evidence", href: "/dashboard/evidence", icon: "📁" },
  { name: "Frameworks", href: "/dashboard/frameworks", icon: "📋" },
  { name: "Integrations", href: "/dashboard/integrations", icon: "🔌" },
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
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <Link href="/dashboard" className="flex items-center gap-2" suppressHydrationWarning>
            <span className="text-2xl font-bold">Aegis</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
              GRC
            </span>
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

        {/* Copilot toggle */}
        <div className="px-4 pt-4">
          <button
            onClick={() => setCopilotOpen(!copilotOpen)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <span>🤖</span>
            {copilotOpen ? "Hide Copilot" : "Show Copilot"}
          </button>
        </div>

        {/* User menu */}
        <div className="p-4 border-t">
          <UserMenu />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>

      {/* Copilot Panel — receives current page context so the AI can tailor suggestions */}
      {copilotOpen && (
        <CopilotPanel
          onClose={() => setCopilotOpen(false)}
          context={{ page: pathname }}
        />
      )}
    </div>
  );
}
