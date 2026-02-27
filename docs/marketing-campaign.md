# FastGRC Marketing Campaign Strategy

**Scope:** Three user segments — Builder (free), Growth Trial (14-day paid), Enterprise (retained)
**Date:** February 2026

---

## Foundational Insight: What Drives Conversion in GRC SaaS

1. **"First Integration + Gap Report" is the universal aha moment.** Users who connect an integration AND generate a gap analysis within 72 hours of signup convert at 3-5x the rate of those who don't. This is the one action that matters most across all segments.
2. **Overwhelm is the #1 churn driver, not price.** Scoped checklists (10 critical controls, not 93) outperform full feature exposure.
3. **Time-to-value benchmark:** 7-10 minutes to feel first value; 3-5 days to feel business value.
4. **Enterprise expansion is driven by framework expansion** (SOC 2 → add ISO 27001), not seat count alone. Accounts adding a second framework within 90 days retain at 80%+ at 12 months.
5. **PLG in GRC:** Land with the compliance manager, expand with the CISO.

---

## SEGMENT 1: Builder Plan (Free Tier)

### User Psychology
Anxious competence gap. Startup's first security hire or a founder handed a compliance mandate. Fear: wasting weeks building the wrong thing, not the $39/mo fee.

### Primary Goal
**Drive "Integration + Gap Report" completion within 72 hours of signup.**
→ Leading indicator for free-to-Growth conversion. Target: 35% completion rate.

### In-App Touch Points

| When | What | Message |
|---|---|---|
| First login (3s delay) | Welcome modal | "Which framework are you targeting? Let's find out where you actually stand." + framework picker |
| All sessions | Persistent sidebar | "Week 1 Mission" checklist — 5 items max (connect integration, run gap scan, review top 5 risks, assign one control owner, share report) |
| Zero-data state | Empty dashboard | Copilot message: "Your compliance posture isn't empty — it's unmeasured. Connect AWS, GitHub, or Google Workspace." |
| Hits plan limit | Inline gate banner | "This feature is on Growth. Teams like yours break even in the first month vs. consultant fees." |
| Day 3, no integration | Copilot nudge | "Which integration to start with? For SOC 2: GitHub or AWS takes 90 seconds and shows your access control posture." |
| Day 5 | Social proof banner | "[Company] (14 employees, SaaS) completed SOC 2 readiness in 6 weeks — starting exactly where you are." |

### Email Sequence

| Email | Timing | Subject Line | Core Message |
|---|---|---|---|
| 1 | Immediately | `Your FastGRC account is ready — here's your first move` | One job: connect first integration. Direct deep link. No feature list. |
| 2 | Day 1 (4h, no integration) | `The #1 mistake compliance teams make (and how to skip it)` | Start with posture scan, not a spreadsheet. 40-60% of controls already met. |
| 3 | Day 3 (no integration) | `Quick question about your SOC 2 timeline` | Personal reply-to email. Start a conversation. P.S.: 15-min onboarding call offer. |
| 4 | Day 5 | `What your compliance posture looks like right now (estimated)` | Cohort-based estimate creates curiosity. "Your actual numbers will be different." |
| 5 | Day 7 | `Your Builder plan expires in [X] days — here's what you'd keep` | Show what they built. "$39/mo = less than one hour of consultant time." |
| 6 | Day 10 | `A real question: what's holding you back?` | Direct breakup-style. Offer 30-day extension if they engage. |

### North Star Metric
**Integration + Gap Report completion within 72h of signup**
Target: 35% → drives upgrade rate directly.

---

## SEGMENT 2: Growth Trial Users (14-Day, Paid)

### User Psychology
Buyer's anticipation + pressure to justify the spend. They told someone "I found a tool." Fear: wasting 14 days building in a tool they abandon. They need visible progress every 2-3 days.

