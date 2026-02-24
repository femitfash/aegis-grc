import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

// GRC Copilot System Prompt
const SYSTEM_PROMPT = `You are the GRC Copilot for Aegis, an AI assistant that serves as the PRIMARY interface for a Governance, Risk, and Compliance platform. Users interact with you conversationally instead of navigating complex forms and menus.

## Your Core Mission
Transform GRC from a tedious compliance exercise into an intuitive, risk-focused experience. You reduce 50+ field forms to simple conversations, intelligently inferring information and only asking about truly ambiguous items.

## Interaction Principles

### 1. PROACTIVE INTELLIGENCE
- When a user describes a risk, automatically categorize it, suggest likelihood/impact, and recommend relevant controls
- Don't ask for information you can reasonably infer
- Pre-populate fields with smart defaults, showing your reasoning

### 2. CONVERSATIONAL FIRST
- Guide users through natural dialogue, not form fields
- Summarize your understanding and let them correct if needed

### 3. RISK-CENTRIC APPROACH
- Always frame discussions around risk, not compliance checkboxes
- Connect the dots between risks, controls, and evidence

### 4. ACTION-ORIENTED
- When you have enough information, offer to take action
- When a write action is pending user approval, clearly describe what will be created

## Capabilities
You can help users with:
- Creating and managing risks, controls, and evidence
- Mapping controls to compliance framework requirements
- Generating compliance reports
- Understanding their compliance posture
- Answering GRC-related questions

## Response Format
- Be concise but thorough
- Use markdown formatting: **bold**, \`code\`, bullet lists
- When presenting options, use numbered lists
- When showing data, use tables where appropriate`;

