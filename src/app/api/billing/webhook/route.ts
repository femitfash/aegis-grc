import { NextRequest } from "next/server";
import { stripe } from "@/shared/lib/stripe";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import type Stripe from "stripe";

// Stripe requires the raw body for signature verification — disable Next.js
// body parsing for this route.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!stripe) {
    return Response.json({ error: "Billing not configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET not set");
    return Response.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed:", err);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  async function upsertSubscription(
    stripeSubscription: Stripe.Subscription,
    customerId: string
  ) {
    const orgId = stripeSubscription.metadata?.organization_id;
    if (!orgId) {
      console.warn("[stripe webhook] Subscription missing organization_id metadata");
      return;
    }

    // Count seats from subscription items
    let seatsContributors = 0;
    let seatsReadonly = 0;
    for (const item of stripeSubscription.items.data) {
      const priceId = item.price.id;
      const qty = item.quantity ?? 0;
      if (
        priceId === process.env.STRIPE_PRICE_CONTRIBUTOR_MONTHLY ||
        priceId === process.env.STRIPE_PRICE_CONTRIBUTOR_ANNUAL
      ) {
        seatsContributors += qty;
      } else if (
        priceId === process.env.STRIPE_PRICE_READONLY_MONTHLY ||
        priceId === process.env.STRIPE_PRICE_READONLY_ANNUAL
      ) {
        seatsReadonly += qty;
      }
    }

    const interval =
      stripeSubscription.items.data[0]?.price?.recurring?.interval === "year"
        ? "year"
        : "month";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("subscriptions")
      .upsert(
        {
          organization_id: orgId,
          stripe_customer_id: customerId,
          stripe_subscription_id: stripeSubscription.id,
          plan: "growth",
          billing_interval: interval,
          status: stripeSubscription.status,
          seats_contributors: seatsContributors,
          seats_readonly: seatsReadonly,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_start: (stripeSubscription as any).current_period_start != null ? new Date((stripeSubscription as any).current_period_start * 1000).toISOString() : null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          current_period_end: (stripeSubscription as any).current_period_end != null ? new Date((stripeSubscription as any).current_period_end * 1000).toISOString() : null,
          trial_end: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000).toISOString()
            : null,
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" }
      );

    // Also update organizations.subscription_tier for quick reads
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("organizations")
      .update({ subscription_tier: stripeSubscription.status === "active" || stripeSubscription.status === "trialing" ? "pro" : "trial" })
      .eq("id", orgId);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Handle one-time agent action pack purchase
      if (session.mode === "payment" && session.metadata?.type === "agent_action_pack") {
        const orgId = session.metadata.organization_id;
        if (orgId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: org } = await (admin as any)
            .from("organizations")
            .select("settings")
            .eq("id", orgId)
            .single();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const settings: Record<string, any> = org?.settings ?? {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any)
            .from("organizations")
            .update({
              settings: {
                ...settings,
                agent_credits_purchased: (settings.agent_credits_purchased ?? 0) + 10,
              },
            })
            .eq("id", orgId);
        }
        break;
      }

      // Handle agent unlimited subscription
      if (session.mode === "subscription" && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        if (sub.metadata?.type === "agent_unlimited") {
          const orgId = sub.metadata.organization_id;
          if (orgId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (admin as any)
              .from("subscriptions")
              .update({
                agent_plan: "unlimited",
                agent_stripe_subscription_id: sub.id,
                updated_at: new Date().toISOString(),
              })
              .eq("organization_id", orgId);
          }
        } else {
          // Regular Growth subscription
          await upsertSubscription(sub, session.customer as string);
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await upsertSubscription(sub, sub.customer as string);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.organization_id;
      if (orgId) {
        // Handle agent unlimited subscription cancellation
        if (sub.metadata?.type === "agent_unlimited") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any)
            .from("subscriptions")
            .update({
              agent_plan: null,
              agent_stripe_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("organization_id", orgId);
        } else {
          // Regular Growth subscription cancellation
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any)
            .from("subscriptions")
            .update({ plan: "builder", status: "canceled", updated_at: new Date().toISOString() })
            .eq("organization_id", orgId);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any)
            .from("organizations")
            .update({ subscription_tier: "trial" })
            .eq("id", orgId);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // In API 2026-01-28.clover, subscription ID moved to invoice.parent.subscription_details.subscription
      const rawSub = invoice.parent?.subscription_details?.subscription;
      const subId = typeof rawSub === "string" ? rawSub : typeof rawSub === "object" && rawSub ? rawSub.id : null;
      if (subId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subId);
      }
      break;
    }

    default:
      break;
  }

  return Response.json({ received: true });
}
