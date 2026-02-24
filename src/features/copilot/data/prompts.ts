export interface CopilotPrompt {
  id: string;
  category: string;
  categoryIcon: string;
  title: string;
  prompt: string;
  tags: string[];
  outcome: string;
}

export const COPILOT_PROMPTS: CopilotPrompt[] = [
  // ── Risk Management ─────────────────────────────────────────────────────
  {
    id: "risk-s3-public",
    category: "Risk Management",
    categoryIcon: "🛡️",
    title: "Register a cloud exposure risk",
    prompt: "Register a risk: our S3 buckets may be publicly accessible, exposing customer data. Likelihood 4, impact 5.",
    tags: ["cloud", "data-exposure", "AWS"],
    outcome: "Creates a high-severity risk (score 20/25) in your register",
  },
  {
    id: "risk-vendor",
    category: "Risk Management",
    categoryIcon: "🛡️",
    title: "Third-party vendor risk",
    prompt: "Add a risk for our payment processor having inadequate security controls. We process 50k transactions/month.",
    tags: ["vendor", "third-party", "payment"],
    outcome: "Creates a vendor risk with appropriate category and scoring",
  },
  {
    id: "risk-mfa",
    category: "Risk Management",
    categoryIcon: "🛡️",
    title: "Authentication gap risk",
    prompt: "Register a risk that we don't enforce MFA for admin accounts, leaving us vulnerable to credential theft.",
    tags: ["authentication", "access-control", "admin"],
    outcome: "Creates an access control risk with mitigation suggestions",
  },
  {
    id: "risk-list",
    category: "Risk Management",
    categoryIcon: "🛡️",
    title: "List top risks",
    prompt: "What are our top 5 highest-scoring risks right now?",
    tags: ["reporting", "overview"],
    outcome: "Summarizes your current risk register ranked by severity",
  },
  {
    id: "risk-accept",
    category: "Risk Management",
    categoryIcon: "🛡️",
    title: "Mark a risk as accepted",
    prompt: "Update our logging gaps risk to status 'accepted' — leadership has reviewed and accepted this risk.",
    tags: ["risk-response", "accepted"],
    outcome: "Updates risk status and records the acceptance decision",
  },

  // ── Compliance & Frameworks ──────────────────────────────────────────────
  {
    id: "soc2-readiness",
    category: "Compliance",
    categoryIcon: "📋",
    title: "SOC 2 readiness check",
    prompt: "What's our current SOC 2 Type II readiness? Which criteria are incomplete?",
    tags: ["SOC2", "audit", "readiness"],
    outcome: "Shows completion % per Trust Services Criteria with gaps",
  },
  {
    id: "iso-gap",
    category: "Compliance",
    categoryIcon: "📋",
    title: "ISO 27001 gap analysis",
    prompt: "Run a gap analysis for ISO 27001:2022 and tell me which Annex A controls we're missing.",
    tags: ["ISO27001", "gap-analysis"],
    outcome: "Lists unmet ISO 27001 controls with priority recommendations",
  },
  {
    id: "nist-status",
    category: "Compliance",
    categoryIcon: "📋",
    title: "NIST CSF posture",
    prompt: "Show me our NIST CSF posture across all five functions: Identify, Protect, Detect, Respond, Recover.",
    tags: ["NIST", "CSF", "posture"],
    outcome: "Scorecard breakdown by NIST CSF function",
  },
  {
    id: "requirement-complete",
    category: "Compliance",
    categoryIcon: "📋",
    title: "Mark a requirement as complete",
    prompt: "Mark SOC 2 CC6.1 (Logical Access Controls) as complete — we just finished implementing MFA.",
    tags: ["SOC2", "requirement", "update"],
    outcome: "Updates the requirement status and timestamps completion",
  },
  {
    id: "framework-add",
    category: "Compliance",
    categoryIcon: "📋",
    title: "Add a compliance framework",
    prompt: "Add HIPAA to our compliance program — we're starting to serve healthcare customers.",
    tags: ["HIPAA", "framework", "setup"],
    outcome: "Creates the HIPAA framework with all requirements in your register",
  },

  // ── Controls ─────────────────────────────────────────────────────────────
  {
    id: "control-encryption",
    category: "Controls",
    categoryIcon: "🔒",
    title: "Add a data encryption control",
    prompt: "Create a preventive control for encrypting data at rest using AES-256 across all our databases.",
    tags: ["encryption", "preventive", "data-protection"],
    outcome: "Creates a control record with effectiveness tracking",
  },
  {
    id: "control-access-review",
    category: "Controls",
    categoryIcon: "🔒",
    title: "Quarterly access review control",
    prompt: "Add a detective control for quarterly user access reviews — all admin accounts reviewed every 90 days.",
    tags: ["access-review", "detective", "periodic"],
    outcome: "Creates an access review control with review cadence",
  },
  {
    id: "control-find",
    category: "Controls",
    categoryIcon: "🔒",
    title: "Find relevant controls",
    prompt: "What controls do we have that address encryption and key management?",
    tags: ["search", "encryption", "key-management"],
    outcome: "Lists matching controls with effectiveness ratings",
  },
  {
    id: "control-link-risk",
    category: "Controls",
    categoryIcon: "🔒",
    title: "Link a control to a risk",
    prompt: "Link our MFA enforcement control to the credential theft risk to show it reduces residual risk.",
    tags: ["risk-control", "mitigation", "residual-risk"],
    outcome: "Creates the risk-control mapping and recalculates residual score",
  },
  {
    id: "control-incident-response",
    category: "Controls",
    categoryIcon: "🔒",
    title: "Incident response control",
    prompt: "Create a corrective control for our incident response procedure — P1 incidents resolved within 4 hours.",
    tags: ["incident-response", "corrective", "SLA"],
    outcome: "Creates an incident response control with SLA parameters",
  },

  // ── Evidence ─────────────────────────────────────────────────────────────
  {
    id: "evidence-pentest",
    category: "Evidence",
    categoryIcon: "📁",
    title: "Log a penetration test",
    prompt: "Record evidence that we completed our annual penetration test in January 2025 with no critical findings.",
    tags: ["pentest", "annual", "security-testing"],
    outcome: "Creates an evidence record with test metadata",
  },
  {
    id: "evidence-training",
    category: "Evidence",
    categoryIcon: "📁",
    title: "Security training completion",
    prompt: "Add evidence that 100% of employees completed security awareness training this quarter.",
    tags: ["training", "awareness", "HR"],
    outcome: "Creates training completion evidence linked to relevant controls",
  },
  {
    id: "evidence-list",
    category: "Evidence",
    categoryIcon: "📁",
    title: "List expiring evidence",
    prompt: "Which evidence records are expiring in the next 60 days and need to be renewed?",
    tags: ["expiry", "renewal", "audit"],
    outcome: "Shows evidence items approaching expiry with renewal actions",
  },
  {
    id: "evidence-bcp",
    category: "Evidence",
    categoryIcon: "📁",
    title: "Business continuity test",
    prompt: "Create evidence for our business continuity plan test — we ran a tabletop exercise on March 15th.",
    tags: ["BCP", "tabletop", "continuity"],
    outcome: "Creates BCP test evidence with test date and findings",
  },

  // ── Integrations ─────────────────────────────────────────────────────────
  {
    id: "github-import",
    category: "Integrations",
    categoryIcon: "🔗",
    title: "Import GitHub security alerts",
    prompt: "Import open Dependabot alerts from GitHub and create risks for any critical or high severity ones.",
    tags: ["GitHub", "Dependabot", "vulnerability"],
    outcome: "Creates risks from open GitHub security alerts automatically",
  },
  {
    id: "jira-ticket",
    category: "Integrations",
    categoryIcon: "🔗",
    title: "Create a Jira ticket for a risk",
    prompt: "Create a Jira ticket for our unpatched servers risk so the DevOps team can track remediation.",
    tags: ["Jira", "remediation", "ticketing"],
    outcome: "Creates a linked Jira issue with risk details pre-filled",
  },
  {
    id: "slack-notify",
    category: "Integrations",
    categoryIcon: "🔗",
    title: "Send a risk alert to Slack",
    prompt: "Send a Slack notification to #security-team about our new critical risk that needs immediate attention.",
    tags: ["Slack", "notification", "alert"],
    outcome: "Posts a formatted risk alert to your configured Slack channel",
  },
  {
    id: "connect-github",
    category: "Integrations",
    categoryIcon: "🔗",
    title: "Connect GitHub",
    prompt: "Connect our GitHub organization using a personal access token with security_events scope.",
    tags: ["GitHub", "setup", "configuration"],
    outcome: "Saves GitHub credentials and verifies the connection",
  },

  // ── Reporting ─────────────────────────────────────────────────────────────
  {
    id: "report-executive",
    category: "Reporting",
    categoryIcon: "📊",
    title: "Executive risk summary",
    prompt: "Generate an executive summary of our security posture — risk trends, compliance status, and top priorities.",
    tags: ["executive", "summary", "reporting"],
    outcome: "Creates a board-ready summary of your security program",
  },
  {
    id: "report-audit-prep",
    category: "Reporting",
    categoryIcon: "📊",
    title: "Audit preparation checklist",
    prompt: "We have a SOC 2 audit in 30 days. What do we still need to complete and what evidence is missing?",
    tags: ["audit", "SOC2", "preparation"],
    outcome: "Prioritized checklist of items needed before audit",
  },
  {
    id: "report-risk-trend",
    category: "Reporting",
    categoryIcon: "📊",
    title: "Risk reduction trend",
    prompt: "How has our overall risk score changed over the past 3 months? Are we improving?",
    tags: ["trend", "metrics", "improvement"],
    outcome: "Shows risk score trend with before/after control implementation",
  },
];

export const PROMPT_CATEGORIES = [
  "All",
  "Risk Management",
  "Compliance",
  "Controls",
  "Evidence",
  "Integrations",
  "Reporting",
] as const;

export type PromptCategory = typeof PROMPT_CATEGORIES[number];
