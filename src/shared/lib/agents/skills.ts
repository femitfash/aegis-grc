export interface Skill {
  id: string;
  name: string;
  description: string;
  requiresApproval: boolean;
  category: "research" | "analysis" | "write" | "output";
}

export const SKILL_CATALOG: Skill[] = [
  {
    id: "web_search",
    name: "Web Search",
    description: "Search the internet for GRC-related information (powered by Tavily)",
    requiresApproval: false,
    category: "research",
  },
  {
    id: "risk_analysis",
    name: "Risk Analysis",
    description: "Analyze and summarize risks in the organization's risk register",
    requiresApproval: false,
    category: "analysis",
  },
  {
    id: "compliance_check",
    name: "Compliance Check",
    description: "Check compliance status across active frameworks and surface gaps",
    requiresApproval: false,
    category: "analysis",
  },
  {
    id: "send_report",
    name: "Generate Report",
    description: "Generate and save a compliance or risk summary report",
    requiresApproval: false,
    category: "output",
  },
  {
    id: "create_risk",
    name: "Create Risk",
    description: "Create new risks in the risk register based on findings",
    requiresApproval: true,
    category: "write",
  },
  {
    id: "create_incident",
    name: "Create Incident",
    description: "Log new security incidents discovered during monitoring",
    requiresApproval: true,
    category: "write",
  },
  {
    id: "create_policy",
    name: "Create Policy",
    description: "Draft and create new policies based on regulatory requirements",
    requiresApproval: true,
    category: "write",
  },
  {
    id: "update_requirement",
    name: "Update Requirements",
    description: "Update compliance requirement statuses based on evidence",
    requiresApproval: true,
    category: "write",
  },
];

export const SKILL_MAP = Object.fromEntries(SKILL_CATALOG.map((s) => [s.id, s])) as Record<string, Skill>;

export function getSkill(id: string): Skill | undefined {
  return SKILL_MAP[id];
}

export const SCHEDULE_LABELS: Record<string, string> = {
  manual: "Manual only",
  hourly: "Every hour",
  daily_6am: "Daily at 6am UTC",
  daily_9am: "Daily at 9am UTC",
  weekly_monday: "Weekly on Monday 9am UTC",
};
