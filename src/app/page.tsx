import Link from "next/link";
import { ContactButton } from "./contact-button";
import {
  Shield,
  MessageSquare,
  FileCheck,
  TrendingDown,
  Lock,
  Zap,
  CheckCircle,
  XCircle,
  ArrowRight,
  BarChart3,
  Globe,
  Clock,
  GitBranch,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">Aegis GRC</span>
          </div>
          <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#frameworks" className="transition-colors hover:text-foreground">Frameworks</a>
            <a href="#comparison" className="transition-colors hover:text-foreground">Compare</a>
            <Link href="/prompts" className="transition-colors hover:text-foreground">Prompts</Link>
            <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Get started free <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      {/* ─── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20 md:pt-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]" />
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            AI-Native GRC Platform · SOC 2 · ISO 27001 · NIST · GitHub · Jira · Slack
          </div>

          <h1 className="mb-6 font-display text-4xl font-bold md:text-7xl">
            Compliance through{" "}
            <span className="text-primary">conversation,</span>
            <br />not forms
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Aegis is the first GRC platform where AI is the primary interface.
            Log risks in plain English, track frameworks automatically, and get
            audit-ready — in minutes, not months.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-primary/25 hover:shadow-xl"
            >
              Start free — no credit card needed
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-8 py-3 text-sm font-semibold shadow-sm transition-colors hover:bg-accent"
            >
              See how it works
            </a>
          </div>

          {/* Chat demo preview */}
          <div className="mx-auto mt-16 max-w-2xl rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500/70" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <span className="h-3 w-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs text-muted-foreground">Aegis Copilot</span>
            </div>
            <div className="space-y-4 p-6 text-left text-sm">
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">You</div>
                <div className="rounded-lg bg-muted px-4 py-2.5 text-muted-foreground">
                  Our S3 buckets might be publicly accessible. We don&apos;t have a process for reviewing this yet.
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">AI</div>
                <div className="space-y-2">
                  <div className="rounded-lg border border-border bg-background px-4 py-2.5 text-muted-foreground">
                    I&apos;ll create a risk for unauthorized S3 exposure. I&apos;m assessing it as <strong className="text-foreground">High likelihood / High impact</strong> — score 20/25. I&apos;ll also suggest a mitigation control.
                  </div>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                      <CheckCircle className="h-3 w-3" /> RISK-A1B2 created
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                      <FileCheck className="h-3 w-3" /> Control suggested
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats bar ───────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/30 px-6 py-12">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { value: "15 min", label: "Average setup time" },
            { value: "0 fields", label: "To log a risk" },
            { value: "10 free", label: "AI actions to start" },
            { value: "GitHub · Jira · Slack", label: "Native integrations" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-primary md:text-3xl">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Prompts Preview ─────────────────────────────────── */}
      <section className="border-y border-border/40 bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              ✨ Copilot Prompt Library
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-tight">
              Zero forms. Just describe what you need.
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Every action in Aegis can be done through conversation. Here are a few examples of what
              you can say — no training required.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "🛡️",
                category: "Risk Management",
                prompt: "Register a risk: our S3 buckets may be publicly accessible, exposing customer data.",
                result: "Creates a high-severity risk with likelihood/impact scoring",
              },
              {
                icon: "📋",
                category: "Compliance",
                prompt: "What's our current SOC 2 Type II readiness? Which criteria are incomplete?",
                result: "Shows completion % per Trust Services Criteria with gaps",
              },
              {
                icon: "🔒",
                category: "Controls",
                prompt: "Create a preventive control for encrypting data at rest using AES-256.",
                result: "Creates a control record linked to relevant frameworks",
              },
              {
                icon: "📁",
                category: "Evidence",
                prompt: "Record evidence that we completed our annual pen test in January with no critical findings.",
                result: "Creates an evidence record with test metadata attached",
              },
              {
                icon: "🔗",
                category: "Integrations",
                prompt: "Import open Dependabot alerts from GitHub and create risks for critical ones.",
                result: "Automatically syncs vulnerabilities from your repos",
              },
              {
                icon: "📊",
                category: "Reporting",
                prompt: "We have a SOC 2 audit in 30 days. What do we still need and what evidence is missing?",
                result: "Prioritized audit-prep checklist with evidence gaps",
              },
            ].map((item) => (
              <div
                key={item.category}
                className="rounded-xl border bg-card p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {item.category}
                  </span>
                </div>
                <blockquote className="mb-3 rounded-lg border-l-2 border-primary/40 bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground italic">
                  &ldquo;{item.prompt}&rdquo;
                </blockquote>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">→ </span>
                  {item.result}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/prompts"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            >
              Browse all {27} prompts <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Pain vs Gain ────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Traditional GRC is broken
            </h2>
            <p className="text-muted-foreground">
              Most platforms were built for auditors, not the teams actually doing the work.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Before */}
            <div className="rounded-xl border border-border bg-card p-8">
              <div className="mb-6 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <span className="font-semibold text-destructive">Traditional GRC platforms</span>
              </div>
              <ul className="space-y-4 text-sm text-muted-foreground">
                {[
                  "50+ form fields before you see any value",
                  "6 dropdown menus to log a single risk",
                  "Weeks of consultant time to get started",
                  "$15k–$50k/year with no free tier",
                  "Checkbox compliance, not real risk reduction",
                  "Auditor portal as an afterthought",
                  "Zero AI — manual everything",
                ].map((pain) => (
                  <li key={pain} className="flex items-start gap-3">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive/60" />
                    {pain}
                  </li>
                ))}
              </ul>
            </div>

            {/* After */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-8">
              <div className="mb-6 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="font-semibold text-primary">Aegis GRC</span>
              </div>
              <ul className="space-y-4 text-sm text-muted-foreground">
                {[
                  "Describe risks in plain English — AI does the rest",
                  "One sentence to create a fully scored risk",
                  "Ready to use in 15 minutes, no consultant needed",
                  "Free tier + bring your own Anthropic API key",
                  "Risk reduction metrics, not just checkbox counts",
                  "Audit-ready trail with cryptographic verification",
                  "AI copilot is the primary interface, not a chatbot add-on",
                  "Connect GitHub, Jira, and Slack in under 2 minutes",
                ].map((gain) => (
                  <li key={gain} className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {gain}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────── */}
      <section id="features" className="bg-muted/20 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Built for how security teams actually work
            </h2>
            <p className="text-muted-foreground">
              Every feature is designed to reduce friction, not add it.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: MessageSquare,
                title: "AI Copilot — Primary Interface",
                description:
                  "Chat is not a sidebar feature. The copilot is how you create risks, manage controls, update compliance status, and query your posture. Powered by Claude.",
              },
              {
                icon: TrendingDown,
                title: "Zero-Field Risk Entry",
                description:
                  "Say 'our AWS S3 buckets might be public.' Aegis extracts title, description, likelihood, impact score, and suggests a mitigation control — automatically.",
              },
              {
                icon: FileCheck,
                title: "Multi-Framework Compliance",
                description:
                  "SOC 2 Type II, ISO 27001:2022, NIST CSF, HIPAA, and custom frameworks. Track readiness across all frameworks from a single dashboard.",
              },
              {
                icon: Lock,
                title: "Immutable Audit Trail",
                description:
                  "Every action is logged with a cryptographic hash chain. Evidence collection, control changes, and risk updates are all tamper-proof and auditor-ready.",
              },
              {
                icon: BarChart3,
                title: "Outcome Metrics",
                description:
                  "Track actual risk reduction scores, not just checkbox completion. See how controls reduce your risk exposure over time with quantified metrics.",
              },
              {
                icon: Globe,
                title: "Bring Your Own API Key",
                description:
                  "Use Aegis free for your first 10 AI actions. Then connect your own Anthropic API key for unlimited usage at cost. No vendor lock-in.",
              },
              {
                icon: GitBranch,
                title: "Native Integrations",
                description:
                  "Connect GitHub to auto-import Dependabot security alerts as risks. Create Jira tickets from risks in one sentence. Send Slack alerts when critical risks are flagged.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────── */}
      <section id="how-it-works" className="px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              From zero to audit-ready in 15 minutes
            </h2>
          </div>

          <div className="space-y-12">
            {[
              {
                step: "01",
                title: "Sign up and connect your tools",
                description:
                  "Create a free account, choose your compliance frameworks, and optionally connect GitHub, Jira, or Slack. No setup wizard. No consultant. Under 15 minutes start-to-finish.",
                icon: Clock,
              },
              {
                step: "02",
                title: "Describe your risks in plain English",
                description:
                  "Open the AI copilot and type what you're worried about. 'Our third-party vendors don't have security questionnaires.' Aegis creates a properly scored risk with suggested controls.",
                icon: MessageSquare,
              },
              {
                step: "03",
                title: "Track progress and generate reports",
                description:
                  "Watch your compliance readiness increase in real time. When you're ready for an audit, every action has an immutable, cryptographically verified log that auditors trust.",
                icon: FileCheck,
              },
            ].map((step, i) => (
              <div key={step.step} className="flex gap-8">
                <div className="flex flex-col items-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {step.step}
                  </div>
                  {i < 2 && <div className="mt-4 h-16 w-px bg-border" />}
                </div>
                <div className="pb-4 pt-2">
                  <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Frameworks ──────────────────────────────────────── */}
      <section id="frameworks" className="bg-muted/20 px-6 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            All the frameworks you need
          </h2>
          <p className="mb-12 text-muted-foreground">
            Pre-built frameworks with requirements, control mappings, and readiness tracking.
            Add custom frameworks for internal policies or emerging regulations.
          </p>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { name: "SOC 2 Type II", desc: "~60 Trust Services Criteria", badge: "Most popular" },
              { name: "ISO 27001:2022", desc: "93 Annex A controls", badge: "" },
              { name: "NIST CSF 2.0", desc: "108 subcategories", badge: "" },
              { name: "HIPAA", desc: "Security & Privacy Rules", badge: "" },
              { name: "PCI DSS", desc: "12 requirements", badge: "Coming soon" },
              { name: "GDPR", desc: "Data protection", badge: "Coming soon" },
              { name: "FedRAMP", desc: "US government", badge: "Coming soon" },
              { name: "Custom", desc: "Your internal policies", badge: "" },
            ].map((fw) => (
              <div
                key={fw.name}
                className="relative rounded-lg border border-border bg-card p-4 text-left"
              >
                {fw.badge && (
                  <span className="absolute right-2 top-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {fw.badge}
                  </span>
                )}
                <div className="mb-1 font-semibold text-sm">{fw.name}</div>
                <div className="text-xs text-muted-foreground">{fw.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Comparison ──────────────────────────────────────── */}
      <section id="comparison" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              How Aegis compares to Vanta, Drata & Thoropass
            </h2>
            <p className="text-muted-foreground">
              Other GRC platforms bolt AI on as a sidebar. We built AI as the foundation.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-4 text-left font-medium text-muted-foreground">Feature</th>
                  <th className="px-6 py-4 text-center font-semibold text-primary">Aegis GRC</th>
                  <th className="px-6 py-4 text-center font-medium text-muted-foreground">Vanta</th>
                  <th className="px-6 py-4 text-center font-medium text-muted-foreground">Drata</th>
                  <th className="px-6 py-4 text-center font-medium text-muted-foreground">Thoropass</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  {
                    feature: "AI copilot (primary interface)",
                    aegis: true,
                    vanta: false,
                    drata: false,
                    thoropass: false,
                  },
                  {
                    feature: "Zero-field risk entry",
                    aegis: true,
                    vanta: false,
                    drata: false,
                    thoropass: false,
                  },
                  {
                    feature: "Setup time",
                    aegis: "15 minutes",
                    vanta: "Days",
                    drata: "Days",
                    thoropass: "Weeks",
                  },
                  {
                    feature: "Free tier",
                    aegis: true,
                    vanta: false,
                    drata: false,
                    thoropass: false,
                  },
                  {
                    feature: "Bring your own AI key (BYOK)",
                    aegis: true,
                    vanta: false,
                    drata: false,
                    thoropass: false,
                  },
                  {
                    feature: "Custom frameworks",
                    aegis: true,
                    vanta: "Limited",
                    drata: "Limited",
                    thoropass: "Paid add-on",
                  },
                  {
                    feature: "GitHub / Jira / Slack integrations",
                    aegis: true,
                    vanta: "Limited",
                    drata: "Limited",
                    thoropass: "Paid add-on",
                  },
                  {
                    feature: "Immutable audit trail",
                    aegis: true,
                    vanta: true,
                    drata: true,
                    thoropass: true,
                  },
                  {
                    feature: "Starting price",
                    aegis: "Free",
                    vanta: "$15k+/yr",
                    drata: "$10k+/yr",
                    thoropass: "$20k+/yr",
                  },
                ].map((row) => (
                  <tr key={row.feature} className="transition-colors hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">{row.feature}</td>
                    {[row.aegis, row.vanta, row.drata, row.thoropass].map((val, i) => (
                      <td key={i} className="px-6 py-4 text-center">
                        {typeof val === "boolean" ? (
                          val ? (
                            <CheckCircle className="mx-auto h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="mx-auto h-5 w-5 text-muted-foreground/50" />
                          )
                        ) : (
                          <span className={i === 0 ? "font-medium text-primary" : "text-muted-foreground"}>
                            {val}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            * Competitor information based on publicly available pricing and feature pages. Prices vary by contract.
          </p>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────────────────── */}
      <section id="pricing" className="bg-muted/20 px-6 py-24">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            Compliance through conversation.
          </h2>
          <p className="mb-2 text-muted-foreground">
            Not forms. Not spreadsheets. Not $75k contracts.
          </p>
          <p className="mb-12 text-sm text-muted-foreground">
            No credit card required to start.
          </p>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* BUILDER */}
            <div className="rounded-xl border border-border bg-card p-8 text-left">
              <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Builder</div>
              <div className="mb-1 text-3xl font-bold">$0</div>
              <div className="mb-6 text-sm text-muted-foreground">1 contributor · forever free</div>
              <ul className="mb-8 space-y-2.5 text-sm text-muted-foreground">
                {[
                  "1 compliance framework",
                  "10 AI copilot sessions / month",
                  "Risk register & control library",
                  "Immutable audit trail",
                  "Watermarked report exports",
                  "Community support",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="block w-full rounded-md border border-input bg-background py-2.5 text-center text-sm font-semibold transition-colors hover:bg-accent"
              >
                Get started free
              </Link>
            </div>

            {/* GROWTH */}
            <div className="relative rounded-xl border-2 border-primary bg-card p-8 text-left shadow-lg">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-0.5 text-xs font-semibold text-primary-foreground">
                Most popular
              </div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Growth</div>
              <div className="mb-1 text-3xl font-bold">$49</div>
              <div className="mb-6 text-sm text-muted-foreground">per contributor / month · min $245/mo</div>
              <ul className="mb-8 space-y-2.5 text-sm text-muted-foreground">
                {[
                  "Unlimited AI copilot sessions",
                  "All compliance frameworks",
                  "Multi-framework gap analysis",
                  "Slack & Jira integration",
                  "Audit-ready report exports",
                  "Email support (1 business day)",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="block w-full rounded-md bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Start free trial
              </Link>
            </div>

            {/* ENTERPRISE */}
            <div className="rounded-xl border border-border bg-card p-8 text-left">
              <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Enterprise</div>
              <div className="mb-1 text-3xl font-bold">Custom</div>
              <div className="mb-6 text-sm text-muted-foreground">volume pricing · annual contracts</div>
              <ul className="mb-8 space-y-2.5 text-sm text-muted-foreground">
                {[
                  "Everything in Growth",
                  "SSO (SAML / OIDC)",
                  "Vendor & third-party risk module",
                  "API access & webhooks",
                  "Custom frameworks & controls",
                  "Dedicated success manager",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <ContactButton
                label="Talk to Sales"
                className="block w-full rounded-md border border-input bg-background py-2.5 text-center text-sm font-semibold transition-colors hover:bg-accent"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-primary/5 p-12 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            Ready to simplify compliance?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Join security teams that have replaced 50-field forms with a single conversation.
            Get started free — no credit card, no sales call, no implementation project.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-primary/25 hover:shadow-xl"
          >
            Start for free today
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-8 md:flex-row md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-bold">Aegis GRC</span>
              </div>
              <p className="max-w-xs text-sm text-muted-foreground">
                The AI-native GRC platform. Manage SOC 2, ISO 27001, NIST, and HIPAA compliance
                through conversation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 text-sm md:grid-cols-3">
              <div>
                <div className="mb-3 font-semibold">Product</div>
                <ul className="space-y-2 text-muted-foreground">
                  <li><a href="#features" className="hover:text-foreground">Features</a></li>
                  <li><a href="#frameworks" className="hover:text-foreground">Frameworks</a></li>
                  <li><a href="#features" className="hover:text-foreground">Integrations</a></li>
                  <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                  <li><Link href="/login" className="hover:text-foreground">Sign in</Link></li>
                </ul>
              </div>
              <div>
                <div className="mb-3 font-semibold">Frameworks</div>
                <ul className="space-y-2 text-muted-foreground">
                  <li><span>SOC 2 Type II</span></li>
                  <li><span>ISO 27001:2022</span></li>
                  <li><span>NIST CSF 2.0</span></li>
                  <li><span>HIPAA</span></li>
                </ul>
              </div>
              <div>
                <div className="mb-3 font-semibold">Compare</div>
                <ul className="space-y-2 text-muted-foreground">
                  <li><a href="#comparison" className="hover:text-foreground">vs Vanta</a></li>
                  <li><a href="#comparison" className="hover:text-foreground">vs Drata</a></li>
                  <li><a href="#comparison" className="hover:text-foreground">vs Thoropass</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-8 text-center text-xs text-muted-foreground">
            <p>
              © {new Date().getFullYear()} Aegis GRC. Built for security teams that value their time.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