// Tool definitions for GRC operations
const tools: Anthropic.Tool[] = [
  {
    name: "create_risk",
    description:
      "Create a new risk entry. Use when the user describes a risk scenario. Intelligently infer fields from their description. Always confirm the details before creating.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Concise risk title (auto-generate if not provided)" },
        description: { type: "string", description: "Full risk description from user input" },
        category: {
          type: "string",
          enum: ["operational", "financial", "compliance", "strategic", "technology", "security"],
          description: "Infer from context",
        },
        inherent_likelihood: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          description: "1=Rare, 2=Unlikely, 3=Possible, 4=Likely, 5=Almost Certain",
        },
        inherent_impact: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          description: "1=Negligible, 2=Minor, 3=Moderate, 4=Major, 5=Severe",
        },
        risk_response: {
          type: "string",
          enum: ["accept", "mitigate", "transfer", "avoid"],
          description: "Recommended risk response strategy",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "search_risks",
    description: "Search for existing risks in the organization's risk register",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Natural language search query" },
        status: {
          type: "string",
          enum: ["identified", "assessed", "mitigated", "accepted", "closed"],
        },
        min_score: { type: "integer", minimum: 1, maximum: 25 },
      },
    },
  },
  {
    name: "get_compliance_status",
    description: "Get compliance status and gap analysis for a framework",
    input_schema: {
      type: "object" as const,
      properties: {
        framework: {
          type: "string",
          enum: ["SOC2", "ISO27001", "NIST_CSF"],
          description: "Compliance framework code",
        },
      },
      required: ["framework"],
    },
  },
  {
    name: "search_controls",
    description: "Find controls that address a specific risk or requirement",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Natural language description of the control needed" },
        framework: { type: "string", description: "Optional: filter by framework code" },
      },
      required: ["query"],
    },
  },
  {
    name: "create_control",
    description:
      "Create a new security/compliance control in the control library. Use when the user wants to add a control.",
    input_schema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "Control code (e.g., 'MFA-01'). Auto-generate if not given." },
        title: { type: "string", description: "Control title" },
        description: { type: "string", description: "What the control does" },
        control_type: {
          type: "string",
          enum: ["technical", "administrative", "operational", "physical", "preventive", "detective", "corrective"],
          description: "Type of control",
        },
        automation_level: {
          type: "string",
          enum: ["manual", "semi-automated", "automated"],
          description: "How automated is this control",
        },
        effectiveness_rating: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          description: "Effectiveness rating 1-5",
        },
        frameworks: {
          type: "array",
          items: { type: "string" },
          description: "Framework codes this control addresses (e.g., ['SOC2', 'ISO27001'])",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_requirement_status",
    description:
      "Update the implementation status of a specific compliance framework requirement. Use when the user says they have implemented or are working on a requirement.",
    input_schema: {
      type: "object" as const,
      properties: {
        framework_code: {
          type: "string",
          description: "Framework code (e.g., 'SOC2', 'ISO27001', 'NIST_CSF')",
        },
        requirement_code: {
          type: "string",
          description: "Requirement code (e.g., 'CC1.1', 'A.5.1', 'PR.AC')",
        },
        status: {
          type: "string",
          enum: ["not-started", "partial", "implemented", "not-applicable"],
          description: "New implementation status",
        },
      },
      required: ["framework_code", "requirement_code", "status"],
    },
  },
  {
    name: "create_framework",
    description:
      "Add a new compliance framework to track. Use when the user wants to add frameworks like AI Act, GDPR, HIPAA, PCI-DSS, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "Short framework code (e.g., 'AI_ACT', 'GDPR', 'HIPAA')",
        },
        name: {
          type: "string",
          description: "Full framework name (e.g., 'EU AI Act', 'General Data Protection Regulation')",
        },
        version: {
          type: "string",
          description: "Version or year (e.g., '2024', 'v1.0')",
        },
        description: {
          type: "string",
          description: "Brief description of the framework's purpose and scope",
        },
      },
      required: ["code", "name", "description"],
    },
  },
  {
    name: "create_requirement",
    description:
      "Add a requirement to a custom compliance framework. Use when the user wants to populate a framework (like HIPAA, GDPR) with specific requirements/controls they need to track.",
    input_schema: {
      type: "object" as const,
      properties: {
        framework_code: {
          type: "string",
          description: "The framework code to add the requirement to (e.g., 'HIPAA', 'GDPR')",
        },
        domain: {
          type: "string",
          description: "The domain/category this requirement belongs to (e.g., 'Privacy Rule', 'Security Rule', 'Technical Safeguards')",
        },
        code: {
          type: "string",
          description: "Short requirement code (e.g., '164.312', 'Art.32', 'PR-001'). Auto-generated if not provided.",
        },
        title: {
          type: "string",
          description: "Clear title describing what this requirement covers",
        },
        evidence_required: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Number of evidence items needed to satisfy this requirement (default: 1)",
        },
      },
      required: ["framework_code", "title"],
    },
  },
  {
    name: "link_risk_to_control",
    description:
      "Link an existing control to an existing risk as a mitigation measure. This updates the residual risk score automatically based on control effectiveness. Use when user says a control mitigates a risk, or when assessing risk treatment.",
    input_schema: {
      type: "object" as const,
      properties: {
        risk_id: {
          type: "string",
          description: "The UUID or risk_id (e.g., 'RISK-ABC123') of the risk to link",
        },
        control_id: {
          type: "string",
          description: "The UUID or control code (e.g., 'MFA-01') of the control to link",
        },
        notes: {
          type: "string",
          description: "Optional notes explaining how this control mitigates the risk",
        },
      },
      required: ["risk_id", "control_id"],
    },
  },
  {
    name: "create_evidence",
    description:
      "Create an evidence record linked to a control. Evidence proves that a control is operating effectively. Use when the user wants to document evidence — a URL to a report, document, screenshot, or process record.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Descriptive title of the evidence (e.g., 'Q1 2026 Access Review Report')",
        },
        description: {
          type: "string",
          description: "What the evidence demonstrates",
        },
        source_type: {
          type: "string",
          enum: ["manual", "automated", "integration"],
          description: "How the evidence was collected",
        },
        source_url: {
          type: "string",
          description: "URL link to the evidence (Google Doc, GitHub PR, Confluence page, etc.)",
        },
        control_code: {
          type: "string",
          description: "Code of the control this evidence supports (e.g., 'MFA-01', 'AC-02')",
        },
        frameworks: {
          type: "array",
          items: { type: "string" },
          description: "Framework codes this evidence satisfies (e.g., ['SOC2', 'ISO27001'])",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "list_integrations",
    description:
      "List the organization's configured integrations (GitHub, Jira, Slack, etc.) and their connection status. Use when the user asks what integrations are set up, or before performing integration actions.",
    input_schema: {
      type: "object" as const,
      properties: {
        provider: {
          type: "string",
          enum: ["github", "jira", "slack", "aws"],
          description: "Optional: filter by provider",
        },
      },
    },
  },
  {
    name: "connect_integration",
    description:
      "Configure and connect a new integration (GitHub, Jira, or Slack). Use when the user wants to set up a new integration and provides credentials. Always confirm the details before saving — never store credentials without user approval.",
    input_schema: {
      type: "object" as const,
      properties: {
        provider: {
          type: "string",
          enum: ["github", "jira", "slack"],
          description: "The integration provider",
        },
        config: {
          type: "object",
          description: "Provider-specific config. GitHub: {org, repo?, token}. Jira: {host, email, token, project_key}. Slack: {bot_token, channel}",
          additionalProperties: { type: "string" },
        },
      },
      required: ["provider", "config"],
    },
  },
  {
    name: "import_github_alerts",
    description:
      "Import open Dependabot security alerts from GitHub as risks in the risk register. Deduplicates automatically. Use when the user wants to sync GitHub security findings.",
    input_schema: {
      type: "object" as const,
      properties: {
        confirm: {
          type: "boolean",
          description: "Must be true — user must confirm the import",
        },
      },
      required: ["confirm"],
    },
  },
  {
    name: "create_jira_issue",
    description:
      "Create a Jira issue from a risk. Use when the user wants to track a risk remediation in Jira. The Jira issue key will be saved back to the risk record.",
    input_schema: {
      type: "object" as const,
      properties: {
        risk_id: {
          type: "string",
          description: "The risk ID (e.g., 'RISK-ABC123') to create a Jira issue for",
        },
        summary: {
          type: "string",
          description: "Jira issue title/summary",
        },
        description: {
          type: "string",
          description: "Detailed description of what needs to be done",
        },
        issue_type: {
          type: "string",
          enum: ["Task", "Bug", "Story", "Epic"],
          description: "Jira issue type (default: Task)",
        },
        priority: {
          type: "string",
          enum: ["Highest", "High", "Medium", "Low", "Lowest"],
          description: "Jira priority (default: Medium)",
        },
      },
      required: ["summary"],
    },
  },
  {
    name: "generate_risk_report",
    description:
      "Generate a risk assessment report summarizing the organization's risk posture. Use when the user asks for a risk report, risk summary, risk overview, or wants to understand their overall risk levels.",
    input_schema: {
      type: "object" as const,
      properties: {
        format: {
          type: "string",
          enum: ["summary", "full"],
          description: "summary = executive overview; full = complete risk register. Default: summary",
        },
      },
    },
  },
  {
    name: "generate_compliance_report",
    description:
      "Generate a compliance and audit readiness report showing framework progress, gaps, and evidence status. Use when the user asks for a compliance report, audit readiness, SOC 2 status, ISO 27001 progress, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        framework: {
          type: "string",
          description: "Optional: focus on a specific framework code (e.g. 'SOC2', 'ISO27001'). Omit for all frameworks.",
        },
      },
    },
  },
  {
    name: "send_slack_notification",
    description:
      "Send a notification to Slack. Use when the user wants to alert their team about a risk, compliance issue, or any GRC update.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string",
          description: "The message to send",
        },
        risk_title: {
          type: "string",
          description: "Optional: risk title to include in a structured alert",
        },
        risk_id: {
          type: "string",
          description: "Optional: risk ID for context",
        },
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Optional: severity level for color coding",
        },
        channel: {
          type: "string",
          description: "Optional: override the default Slack channel",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "list_policies",
    description:
      "List all policies in the organization's policy register. Use when the user asks about policies, policy coverage, review schedules, or wants to see their policy library.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["draft", "active", "archived"],
          description: "Optional: filter by policy status",
        },
        category: {
          type: "string",
          description: "Optional: filter by policy category (e.g. 'Information Security')",
        },
      },
    },
  },
  {
    name: "list_vendors",
    description:
      "List all vendors and third-party suppliers in the vendor register. Use when the user asks about vendors, vendor risk, supplier management, or third-party risk.",
    input_schema: {
      type: "object" as const,
      properties: {
        tier: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Optional: filter by risk tier",
        },
      },
    },
  },
  {
    name: "list_incidents",
    description:
      "List security incidents. Use when the user asks about incidents, current open incidents, incident status, or wants a summary of recent security events.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["detected", "contained", "resolved", "post_mortem", "closed"],
          description: "Optional: filter by incident status",
        },
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Optional: filter by severity",
        },
      },
    },
  },
  {
    name: "create_policy",
    description:
      "Create a new policy document in the policy register. Use when the user wants to add a new security or compliance policy.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Policy title (e.g., 'Password Management Policy')" },
        category: {
          type: "string",
          enum: [
            "Information Security", "Access Control", "Data Protection",
            "Business Continuity", "Risk Management", "HR & Personnel",
            "Physical Security", "Incident Response", "Acceptable Use",
          ],
          description: "Policy category — infer from context",
        },
        description: { type: "string", description: "What the policy covers and its purpose" },
        status: { type: "string", enum: ["draft", "active"], description: "Initial status (default: draft)" },
        version: { type: "string", description: "Policy version (default: 1.0)" },
        effective_date: { type: "string", description: "ISO date when the policy takes effect" },
        review_date: { type: "string", description: "ISO date for next scheduled review" },
        attestation_required: { type: "boolean", description: "Whether staff must attest to this policy" },
      },
      required: ["title"],
    },
  },
  {
    name: "create_vendor",
    description:
      "Add a new vendor or third-party supplier to the vendor register. Use when the user wants to track a new supplier or service provider.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Vendor name" },
        category: { type: "string", description: "Vendor category (e.g., 'Cloud Infrastructure', 'SaaS')" },
        tier: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Risk tier — critical = essential to operations",
        },
        risk_score: { type: "integer", minimum: 1, maximum: 25, description: "Risk score 1-25 (infer from tier if not given)" },
        contact_name: { type: "string", description: "Primary contact name" },
        contact_email: { type: "string", description: "Primary contact email" },
        website: { type: "string", description: "Vendor website URL" },
        contract_expiry: { type: "string", description: "ISO date of contract expiry" },
        notes: { type: "string", description: "Additional notes about the vendor relationship" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_incident",
    description:
      "Log a new security incident. Use when the user reports an incident, breach, anomaly, or security event that needs to be tracked.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Concise incident title" },
        description: { type: "string", description: "Full description of what happened" },
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Severity — infer from impact described",
        },
        impact: { type: "string", description: "Business/operational impact" },
        affected_systems: { type: "string", description: "Systems or services affected" },
        discovered_at: { type: "string", description: "ISO datetime when the incident was discovered (default: now)" },
      },
      required: ["title", "severity"],
    },
  },
];

