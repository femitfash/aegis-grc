# Aegis GRC

**Copilot-first Governance, Risk & Compliance platform.**
Log risks in plain English, track SOC 2 / ISO 27001 / NIST automatically, and get audit-ready — in minutes, not months.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-green?logo=supabase)
![Claude](https://img.shields.io/badge/Claude-AI%20Copilot-orange)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

---

## Features

- **AI Copilot** — chat-first interface powered by Claude; no forms required
- **Risk Register** — create and score risks via natural language
- **Compliance Frameworks** — SOC 2, ISO 27001, NIST CSF with gap analysis
- **Control Library** — preventive, detective, and corrective controls
- **Evidence Tracking** — collect and link evidence to controls
- **Integrations** — GitHub (Dependabot), Jira, Slack
- **Prompt Library** — 27 ready-to-use copilot prompts at `/prompts`
- **BYOK** — bring your own Anthropic API key for unlimited usage
- **Auditor Portal** — read-only view for external auditors
- **Immutable Audit Log** — cryptographic hash chain for compliance evidence

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.7 |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (OAuth, MFA) |
| AI | Anthropic Claude API |
| UI | shadcn/ui + Tailwind CSS |
| State | TanStack Query + Zustand |
| Testing | Vitest + Playwright |

---

## Prerequisites

- **Node.js** 18+
- **Supabase** account — [supabase.com](https://supabase.com)
- **Anthropic** API key — [console.anthropic.com](https://console.anthropic.com)

---

## Local Development

### 1. Clone the repo

```bash
git clone https://github.com/femitfash/aegis-grc.git
cd aegis-grc
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor** and run the full schema:

```bash
# Copy and run the contents of docs/database-schema.sql in the Supabase SQL editor
```

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# Supabase — Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # anon / public key
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # service_role key (keep secret)

# Anthropic — console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-...

# App URL (used for internal API calls)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Where to find the keys:**
> - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase project **Settings → API → Project URL / anon key**
> - `SUPABASE_SERVICE_ROLE_KEY` → Supabase project **Settings → API → service_role key**
> - `ANTHROPIC_API_KEY` → [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

### 1. Push to GitHub

```bash
git add -A
git commit -m "initial deploy"
git push origin main
```

### 2. Import on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your `aegis-grc` GitHub repository
3. Vercel auto-detects Next.js — no build config needed

### 3. Add environment variables

In Vercel → **Settings → Environment Variables**, add all four variables from `.env.local`:

| Variable | Value | Environments |
|----------|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | All |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | All |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Production |

### 4. Deploy

Click **Deploy**. Every push to `main` triggers an automatic redeploy.

---

## Database Schema

The full PostgreSQL schema is in [`docs/database-schema.sql`](docs/database-schema.sql).

Run it once in the Supabase SQL editor when setting up a new project. It creates:

- `organizations`, `users` (multi-tenant, RBAC)
- `risks`, `risk_categories`, `risk_control_mappings`
- `control_library`, `control_requirement_mappings`
- `compliance_frameworks`, `framework_requirements`
- `evidence`
- `integrations`
- `audit_log` (immutable hash chain)
- `copilot_conversations`

Row Level Security (RLS) policies are included — all data is isolated by `organization_id`.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, register, forgot/reset password
│   ├── (dashboard)/     # Protected app routes
│   │   ├── dashboard/
│   │   │   ├── risks/
│   │   │   ├── controls/
│   │   │   ├── frameworks/
│   │   │   ├── evidence/
│   │   │   ├── integrations/
│   │   │   └── settings/
│   ├── api/
│   │   ├── copilot/     # AI streaming endpoint + tool execution
│   │   ├── risks/
│   │   ├── controls/
│   │   ├── frameworks/
│   │   ├── evidence/
│   │   └── integrations/
│   ├── auditor/         # Read-only auditor portal
│   ├── prompts/         # Public copilot prompt library
│   └── page.tsx         # Marketing landing page
├── features/
│   ├── copilot/         # CopilotPanel + prompt data
│   ├── risks/
│   ├── controls/
│   ├── evidence/
│   └── frameworks/
└── shared/
    ├── components/
    ├── lib/supabase/    # Client, server, admin, middleware
    └── hooks/
```

---

## Copilot Tools

The AI copilot uses Claude's tool-calling to execute GRC actions:

| Tool | What it does |
|------|-------------|
| `create_risk` | Register a risk from natural language |
| `create_control` | Add a control to the library |
| `create_framework` | Set up a compliance framework |
| `update_requirement_status` | Mark a requirement complete/incomplete |
| `link_risk_to_control` | Map a control to a risk (reduces residual score) |
| `create_evidence` | Log evidence against a control |
| `connect_integration` | Save GitHub / Jira / Slack credentials |
| `import_github_alerts` | Pull Dependabot alerts → create risks |
| `create_jira_issue` | Create a Jira ticket linked to a risk |
| `send_slack_notification` | Post a risk alert to Slack |

Write tools require user approval before execution. Read tools (list risks, search controls, gap analysis) execute automatically.

---

## Using Your Own Anthropic API Key

The platform ships with 10 free AI actions. To unlock unlimited usage:

1. Go to **Dashboard → Settings → AI Copilot**
2. Paste your Anthropic API key from [console.anthropic.com](https://console.anthropic.com)
3. Keys are encrypted at rest and never leave your Supabase instance

---

## Development Commands

```bash
npm run dev           # Start dev server (localhost:3000)
npm run build         # Production build
npm run type-check    # TypeScript check
npm run lint          # ESLint
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright end-to-end tests
npm run db:generate   # Regenerate Supabase TypeScript types
```

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request against `main`

---

## License

MIT — see [LICENSE](LICENSE) for details.
