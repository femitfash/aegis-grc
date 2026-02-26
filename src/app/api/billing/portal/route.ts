import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { stripe, PRICES } from "@/shared/lib/stripe";

// Cache the portal configuration ID for the lifetime of this serverless instance
// so we don't create a new config on every request.
let cachedPortalConfigId: string | null = process.env.STRIPE_PORTAL_CONFIG_ID ?? null;

async function getOrCreatePortalConfig(): Promise<string | null> {
  if (!stripe) return null;
  if (cachedPortalConfigId) return cachedPortalConfigId;

  // Gather price IDs we have configured
  const contribPrices = [PRICES.contributor_monthly, PRICES.contributor_annual].filter(Boolean);
  const readonlyPrices = [PRICES.readonly_monthly, PRICES.readonly_annual].filter(Boolean);

  if (contribPrices.length === 0) {
    // No price IDs configured — can't set up subscription_update products list.
    // Fall back to a minimal portal config with just cancellation + invoice history.
    try {
      const config = await stripe.billingPortal.configurations.create({
        business_profile: { headline: "Manage your FastGRC subscription" },
        features: {
          invoice_history: { enabled: true },
          payment_method_update: { enabled: true },
          subscription_cancel: {
            enabled: true,
            mode: "at_period_end",
            cancellation_reason: {
              enabled: true,
              options: ["too_expensive", "missing_features", "switched_service", "other"],
            },
          },
        },
      });
      cachedPortalConfigId = config.id;
      console.log("[billing portal] Created minimal config (no price IDs set):", config.id);
    } catch (err) {
      console.error("[billing portal] Could not create portal config:", err);
    }
    return cachedPortalConfigId;
  }

  // Retrieve product IDs from the price objects
  try {
    const contribPrice = await stripe.prices.retrieve(contribPrices[0]);
    const productId = typeof contribPrice.product === "string"
      ? contribPrice.product
      : contribPrice.product.id;

    // Build the products array — include readonly seats product if it differs
    const products: { product: string; prices: string[] }[] = [
      { product: productId, prices: contribPrices },
    ];

    if (readonlyPrices.length > 0) {
      const roPrice = await stripe.prices.retrieve(readonlyPrices[0]);
      const roProductId = typeof roPrice.product === "string"
        ? roPrice.product
        : roPrice.product.id;
      if (roProductId !== productId) {
        products.push({ product: roProductId, prices: readonlyPrices });
      } else {
        // Same product — merge prices
        products[0].prices = [...new Set([...contribPrices, ...readonlyPrices])];
      }
    }

    const config = await stripe.billingPortal.configurations.create({
      business_profile: { headline: "Manage your FastGRC subscription" },
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end",
          cancellation_reason: {
            enabled: true,
            options: ["too_expensive", "missing_features", "switched_service", "other"],
          },
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["quantity", "price"],
          proration_behavior: "create_prorations",
          products,
        },
      },
    });

    cachedPortalConfigId = config.id;
    console.log("[billing portal] Created portal config with seat management:", config.id,
      "— set STRIPE_PORTAL_CONFIG_ID=" + config.id + " in env vars to reuse it");
  } catch (err) {
    console.error("[billing portal] Could not create portal config:", err);
  }

  return cachedPortalConfigId;
}

export async function POST() {
  try {
    if (!stripe) {
      return Response.json({ error: "Billing not configured" }, { status: 503 });
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

    if (!userData?.organization_id) {
      return Response.json({ error: "No organization found" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sub } = await (admin as any)
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", userData.organization_id)
      .single();

    if (!sub?.stripe_customer_id) {
      return Response.json({ error: "No billing account found. Please subscribe first." }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.fastgrc.ai";

    // Get or create a portal configuration that enables seat management
    const configurationId = await getOrCreatePortalConfig();

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl}/dashboard/settings?tab=billing`,
      ...(configurationId ? { configuration: configurationId } : {}),
    });

    return Response.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[billing portal] Error:", message);
    return Response.json({ error: `Portal failed: ${message}` }, { status: 500 });
  }
}
