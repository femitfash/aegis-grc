"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, ChevronDown, Minus, Plus } from "lucide-react";
import { ContactButton } from "./contact-button";

// Display prices in dollars
const P = {
  contributor_monthly: 49,
  contributor_annual: 39,
  readonly_monthly: 9.99,
  readonly_annual: 7.99,
} as const;

function fmt(n: number) {
  return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
}

function SeatCounter({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-7 w-7 rounded border flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors disabled:opacity-40"
          disabled={value <= min}
        >
          <Minus className="h-3 w-3" />
        </button>
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
          className="w-14 text-center text-sm border rounded py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={() => onChange(value + 1)}
          className="h-7 w-7 rounded border flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function PricingSection() {
  const [annual, setAnnual] = useState(true);
  const [contributors, setContributors] = useState(2);
  const [readOnly, setReadOnly] = useState(0);

  const cp = annual ? P.contributor_annual : P.contributor_monthly;
  const rp = annual ? P.readonly_annual : P.readonly_monthly;
  const monthlyTotal = contributors * cp + readOnly * rp;
  const annualTotal = monthlyTotal * 12;
  const monthlyComparison = contributors * P.contributor_monthly + readOnly * P.readonly_monthly;
  const annualSavings = (monthlyComparison - monthlyTotal) * 12;

  async function startCheckout() {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contributors, readonly_users: readOnly, interval: annual ? "year" : "month" }),
    });
    if (res.status === 401) {
      // Not logged in — send to register with plan hint
      window.location.href = `/register?plan=growth&c=${contributors}&r=${readOnly}&i=${annual ? "year" : "month"}`;
      return;
    }
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
    else if (data.error) alert(data.error);
  }

  return (
    <section id="pricing" className="bg-muted/20 px-6 py-24">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
          Compliance through conversation.
        </h2>
        <p className="mb-2 text-muted-foreground">
          Not forms. Not spreadsheets. Not $75k contracts.
        </p>

        {/* Annual / Monthly toggle */}
        <div className="mt-6 mb-12 inline-flex items-center gap-1 rounded-full border bg-card p-1">
          <button
            onClick={() => setAnnual(true)}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              annual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Annual
            <span className="ml-1.5 text-xs font-normal opacity-80">save ~20%</span>
          </button>
          <button
            onClick={() => setAnnual(false)}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              !annual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* BUILDER */}
          <div className="rounded-xl border border-border bg-card p-8 text-left">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Builder</div>
            <div className="mb-1 text-3xl font-bold">$0</div>
            <div className="mb-6 text-sm text-muted-foreground">1 contributor · forever free</div>
            <ul className="mb-6 space-y-2.5 text-sm text-muted-foreground">
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
            <details className="mb-6 group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                See what&apos;s included
              </summary>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground border-t border-border pt-3">
                {[
                  "Dashboard: risks, controls, evidence & audit log",
                  "Choose 1 framework: SOC 2, ISO 27001, NIST CSF, or HIPAA",
                  "PDF exports (FastGRC.ai watermark)",
                  "Data stored in your preferred region (EU / US)",
                  "No integrations on free plan",
                  "Upgrade anytime — data carries over",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-muted-foreground/50">–</span>
                    {item}
                  </li>
                ))}
              </ul>
            </details>
            <Link
              href="/register"
              className="block w-full rounded-md border border-input bg-background py-2.5 text-center text-sm font-semibold transition-colors hover:bg-accent"
            >
              Get started free
            </Link>
            <p className="mt-3 text-center text-xs text-muted-foreground">No credit card required</p>
          </div>

          {/* GROWTH */}
          <div className="relative rounded-xl border-2 border-primary bg-card p-8 text-left shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-0.5 text-xs font-semibold text-primary-foreground">
              Most popular
            </div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Growth</div>
            <div className="mb-1 flex items-end gap-1">
              <span className="text-3xl font-bold">{fmt(cp)}</span>
              <span className="text-sm text-muted-foreground mb-1">/contributor/mo</span>
            </div>
            <div className="mb-1 text-sm text-muted-foreground">
              {annual ? `billed annually · ${fmt(rp)}/read-only/mo` : `${fmt(rp)}/read-only/mo`}
            </div>
            <div className="mb-5 text-xs text-muted-foreground">min 2 contributors</div>

            {/* Seat calculator */}
            <div className="mb-5 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Calculate your cost</p>
              <SeatCounter label="Contributors" value={contributors} min={2} onChange={setContributors} />
              <SeatCounter label="Read-only users" value={readOnly} min={0} onChange={setReadOnly} />
              <div className="border-t border-border pt-3 mt-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span>{fmt(monthlyTotal)}/mo</span>
                </div>
                {annual && (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                      <span>Billed annually</span>
                      <span>{fmt(annualTotal)}/yr</span>
                    </div>
                    {annualSavings > 0.5 && (
                      <div className="mt-1.5 text-xs font-medium text-green-600">
                        You save {fmt(Math.round(annualSavings))}/yr vs monthly
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <ul className="mb-6 space-y-2.5 text-sm text-muted-foreground">
              {[
                "Unlimited AI copilot sessions",
                "All compliance frameworks",
                "Multi-framework gap analysis",
                "Slack, Jira & GitHub integration",
                "Audit-ready report exports",
                "Email support (1 business day)",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <details className="mb-6 group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                See what&apos;s included
              </summary>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground border-t border-border pt-3">
                {[
                  "Everything in Builder",
                  "SOC 2, ISO 27001, NIST CSF & HIPAA simultaneously",
                  "Slack: risk alerts + copilot in your channel",
                  "Jira: auto-create tickets from risks & controls",
                  "GitHub: sync security alerts to risk register",
                  "Read-only users: $9.99/mo (or $7.99/mo annual)",
                  "PDF & CSV exports (no watermark)",
                  "SSO not included (Enterprise only)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-muted-foreground/50">–</span>
                    {item}
                  </li>
                ))}
              </ul>
            </details>
            <button
              onClick={startCheckout}
              className="block w-full rounded-md bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start 14-day free trial
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">No credit card required for trial</p>
          </div>

          {/* ENTERPRISE */}
          <div className="rounded-xl border border-border bg-card p-8 text-left">
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Enterprise</div>
            <div className="mb-1 text-3xl font-bold">Custom</div>
            <div className="mb-6 text-sm text-muted-foreground">volume pricing · annual contracts</div>
            <ul className="mb-6 space-y-2.5 text-sm text-muted-foreground">
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
            <details className="mb-6 group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                See what&apos;s included
              </summary>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground border-t border-border pt-3">
                {[
                  "Everything in Growth",
                  "SSO via SAML 2.0 or OIDC + SCIM provisioning",
                  "Custom data residency (EU, US, or on-prem)",
                  "Vendor risk module with tier-based scoring",
                  "REST API + webhooks for custom integrations",
                  "Custom SLA with uptime guarantee",
                  "Quarterly business reviews",
                  "Negotiated multi-year pricing",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-muted-foreground/50">–</span>
                    {item}
                  </li>
                ))}
              </ul>
            </details>
            <ContactButton
              label="Talk to Sales"
              className="block w-full rounded-md border border-input bg-background py-2.5 text-center text-sm font-semibold transition-colors hover:bg-accent"
            />
            <p className="mt-3 text-center text-xs text-muted-foreground">Response within 1 business day</p>
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> No credit card required for trial</span>
          <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Audit-ready exports on every paid plan</span>
          <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Used by security teams doing SOC 2, ISO 27001, NIST &amp; HIPAA</span>
        </div>

        {/* FAQ */}
        <div className="mt-16 text-left">
          <h3 className="mb-6 text-xl font-semibold text-center">Frequently asked questions</h3>
          <div className="mx-auto max-w-2xl divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
            {[
              {
                q: `What does "Unlimited AI Copilot (fair use)" mean?`,
                a: `On the Growth plan, AI sessions are unlimited for normal team use. Fair use means we reserve the right to throttle accounts sending thousands of automated requests — something that never affects teams using FastGRC.ai the way it's designed.`,
              },
              {
                q: "Why does Growth require a minimum of 2 contributors?",
                a: "Growth includes dedicated infrastructure, integrations (Slack, Jira, GitHub), and email support. The minimum of 2 contributors covers the baseline cost to serve a team reliably. As your team grows, you simply add $49/contributor/mo (or $39 annual).",
              },
              {
                q: "Can I start with 2 contributors and grow later?",
                a: "Yes. Upgrade seats anytime from Settings → Billing. Stripe prorates the change immediately so you only pay for what you use. Your data, risks, and audit history carry over seamlessly.",
              },
              {
                q: "Are read-only users $9.99 or $7.99?",
                a: "Read-only users are $9.99/seat/month on monthly billing, or $7.99/seat/month when billed annually ($95.88/year per seat). Auditors, stakeholders, and leadership who only view — never edit — count as read-only.",
              },
              {
                q: "Which frameworks are included?",
                a: "Builder includes 1 framework (SOC 2, ISO 27001:2022, NIST CSF 2.0, or HIPAA — your choice). Growth and Enterprise include all four simultaneously, with cross-framework gap analysis and requirement mapping.",
              },
              {
                q: "What support is provided on each plan?",
                a: "Builder: community forum and documentation. Growth: email support with a 1-business-day response guarantee. Enterprise: dedicated success manager, shared Slack channel, quarterly business reviews, and a custom SLA.",
              },
              {
                q: "Can I switch plans anytime?",
                a: "Yes. Upgrade instantly — Stripe prorates the difference. Downgrades take effect at the end of your billing period so you never lose paid time.",
              },
            ].map(({ q, a }) => (
              <details key={q} className="group px-6 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-sm [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