**Top reasons GRC trial users churn:**
1. Integration friction (couldn't connect their stack)
2. Controls felt abstract — no clear "what do I do next"
3. Couldn't show anything to their manager in time
4. Audit timeline too far out to feel urgency
5. Got pulled into other priorities

### Primary Goal
**Drive "Shareable Audit Readiness Report" generation before Day 7.**
→ Users who produce a report before Day 7 retain at 70%+. No report by Day 10 = 65% churn. Target: 45% generate report by Day 10.

### In-App Touch Points

| When | What | Message |
|---|---|---|
| Trial start (first login) | Full-screen welcome | 14-day roadmap: Day 1-2 integrations → Day 3-4 gap review → Day 5-7 control assignments → Day 8-10 report → Day 11-14 share |
| Every login | Dashboard banner | Adaptive progress: "Day 1 of 14: connect your first integration" → "You're at 54% readiness. Here's what auditors look for." |
| Every login after Day 3 | Copilot daily brief | AWS scan results, controls awaiting evidence, readiness score change. "Your highest-impact action today: close 'Encryption at Rest' — it unblocks 6 controls." |
| Day 7 login | Progress modal | Show everything built so far. "Generate a shareable report and let your manager see what compliance automation looks like." |
| Day 8, low activity | Red intervention bar | "Your trial is 57% complete. Book a 20-min session and get to a working gap analysis today — or get 7 days free." |
| Day 14 | Expiry screen | Personalized summary card: integrations, controls, risks, readiness %, hours saved. "You're more than halfway there." |

### Email Sequence

| Email | Timing | Subject Line | Core Message |
|---|---|---|---|
| 1 | Trial start | `Your 14-day plan to a real audit readiness report` | The exact roadmap as a reference doc. Deep links for each phase. |
| 2 | Day 2 | `The 3 integrations that matter most for SOC 2` | AWS/Azure/GCP + GitHub + Google Workspace/Okta = 70% of technical controls automated. |
| 3 | Day 4 | `Your gap analysis is ready (here's what to do with it)` | Focus on 5-10 controls auditors examine first (CC6.1, CC6.2, CC7.2, CC8.1, CC9.1). |
| 4 | Day 6 | `The fastest way to get your CISO/manager excited about this` | One-page Audit Readiness Report drives internal champion behavior. |
| 5 | Day 9 | `5 days left — the 3 controls that matter most before your trial ends` | Name 3 highest-impact unclosed controls. "Closing these raises your score ~12 points." |
| 6 | Day 12 | `What happens to your data when the trial ends?` | Anxiety reduction. Data preserved 30 days. "$39/mo < one hour of consultant time." |
| 7 | Day 14 | `Your trial ends today — here's a summary of what you built` | Personalized summary. Emotional close: "You went from 0 to X% readiness in 14 days." |

### North Star Metric
**Shareable Audit Readiness Report generated before Day 10 of trial**
Target: 45% — strongest predictor of trial-to-paid conversion. Also a virality trigger (report recipients become leads).

---

## SEGMENT 3: Enterprise Customers

### User Psychology
Cautious dependency. Invested time, creating switching cost, but raising expectations. "We need to show our auditor something by Q3. Is this platform keeping up with us?"

**What drives expansion:**
1. Framework expansion (SOC 2 → ISO 27001) — highest revenue trigger
2. Team seat growth (adding analysts, auditor portal)
3. Integrations growth as the company scales
4. Vendor management expansion

### Primary Goal
**Activate a second compliance framework within 90 days.**
→ 80%+ 12-month retention for accounts with 2+ frameworks. 2.3x higher ACV at renewal.
Secondary: 3+ internal stakeholder invitations within 60 days.

### In-App Touch Points

| When | What | Message |
|---|---|---|
| Always | Executive Dashboard panel | Board-ready summary: posture %, outstanding items, audit timeline, risk score, team velocity. "Download Board Summary PDF." |
| Event-triggered | Copilot risk alert | "New finding: 3 S3 buckets now have public read. This affects CC6.1. I've drafted remediation steps." |
| Day 60, >75% readiness | Framework expansion banner | "73% of your SOC 2 controls already map to ISO 27001 Annex A. You're closer than you think. See my ISO 27001 Gap Analysis." |
| 90-day mark (quarterly) | QBR in-app report | Personalized: controls closed, evidence collected, hours saved, readiness %. "Your program is more mature than 68% of companies your size." |
| >3 vendor assessments pending | Vendor queue nudge | "Enable vendor self-serve portal — reduces your review time ~70%." |
| 30 days before audit | Copilot nudge | "Auditors who access evidence through FastGRC have 40% fewer follow-up requests. Draft the invitation?" |

### Email Sequence

| Email | Timing | Subject Line | Core Message |
|---|---|---|---|
| 1 | Day 1 | `Your dedicated FastGRC success plan` | Partnership kickoff. Named CSM. 90-day success plan doc. Calendar link for kickoff call. |
| 2 | Day 7 | `The 5 controls auditors examine first in SOC 2` | Expert content. CC6.1, CC6.2, CC7.2, CC8.1, CC9.1. Check your status. No sales. |
| 3 | Day 21 | `New: AI-powered vendor risk assessment (on your plan)` | "Third-party vendor risk is #1 audit finding. AI clears your queue in 2 minutes." |
| 4 | Day 30 | `Your 30-day compliance summary (you'll want to share this)` | Personalized ROI email. One-click PDF for CISO/board. |
| 5 | Day 45 | `You're 73% of the way to SOC 2 — what comes after?` | Framework expansion prompt. SOC 2 → ISO 27001 overlap table. Soft CTA for conversation. |
| 6 | Day 60 | `The compliance tip our top customers use that you might be missing` | Copilot-as-team-tool. 3 specific prompts they can use today. |
| 7 | Day 75 | `[Company]'s Q1 compliance program — your QBR preview` | Pre-QBR metrics preview. "Here are 3 things I want to highlight." Signals human attention. |
| Monthly | Ongoing | `FastGRC Intelligence Brief — [Month Year]` | 1 regulatory change, 1 new feature use case, 1 peer case study, 1 copilot prompt. Retention play. |

### North Star Metric
**Second framework activated within 90 days of Enterprise contract start**
Target: 35% of Enterprise accounts.

---

## Implementation Roadmap

### Phase 1 — Weeks 1-2: Foundation
- Instrument event tracking: integration connect, gap report generate, report share, framework activation
- Build adaptive onboarding checklist (5-item "Week 1 Mission")
- Configure email automation triggers in ESP
- Create personalized trial expiry screen with real user data
- Set up copilot "daily brief" trigger (fires on login after Day 3)

### Phase 2 — Weeks 3-4: Launch Builder + Trial Campaigns
- Deploy Builder onboarding sequence
- Deploy Growth trial sequence
- A/B test subject lines (2 variants, min 200 sends each before calling winner)
- Set up "at-risk" intervention trigger (Day 8, low engagement)

### Phase 3 — Weeks 5-6: Launch Enterprise Campaign
- Assign CSM to all Enterprise accounts, send kickoff email
- Deploy QBR report generator in-app
- Launch monthly Compliance Intelligence Brief
- Build Executive Dashboard "board-ready" panel

### Phase 4 — Week 7+: Optimize
- Weekly review of Builder → Growth conversion
- Trial-to-paid at Day 14 and Day 21 (late converters)
- Framework expansion rate at 90 days
- Fix lowest-performing email in each sequence first

---

## Key Metrics Dashboard

| Metric | Segment | Target |
|---|---|---|
| Integration + Gap Report within 72h | Builder | 35% |
| Free → Growth conversion | Builder | 15% |
| Report generated by Day 10 | Trial | 45% |
| Trial → paid conversion | Trial | 28% |
| 2nd framework by Day 90 | Enterprise | 35% |
| 12-month Enterprise retention | Enterprise | 85% |

---

## Copilot-First Language Guide

Use this language consistently across all campaigns:

| Instead of | Say |
|---|---|
| "the system detected" | "the copilot found" |
| "your data was analyzed" | "I reviewed your controls" |
| "your data" | "your compliance posture" |
| "dashboard" | "audit-ready view" / "board-ready summary" |
| Feature description | Pain it replaces (contrast with manual alternative) |
