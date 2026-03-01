import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { checkAgentUsage, AGENT_FREE_LIMIT, AGENT_TRIAL_DAYS } from "@/shared/lib/agents/usage";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: userData } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return Response.json({
        allowed: true,
        runCount: 0,
        trialStartedAt: null,
        trialExpired: false,
        trialDaysRemaining: AGENT_TRIAL_DAYS,
        freeActionsRemaining: AGENT_FREE_LIMIT,
        creditsRemaining: 0,
        hasUnlimitedPlan: false,
      });
    }

    const usage = await checkAgentUsage(userData.organization_id);
    return Response.json(usage);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
