import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { stripe, PRICES } from "@/shared/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return Response.json({ error: "Billing not configured — STRIPE_SECRET_KEY is missing." }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (admin as any)
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    let organizationId: string | null = userData?.organization_id ?? null;

    if (!organizationId) {
      // Auto-provision an org for users whose signup trigger didn't fire
      const orgName =
        user.user_metadata?.organization_name ??
        user.email?.split("@")[0] ??
        "My Organization";
      const orgSlug = `org-${user.id.slice(0, 8)}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newOrg } = await (admin as any)
        .from("organizations")
        .insert({ name: orgName, slug: orgSlug, subscription_tier: "starter" })
        .select("id")
        .single();

      if (!newOrg?.id) {
        return Response.json({ error: "Failed to provision organization" }, { status: 500 });
      }

      organizationId = newOrg.id as string;

      // Link user to the new org
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("users")
        .upsert({
          id: user.id,
          organization_id: organizationId,
          email: user.email,
          full_name: user.user_metadata?.full_name ?? user.email,
          role: "owner",
        });
    }

    const body = await request.json();
    const contributors: number = Math.max(2, Number(body.contributors) || 2);
    const readonly_users: number = Math.max(0, Number(body.readonly_users) || 0);
    const interval: "month" | "year" = body.interval === "month" ? "month" : "year";

    // Get or create Stripe customer tied to this org
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sub } = await (admin as any)
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", organizationId)
      .single();

    let customerId: string | undefined = sub?.stripe_customer_id ?? undefined;

    if (!customerId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: org } = await (admin as any)
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

      // Persist customer ID immediately
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("subscriptions")
        .upsert(
          { organization_id: organizationId, stripe_customer_id: customerId },
          { onConflict: "organization_id" }
        );
    }

    const lineItems: { price: string; quantity: number }[] = [];

    const contribPrice = interval === "year" ? PRICES.contributor_annual : PRICES.contributor_monthly;
    if (contribPrice) {
      lineItems.push({ price: contribPrice, quantity: contributors });
    }

    const roPrice = interval === "year" ? PRICES.readonly_annual : PRICES.readonly_monthly;
    if (roPrice && readonly_users > 0) {
      lineItems.push({ price: roPrice, quantity: readonly_users });
    }

    if (lineItems.length === 0) {
      console.error("[checkout] No price IDs configured. PRICES:", JSON.stringify(PRICES));
      return Response.json(
        { error: "Stripe price IDs are not configured. Set STRIPE_PRICE_CONTRIBUTOR_ANNUAL and STRIPE_PRICE_CONTRIBUTOR_MONTHLY in your environment variables." },
        { status: 503 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fastgrc.ai";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: lineItems,
      success_url: `${appUrl}/dashboard/settings?tab=billing&upgraded=true`,
      cancel_url: `${appUrl}/dashboard/settings?tab=billing`,
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          organization_id: organizationId,
          seats_contributors: String(contributors),
          seats_readonly: String(readonly_users),
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });

    return Response.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[checkout] Stripe error:", message);
    return Response.json({ error: `Checkout failed: ${message}` }, { status: 500 });
  }
}