// Execute read-only tools server-side
async function executeReadTool(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  organizationId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin?: any
): Promise<unknown> {
  switch (name) {
    case "search_risks": {
      if (!organizationId) return { risks: [], message: "No organization found" };
      try {
        let query = supabase
          .from("risks")
          .select("id, risk_id, title, description, inherent_score, status")
          .eq("organization_id", organizationId)
          .limit(10);

        if (input.query) query = query.ilike("title", `%${input.query}%`);
        if (input.status) query = query.eq("status", input.status);
        if (input.min_score) query = query.gte("inherent_score", input.min_score);

        const { data } = await query;
        return { risks: data || [], count: (data || []).length };
      } catch {
        return { risks: [], message: "Search failed" };
      }
    }

    case "get_compliance_status": {
      // Read real requirement statuses from the org's settings
      const FRAMEWORK_CONFIGS: Record<string, { name: string; total: number }> = {
        SOC2: { name: "SOC 2 Type II", total: 60 },
        ISO27001: { name: "ISO 27001:2022", total: 93 },
        NIST_CSF: { name: "NIST Cybersecurity Framework", total: 108 },
      };

      const frameworkKey = (input.framework as string) || "";
      const config = FRAMEWORK_CONFIGS[frameworkKey];
      if (!config) return { error: "Unknown framework. Valid options: SOC2, ISO27001, NIST_CSF" };

      try {
        let requirementStatuses: Record<string, string> = {};

        if (organizationId && admin) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: org } = await (admin as any)
            .from("organizations")
            .select("settings")
            .eq("id", organizationId)
            .single();

          requirementStatuses = org?.settings?.requirement_statuses || {};
        }

        // Count statuses for this framework
        const prefix = `${frameworkKey}-`;
        const relevantEntries = Object.entries(requirementStatuses).filter(([key]) =>
          key.startsWith(prefix)
        );

        const implemented = relevantEntries.filter(([, v]) => v === "implemented").length;
        const partial = relevantEntries.filter(([, v]) => v === "partial").length;
        const notApplicable = relevantEntries.filter(([, v]) => v === "not-applicable").length;
        const notStarted = config.total - implemented - partial - notApplicable;
        const readiness =
          config.total > 0 ? Math.round((implemented / config.total) * 100) : 0;

        // Identify gap requirement keys (not implemented and not marked n/a)
        const gaps = relevantEntries
          .filter(([, v]) => v !== "implemented" && v !== "not-applicable")
          .map(([k]) => k.replace(prefix, ""))
          .slice(0, 5);

        return {
          framework: config.name,
          readiness,
          totalRequirements: config.total,
          implemented,
          partial,
          notStarted,
          notApplicable,
          gaps,
        };
      } catch {
        return { error: "Failed to fetch compliance status" };
      }
    }

    case "search_controls": {
      if (!organizationId) {
        // Return generic controls from a built-in library
        const genericControls = [
          { code: "AC-01", title: "Access Control Policy", type: "administrative", status: "implemented" },
          { code: "AC-02", title: "Account Management", type: "operational", status: "implemented" },
          { code: "SC-07", title: "Boundary Protection", type: "technical", status: "testing" },
          { code: "SI-03", title: "Malicious Code Protection", type: "technical", status: "implemented" },
          { code: "RA-05", title: "Vulnerability Scanning", type: "technical", status: "testing" },
        ].filter((c) => c.title.toLowerCase().includes((input.query || "").toLowerCase()));
        return { controls: genericControls };
      }
      try {
        const { data } = await supabase
          .from("control_library")
          .select("id, code, title, description, control_type, status, effectiveness_rating")
          .eq("organization_id", organizationId)
          .ilike("title", `%${input.query}%`)
          .limit(10);
        return { controls: data || [] };
      } catch {
        return { controls: [] };
      }
    }

    case "generate_risk_report": {
      if (!organizationId || !admin) return { report: "No organization found." };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: risks } = await (admin as any)
          .from("risks")
          .select("id, risk_id, title, inherent_likelihood, inherent_impact, residual_likelihood, residual_impact, status, risk_response")
          .eq("organization_id", organizationId)
          .order("inherent_likelihood", { ascending: false });

        const riskList = risks || [];
        const score = (r: { inherent_likelihood: number; inherent_impact: number }) => r.inherent_likelihood * r.inherent_impact;
        const band = (s: number) => s >= 15 ? "🔴 Critical" : s >= 10 ? "🟠 High" : s >= 5 ? "🟡 Medium" : "🟢 Low";

        const critical = riskList.filter((r: { inherent_likelihood: number; inherent_impact: number }) => score(r) >= 15).length;
        const high = riskList.filter((r: { inherent_likelihood: number; inherent_impact: number }) => score(r) >= 10 && score(r) < 15).length;
        const medium = riskList.filter((r: { inherent_likelihood: number; inherent_impact: number }) => score(r) >= 5 && score(r) < 10).length;
        const low = riskList.filter((r: { inherent_likelihood: number; inherent_impact: number }) => score(r) < 5).length;

        const full = (input.format || "summary") === "full";
        let report = `## Risk Assessment Report\n\n`;
        report += `**Total Risks:** ${riskList.length}  |  🔴 Critical: ${critical}  |  🟠 High: ${high}  |  🟡 Medium: ${medium}  |  🟢 Low: ${low}\n\n`;

        if (full && riskList.length > 0) {
          report += `### Risk Register\n\n| ID | Title | Score | Band | Status |\n|---|---|---|---|---|\n`;
          for (const r of riskList.slice(0, 25)) {
            const s = score(r);
            const residual = (r.residual_likelihood ?? r.inherent_likelihood) * (r.residual_impact ?? r.inherent_impact);
            report += `| ${r.risk_id || r.id.slice(0, 8)} | ${r.title} | ${s}→${residual} | ${band(s)} | ${r.status} |\n`;
          }
        } else if (riskList.length > 0) {
          report += `### Top 5 Risks by Score\n\n`;
          const top5 = [...riskList].sort((a: { inherent_likelihood: number; inherent_impact: number }, b: { inherent_likelihood: number; inherent_impact: number }) => score(b) - score(a)).slice(0, 5);
          for (const r of top5) {
            const s = score(r);
            report += `- **${r.title}** — Score: ${s} ${band(s)} · Status: ${r.status}\n`;
          }
        } else {
          report += "_No risks have been logged yet._\n";
        }

        report += `\n> 📊 For full visualizations including the risk heat map, go to **Reports → Risk Assessment Report** and click Generate.`;
        return { report };
      } catch {
        return { report: "Failed to generate risk report." };
      }
    }

    case "generate_compliance_report": {
      if (!organizationId || !admin) return { report: "No organization found." };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: org } = await (admin as any)
          .from("organizations")
          .select("settings")
          .eq("id", organizationId)
          .single();

        const requirementStatuses: Record<string, string> = org?.settings?.requirement_statuses || {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: frameworks } = await (supabase as any)
          .from("compliance_frameworks")
          .select("code, name, structure")
          .eq("is_active", true);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: evidence } = await (admin as any)
          .from("evidence")
          .select("id, status, valid_to")
          .eq("organization_id", organizationId);

        const evidenceList = evidence || [];
        const now = new Date();
        const expiredCount = evidenceList.filter((e: { valid_to?: string }) => e.valid_to && new Date(e.valid_to) < now).length;

        let report = `## Compliance & Audit Readiness Report\n\n`;

        const filterCode = (input.framework as string | undefined)?.toUpperCase();
        const fwList = (frameworks || []).filter((fw: { code: string }) => !filterCode || fw.code === filterCode);

        if (fwList.length === 0) {
          report += "_No active compliance frameworks found. Add frameworks from the Frameworks page._\n";
        }

        for (const fw of fwList) {
          const domains = fw.structure?.domains || [];
          let total = 0, implemented = 0, inProgress = 0, notStarted = 0;
          for (const domain of domains) {
            for (const req of (domain.requirements || [])) {
              total++;
              const key = `${fw.code}:${req.id}`;
              const st = requirementStatuses[key] || "not_started";
              if (st === "implemented") implemented++;
              else if (st === "partial" || st === "in-progress" || st === "in_progress") inProgress++;
              else if (st !== "not-applicable" && st !== "n/a") notStarted++;
            }
          }
          const applicable = total - (total - implemented - inProgress - notStarted);
          const progress = applicable > 0 ? Math.round((implemented / applicable) * 100) : 0;
          const bar = "█".repeat(Math.round(progress / 10)) + "░".repeat(10 - Math.round(progress / 10));

          report += `### ${fw.name}\n\`${bar}\` **${progress}%** ready\n`;
          report += `- ✅ Implemented: ${implemented}  |  🔄 In Progress: ${inProgress}  |  ❌ Not Started: ${notStarted}  |  Total: ${total}\n\n`;
        }

        report += `### Evidence Summary\n`;
        report += `- Total: ${evidenceList.length}  |  Validated: ${evidenceList.filter((e: { status: string }) => e.status === "validated").length}  |  Pending: ${evidenceList.filter((e: { status: string }) => e.status === "pending").length}`;
        if (expiredCount > 0) report += `  |  ⚠️ Expired: ${expiredCount}`;
        report += `\n\n> 📋 For the full gap analysis with domain breakdown, go to **Reports → Compliance & Audit Report** and click Generate.`;

        return { report };
      } catch {
        return { report: "Failed to generate compliance report." };
      }
    }

    case "list_integrations": {
      if (!organizationId || !admin) return { integrations: [], message: "No organization found" };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (admin as any)
          .from("integrations")
          .select("id, provider, name, status, last_sync_at, last_sync_status")
          .eq("organization_id", organizationId);
        if (input.provider) query = query.eq("provider", input.provider);
        const { data } = await query;
        return { integrations: data || [], count: (data || []).length };
      } catch {
        return { integrations: [], message: "Failed to list integrations" };
      }
    }

    case "list_policies": {
      if (!organizationId || !admin) return { policies: [], message: "No organization found" };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (admin as any)
          .from("policies")
          .select("id, policy_id, title, category, status, version, review_date, attestation_required")
          .eq("organization_id", organizationId)
          .order("title");
        if (input.status) query = query.eq("status", input.status);
        if (input.category) query = query.eq("category", input.category);
        const { data } = await query;
        return { policies: data || [], count: (data || []).length };
      } catch {
        return { policies: [], message: "Failed to list policies" };
      }
    }

    case "list_vendors": {
      if (!organizationId || !admin) return { vendors: [], message: "No organization found" };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (admin as any)
          .from("vendors")
          .select("id, name, category, tier, status, risk_score, contract_expiry, last_assessed_at")
          .eq("organization_id", organizationId)
          .order("risk_score", { ascending: false });
        if (input.tier) query = query.eq("tier", input.tier);
        const { data } = await query;
        return { vendors: data || [], count: (data || []).length };
      } catch {
        return { vendors: [], message: "Failed to list vendors" };
      }
    }

    case "list_incidents": {
      if (!organizationId || !admin) return { incidents: [], message: "No organization found" };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (admin as any)
          .from("incidents")
          .select("id, incident_id, title, severity, status, discovered_at, resolved_at")
          .eq("organization_id", organizationId)
          .order("discovered_at", { ascending: false });
        if (input.status) query = query.eq("status", input.status);
        if (input.severity) query = query.eq("severity", input.severity);
        const { data } = await query;
        return { incidents: data || [], count: (data || []).length };
      } catch {
        return { incidents: [], message: "Failed to list incidents" };
      }
    }

    default:
      return { error: "Unknown tool" };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, conversationId, context, history } = await request.json();

    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get organization ID
    let organizationId: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userData } = await (supabase as any)
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      organizationId = userData?.organization_id || null;
    } catch {
      // Table may not exist yet
    }

    // Use org's custom Anthropic API key if configured, otherwise use platform key
    let anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (organizationId) {
      try {
        const adminForKey = createAdminClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orgData } = await (adminForKey as any)
          .from("organizations")
          .select("settings")
          .eq("id", organizationId)
          .single();
        if (orgData?.settings?.anthropic_api_key) {
          anthropicApiKey = orgData.settings.anthropic_api_key;
        }
      } catch {
        // Fall back to platform key
      }
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    const contextualPrompt = context
      ? `${SYSTEM_PROMPT}\n\n## Current Context\n- Page: ${context.page}`
      : SYSTEM_PROMPT;

    // Use conversation history passed from the client
    const messages: Anthropic.MessageParam[] = [
      ...((history || []) as Array<{ role: "user" | "assistant"; content: string }>),
      { role: "user", content: message },
    ];

    // Agentic loop: handle read tools automatically, collect write tools as pending
    let loopMessages = [...messages];
    const pendingActions: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    let maxIterations = 4;
    let finalText = "";

    while (maxIterations-- > 0) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: contextualPrompt,
        tools,
        messages: loopMessages,
      });

      // Collect text from this pass
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      finalText = textBlocks.map((b) => b.text).join("");

      if (response.stop_reason !== "tool_use") break;

      // Process tool calls
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const WRITE_TOOLS = ["create_risk", "create_control", "create_framework", "update_requirement_status", "create_requirement", "link_risk_to_control", "create_evidence", "connect_integration", "import_github_alerts", "create_jira_issue", "send_slack_notification", "create_policy", "create_vendor", "create_incident"];
        const READ_TOOLS = ["search_risks", "get_compliance_status", "search_controls", "list_integrations", "generate_risk_report", "generate_compliance_report", "list_policies", "list_vendors", "list_incidents"];
        if (WRITE_TOOLS.includes(toolUse.name) && !READ_TOOLS.includes(toolUse.name)) {
          // Write tool — queue for user approval
          pendingActions.push({
            id: toolUse.id,
            name: toolUse.name,
            input: toolUse.input as Record<string, unknown>,
          });
          const entityType =
            toolUse.name === "create_risk" ? "risk" :
            toolUse.name === "create_control" ? "control" :
            toolUse.name === "update_requirement_status" ? "requirement status update" :
            toolUse.name === "create_requirement" ? "requirement" :
            toolUse.name === "connect_integration" ? "integration connection" :
            toolUse.name === "import_github_alerts" ? "GitHub alert import" :
            toolUse.name === "create_jira_issue" ? "Jira issue" :
            toolUse.name === "send_slack_notification" ? "Slack notification" :
            toolUse.name === "create_policy" ? "policy" :
            toolUse.name === "create_vendor" ? "vendor" :
            toolUse.name === "create_incident" ? "incident" :
            "framework";
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content:
              `The ${entityType} creation has been presented to the user for approval. Please describe what you are about to create and ask them to approve it using the action card below.`,
          });
        } else {
          // Read tool — execute and feed result back to Claude
          const result = await executeReadTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            supabase,
            organizationId,
            createAdminClient()
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        }
      }

      loopMessages = [
        ...loopMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
    }

    // Save to DB (best effort)
    if (conversationId && finalText) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("copilot_messages").insert([
          { conversation_id: conversationId, role: "user", content: message },
          {
            conversation_id: conversationId,
            role: "assistant",
            content: finalText,
            tool_calls: pendingActions,
          },
        ]);
      } catch {
        // ignore
      }
    }

    // Stream the final text response word by word for typewriter effect
    const encoder = new TextEncoder();
    const words = finalText.split(/(\s+)/); // Split keeping whitespace
    const readableStream = new ReadableStream({
      start(controller) {
        let i = 0;
        function sendNext() {
          if (i < words.length) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text", text: words[i] })}\n\n`
              )
            );
            i++;
            // ~40 words/second for natural reading speed
            setTimeout(sendNext, 25);
          } else {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "done", pendingActions })}\n\n`
              )
            );
            controller.close();
          }
        }
        sendNext();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Copilot API error:", error);
    return Response.json({ error: "Failed to process request" }, { status: 500 });
  }
}
