import { createAdminClient } from "@/shared/lib/supabase/admin";

export const AGENT_FREE_LIMIT = 10;
export const AGENT_TRIAL_DAYS = 7;

export interface AgentUsageInfo {
  allowed: boolean;
  reason?: string;
  runCount: number;
  trialStartedAt: string | null;
  trialExpired: boolean;
  trialDaysRemaining: number;
  freeActionsRemaining: number;
  creditsRemaining: number;
  hasUnlimitedPlan: boolean;
}

/**
 * Check whether the organization is allowed to run an agent action.
 *
 * Priority:
 *  1. Agent unlimited add-on active → unlimited
 *  2. Within 7-day trial AND < 10 runs → allowed
 *  3. Purchased credits remaining → allowed
 *  4. Otherwise → blocked
 *
 * Note: Growth subscription gives unlimited *Copilot*, NOT unlimited Agents.
 * Agent actions are a separate add-on for all plans.
 */
export async function checkAgentUsage(organizationId: string): Promise<AgentUsageInfo> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const [orgResult, subResult] = await Promise.all([
    admin.from("organizations").select("settings").eq("id", organizationId).single(),
    admin.from("subscriptions").select("plan, status, current_period_end, agent_plan").eq("organization_id", organizationId).single(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings: Record<string, any> = orgResult.data?.settings ?? {};
  const sub = subResult.data;

  const runCount: number = settings.agent_run_count ?? 0;
  const trialStartedAt: string | null = settings.agent_trial_started_at ?? null;
  const creditsPurchased: number = settings.agent_credits_purchased ?? 0;

  // Agent unlimited add-on
  const hasUnlimitedPlan = sub?.agent_plan === "unlimited";

  // Trial calculation
  let trialExpired = true;
  let trialDaysRemaining = 0;
  if (trialStartedAt) {
    const elapsed = Date.now() - new Date(trialStartedAt).getTime();
    const daysElapsed = elapsed / (1000 * 60 * 60 * 24);
    trialExpired = daysElapsed > AGENT_TRIAL_DAYS;
    trialDaysRemaining = Math.max(0, Math.ceil(AGENT_TRIAL_DAYS - daysElapsed));
  } else {
    // Trial hasn't started yet — first run will start it
    trialExpired = false;
    trialDaysRemaining = AGENT_TRIAL_DAYS;
  }

  const freeActionsRemaining = Math.max(0, AGENT_FREE_LIMIT - runCount);

  // Credits apply to runs beyond the free 10
  const creditsUsed = Math.max(0, runCount - AGENT_FREE_LIMIT);
  const creditsRemaining = Math.max(0, creditsPurchased - creditsUsed);

  // Access check (priority order)
  if (hasUnlimitedPlan) {
    return {
      allowed: true,
      runCount,
      trialStartedAt,
      trialExpired,
      trialDaysRemaining,
      freeActionsRemaining,
      creditsRemaining,
      hasUnlimitedPlan,
    };
  }

  // Trial: within 7 days AND under 10 runs
  if (!trialExpired && runCount < AGENT_FREE_LIMIT) {
    return {
      allowed: true,
      runCount,
      trialStartedAt,
      trialExpired,
      trialDaysRemaining,
      freeActionsRemaining,
      creditsRemaining,
      hasUnlimitedPlan,
    };
  }

  // Purchased credits
  if (creditsRemaining > 0) {
    return {
      allowed: true,
      runCount,
      trialStartedAt,
      trialExpired,
      trialDaysRemaining,
      freeActionsRemaining,
      creditsRemaining,
      hasUnlimitedPlan,
    };
  }

  // Blocked
  const reason = trialExpired
    ? "Your 7-day Agent trial has expired. Purchase action packs ($10/10 actions) or subscribe to unlimited ($99.99/mo)."
    : `You've used all ${AGENT_FREE_LIMIT} free Agent actions. Purchase more actions or subscribe to unlimited.`;

  return {
    allowed: false,
    reason,
    runCount,
    trialStartedAt,
    trialExpired,
    trialDaysRemaining,
    freeActionsRemaining,
    creditsRemaining,
    hasUnlimitedPlan,
  };
}

/**
 * Increment the agent run counter. Sets trial start timestamp on the first run.
 */
export async function incrementAgentRunCount(organizationId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: org } = await admin.from("organizations").select("settings").eq("id", organizationId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings: Record<string, any> = org?.settings ?? {};

  const updates: Record<string, unknown> = {
    ...settings,
    agent_run_count: (settings.agent_run_count ?? 0) + 1,
  };

  // Start the trial clock on first run
  if (!settings.agent_trial_started_at) {
    updates.agent_trial_started_at = new Date().toISOString();
  }

  await admin.from("organizations").update({ settings: updates }).eq("id", organizationId);
}
