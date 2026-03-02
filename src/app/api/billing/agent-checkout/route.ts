import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { stripe, PRICES } from "@/shared/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return Response.json({ error: "Billing not configured" }, { status: 503 });
    }

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

    const organizationId = userData?.organization_id;
    if (!organizationId) {
      return Response.json({ error: "No organization found" }, { status: 400 });
    }

    const body = await request.json();
    const type: string = body.type;
    const billing: string = body.billing ?? "monthly";

    if (!["action_pack", "unlimited"].includes(type)) {
      return Response.json({ error: "Invalid type. Must be 'action_pack' or 'unlimited'." }, { status: 400 });
    }
    if (!["monthly", "annual"].includes(billing)) {
      return Response.json({ error: "Invalid billing. Must be 'monthly' or 'annual'." }, { status: 400 });
    }

    // Get or create Stripe customer
    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", organizationId)
      .single();

    let customerId: string | undefined = sub?.stripe_customer_id ?? undefined;

    if (!customerId) {
      const { data: org } = await admin
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single();

      const customer = await stripe.customers.create({
        email: user.email,
        name: org?.name ?? undefined,
        metadata: { organization_id: organizationId },
      });
      customerId = customer.id;

      await admin
        .from("subscriptions")
        .upsert(
          { organization_id: organizationId, stripe_customer_id: customerId },
          { onConflict: "organization_id" }
        );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fastgrc.ai";

    if (type === "action_pack") {
      const priceId = billing === "annual"
        ? PRICES.agent_action_pack_annual
        : PRICES.agent_action_pack_monthly;

      if (!priceId) {
        return Response.json({ error: "Agent action pack price not configured" }, { status: 503 });
      }

      // Try one-time payment first; if the price is recurring, fall back to subscription mode
      try {
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: "payment",
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${appUrl}/dashboard/agents?purchased=actions`,
          cancel_url: `${appUrl}/dashboard/agents`,
          metadata: { organization_id: organizationId, type: "agent_action_pack" },
        });
        return Response.json({ url: session.url });
      } catch {
        // Price is likely recurring — use subscription mode instead
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${appUrl}/dashboard/agents?purchased=actions`,
          cancel_url: `${appUrl}/dashboard/agents`,
          subscription_data: {
            metadata: { organization_id: organizationId, type: "agent_action_pack" },
          },
        });
        return Response.json({ url: session.url });
      }
    }

    // type === "unlimited"
    const priceId = billing === "annual"
      ? PRICES.agent_unlimited_annual
      : PRICES.agent_unlimited_monthly;

    if (!priceId) {
      return Response.json({ error: "Agent unlimited price not configured" }, { status: 503 });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/agents?purchased=unlimited`,
      cancel_url: `${appUrl}/dashboard/agents`,
      subscription_data: {
        metadata: { organization_id: organizationId, type: "agent_unlimited" },
      },
    });

    return Response.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent-checkout] Error:", message);
    return Response.json({ error: `Checkout failed: ${message}` }, { status: 500 });
  }
}
