export interface AgentInstructionTemplate {
  id: string;
  category: string;
  title: string;
  instructions: string;
  tags: string[];
  expectedOutcome: string;
}

export const AGENT_INSTRUCTION_TEMPLATES: AgentInstructionTemplate[] = [
  // ── Compliance Audit ─────────────────────────────────────────────────────
  {
    id: "soc2-readiness",
    category: "Compliance Audit",
    title: "SOC 2 Type II Readiness Assessment",
    instructions: `Perform a comprehensive SOC 2 Type II readiness assessment for our organization.

1. Search for the latest SOC 2 Trust Services Criteria (Security, Availability, Processing Integrity, Confidentiality, Privacy).
2. For each criteria category, check our current compliance status by reviewing existing controls and policies.
3. Create risks for every gap or deficiency you identify — be specific about the criteria affected and the potential impact.
4. Create controls to mitigate each identified risk, mapping them to the relevant Trust Services Criteria.
5. Create policies for any missing organizational policies required by SOC 2 (e.g., Information Security Policy, Access Control Policy, Change Management Policy, Incident Response Policy).
6. Create evidence items documenting existing compliance measures you discover.

Focus on actionable output — every finding should result in at least one artifact (risk, control, policy, or evidence).`,
    tags: ["SOC2", "audit", "readiness", "compliance"],
    expectedOutcome: "Creates risks for SOC 2 gaps, controls to address them, required policies, and evidence items",
  },
  {
    id: "iso27001-gap",
    category: "Compliance Audit",
    title: "ISO 27001:2022 Gap Analysis",
    instructions: `Conduct an ISO 27001:2022 gap analysis focusing on Annex A controls.

1. Search for the current ISO 27001:2022 Annex A control categories (Organizational, People, Physical, Technological).
2. Review our existing controls and policies against each Annex A control requirement.
3. Create risks for every unmet or partially met control requirement — include the specific Annex A reference (e.g., A.5.1, A.8.1).
4. Create controls for each gap, specifying implementation steps and the Annex A control it addresses.
5. Create policies for any missing mandatory policies (ISMS scope, risk treatment, information security policy, etc.).
6. Create evidence items for controls that are already in place.

Be thorough — ISO 27001 has 93 Annex A controls across 4 themes. Prioritize gaps by risk severity.`,
    tags: ["ISO27001", "gap-analysis", "ISMS"],
    expectedOutcome: "Creates comprehensive artifacts mapping to ISO 27001 Annex A controls with gap identification",
  },
  {
    id: "nist-csf-assessment",
    category: "Compliance Audit",
    title: "NIST CSF Assessment",
    instructions: `Perform a NIST Cybersecurity Framework assessment across all five functions.

1. Search for the latest NIST CSF subcategories across Identify, Protect, Detect, Respond, and Recover.
2. Evaluate our current posture in each function by reviewing existing controls and policies.
3. Create risks for gaps in each NIST CSF function — map to specific subcategories (e.g., ID.AM-1, PR.AC-1).
4. Create controls to address each gap with specific implementation guidance.
5. Create policies for any missing governance or procedural documents.
6. Create evidence items for existing capabilities and documentation.

Prioritize by the Protect and Detect functions, as these have the most direct security impact.`,
    tags: ["NIST", "CSF", "cybersecurity", "framework"],
    expectedOutcome: "Creates artifacts across all five NIST CSF functions with gap analysis",
  },

  // ── Risk Management ──────────────────────────────────────────────────────
  {
    id: "comprehensive-risk-assessment",
    category: "Risk Management",
    title: "Comprehensive Risk Assessment",
    instructions: `Conduct a comprehensive organizational risk assessment.

1. Search for common GRC risk categories: operational, cybersecurity, regulatory, vendor/third-party, data privacy, business continuity.
2. For each category, identify at least 2-3 specific risks relevant to our organization.
3. Create each risk with appropriate likelihood (1-5) and impact (1-5) scores, detailed descriptions, and suggested risk response (mitigate, accept, transfer, avoid).
4. Create controls to mitigate each high and critical risk (score >= 15).
5. Create policies for any risk categories lacking governance documentation.

Aim for at least 10-15 risks across all categories. Be specific — "Data breach via unpatched systems" is better than "Security risk".`,
    tags: ["risk-assessment", "comprehensive", "enterprise"],
    expectedOutcome: "Creates 10-15 categorized risks with controls and policies for high-severity items",
  },
  {
    id: "vendor-risk-review",
    category: "Risk Management",
    title: "Vendor & Third-Party Risk Review",
    instructions: `Perform a third-party vendor risk assessment.

1. Search for industry best practices in vendor risk management (NIST, ISO 27001 supplier relationships).
2. Create risks for common vendor risk scenarios: data sharing, service dependency, compliance gaps, concentration risk, supply chain attacks.
3. Create controls for vendor management: due diligence procedures, contract requirements, ongoing monitoring, access controls for third parties.
4. Create a Vendor Management Policy covering assessment criteria, onboarding requirements, periodic reviews, and incident notification requirements.
5. Create evidence templates for vendor security assessments and review documentation.

Focus on write output — every vendor risk scenario should have a corresponding control and policy requirement.`,
    tags: ["vendor", "third-party", "supply-chain"],
    expectedOutcome: "Creates vendor risks, management controls, vendor policy, and evidence templates",
  },
  {
    id: "access-control-audit",
    category: "Risk Management",
    title: "Access Control Audit",
    instructions: `Audit access control practices and create artifacts to strengthen them.

1. Search for access control best practices (NIST 800-53 AC family, ISO 27001 A.9).
2. Create risks for common access control weaknesses: excessive privileges, shared accounts, no MFA, orphaned accounts, inadequate logging.
3. Create controls for each identified weakness: least privilege enforcement, MFA requirements, access review procedures, account lifecycle management.
4. Create an Access Control Policy covering authentication standards, authorization model, access review cadence, and privileged access management.
5. Create evidence items for any access control measures already in place.

Be specific about implementation — each control should describe what to implement and how to verify it.`,
    tags: ["access-control", "authentication", "authorization", "IAM"],
    expectedOutcome: "Creates access control risks, controls, policy, and evidence items",
  },

  // ── Policy Management ────────────────────────────────────────────────────
  {
    id: "policy-creation-suite",
    category: "Policy Management",
    title: "Essential Policy Suite",
    instructions: `Create a comprehensive suite of essential GRC policies for our organization.

Create the following policies with detailed content:
1. Information Security Policy — overarching security governance, scope, roles & responsibilities
2. Acceptable Use Policy — acceptable and prohibited use of systems, data handling, BYOD
3. Data Classification Policy — classification levels, handling requirements, labeling standards
4. Incident Response Policy — incident categories, escalation procedures, communication plan, post-incident review
5. Business Continuity Policy — BCP scope, RPO/RTO objectives, testing requirements, crisis communication
6. Change Management Policy — change categories, approval workflows, rollback procedures, emergency changes
7. Password & Authentication Policy — complexity requirements, MFA mandates, credential storage

For each policy, include: purpose, scope, roles & responsibilities, policy statements, enforcement, and review cycle.`,
    tags: ["policies", "governance", "essential-suite"],
    expectedOutcome: "Creates 7 comprehensive organizational policies",
  },
  {
    id: "policy-review-update",
    category: "Policy Management",
    title: "Policy Review & Gap Analysis",
    instructions: `Review existing policies and identify gaps in our policy framework.

1. List all current policies in the system.
2. Search for regulatory requirements applicable to our industry (SOC 2, ISO 27001, GDPR, HIPAA as applicable).
3. Create risks for any policy gaps — missing policies, outdated policies, policies lacking enforcement mechanisms.
4. Create new policies for any identified gaps.
5. For existing policies that need updates, create risks noting the specific sections that are outdated or incomplete.
6. Create controls for policy enforcement and review processes.

Focus on identifying what's missing rather than what exists. Every gap should result in either a new policy or a risk documenting the deficiency.`,
    tags: ["policy-review", "gap-analysis", "governance"],
    expectedOutcome: "Creates risks for policy gaps, new policies for missing areas, and enforcement controls",
  },

  // ── Evidence Collection ──────────────────────────────────────────────────
  {
    id: "evidence-gathering",
    category: "Evidence Collection",
    title: "Evidence Gathering Campaign",
    instructions: `Create a comprehensive evidence collection plan and initial evidence items.

1. Search for evidence requirements across SOC 2, ISO 27001, and NIST CSF frameworks.
2. For each major control category, create evidence items documenting:
   - What evidence is needed (screenshots, logs, configurations, policies)
   - Where to collect it from (systems, tools, processes)
   - Collection frequency (daily, weekly, monthly, quarterly)
3. Create risks for any areas where evidence collection is difficult or not automated.
4. Create controls for evidence collection automation and retention.

Prioritize evidence types that auditors specifically request: access reviews, change management logs, security training records, vulnerability scan results, and incident response tests.`,
    tags: ["evidence", "audit-readiness", "documentation"],
    expectedOutcome: "Creates evidence items, collection risks, and automation controls",
  },
  {
    id: "control-testing-docs",
    category: "Evidence Collection",
    title: "Control Testing Documentation",
    instructions: `Create documentation for control testing and effectiveness measurement.

1. List all existing controls in the system.
2. For each control, create evidence items describing:
   - Test procedure (how to verify the control works)
   - Expected results (what a passing test looks like)
   - Testing frequency (monthly, quarterly, annually)
   - Responsible party
3. Create risks for controls that lack testing procedures or have never been tested.
4. Create a Control Testing Policy defining testing methodology, sampling approach, and reporting requirements.

Focus on creating actionable test procedures that can be executed immediately. Each control should have at least one evidence item describing its test.`,
    tags: ["control-testing", "effectiveness", "testing"],
    expectedOutcome: "Creates test procedure evidence items for each control and a testing policy",
  },
];

export const TEMPLATE_CATEGORIES = [...new Set(AGENT_INSTRUCTION_TEMPLATES.map((t) => t.category))];
