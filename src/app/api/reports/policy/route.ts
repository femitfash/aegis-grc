import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (admin as any).from("users").select("organization_id").eq("id", user.id).single();
  const organizationId = userData?.organization_id ?? null;
  if (!organizationId) return Response.json({ error: "No organization" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (admin as any).from("organizations").select("name").eq("id", organizationId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from("policies").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const policies = data || [];
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  type Policy = { status: string; category?: string; review_date?: string; attestation_required?: boolean };

  const stats = {
    total: policies.length,
    by_status: {
      draft: policies.filter((p: Policy) => p.status === "draft").length,
      active: policies.filter((p: Policy) => p.status === "active").length,
      archived: policies.filter((p: Policy) => p.status === "archived").length,
    },
    overdue_review: policies.filter((p: Policy) => p.review_date && new Date(p.review_date) < now).length,
    review_due_30d: policies.filter((p: Policy) => p.review_date && new Date(p.review_date) >= now && new Date(p.review_date) <= in30Days).length,
    review_due_90d: policies.filter((p: Policy) => p.review_date && new Date(p.review_date) >= now && new Date(p.review_date) <= in90Days).length,
    attestation_required: policies.filter((p: Policy) => p.attestation_required).length,
  };

  // Group by category
  const categories = [...new Set(policies.map((p: Policy) => p.category || "General"))] as string[];
  const byCategory = categories.map((cat) => {
    const catPolicies = policies.filter((p: Policy) => (p.category || "General") === cat);
    return {
      name: cat,
      total: catPolicies.length,
      active: catPolicies.filter((p: Policy) => p.status === "active").length,
      draft: catPolicies.filter((p: Policy) => p.status === "draft").length,
    };
  });

  // Upcoming reviews
  const upcomingReviews = policies
    .filter((p: Policy) => p.review_date && new Date(p.review_date) >= now)
    .sort((a: Policy, b: Policy) => new Date(a.review_date!).getTime() - new Date(b.review_date!).getTime())
    .slice(0, 10);

  return Response.json({
    organization_name: org?.name ?? "Your Organization",
    generated_at: new Date().toISOString(),
    stats,
    by_category: byCategory,
    upcoming_reviews: upcomingReviews,
    policies,
  });
}
