import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { stripe } from "@/shared/lib/stripe";
import { logAudit } from "@/shared/lib/audit";

export async function POST() {
  if (!stripe) {
    return Response.json({ error: "Billing not configured" }, { status: 503 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: userData } = await admin
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return Response.json({ error: "No organization found" }, { status: 400 });
    }
    if (!["owner", "admin"].includes(userData.role ?? "")) {
      return Response.json({ error: "Only owners and admins can cancel agent subscriptions" }, { status: 403 });
    }

    // Get the agent subscription ID
    const { data: sub } = await admin
      .from("subscriptions")
      .select("agent_plan, agent_stripe_subscription_id")
      .eq("organization_id", userData.organization_id)
      .single();

    if (!sub?.agent_stripe_subscription_id) {
      return Response.json({ error: "No active agent subscription found" }, { status: 400 });
    }

    // Cancel at period end so they keep access until the billing cycle ends
    await stripe.subscriptions.update(sub.agent_stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    void logAudit({
      organizationId: userData.organization_id,
      userId: user.id,
      action: "agent_subscription.canceled",
      entityType: "subscription",
      entityId: sub.agent_stripe_subscription_id,
      newValues: { agent_plan: "unlimited", cancel_at_period_end: true },
    });

    return Response.json({ success: true, message: "Agent unlimited plan will cancel at the end of the billing period." });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
