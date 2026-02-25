import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { stripe } from "@/shared/lib/stripe";

export async function POST() {
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
    return Response.json({ error: "No organization" }, { status: 400 });
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

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${appUrl}/dashboard/settings?tab=billing`,
  });

  return Response.json({ url: session.url });
}
