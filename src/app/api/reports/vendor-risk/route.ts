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
  const { data, error } = await (admin as any).from("vendors").select("*").eq("organization_id", organizationId).order("risk_score", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const vendors = data || [];
  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  type Vendor = { tier: string; status: string; risk_score: number; contract_expiry?: string; last_assessed_at?: string };

  const stats = {
    total: vendors.length,
    by_tier: {
      critical: vendors.filter((v: Vendor) => v.tier === "critical").length,
      high: vendors.filter((v: Vendor) => v.tier === "high").length,
      medium: vendors.filter((v: Vendor) => v.tier === "medium").length,
      low: vendors.filter((v: Vendor) => v.tier === "low").length,
    },
    by_status: {
      active: vendors.filter((v: Vendor) => v.status === "active").length,
      under_review: vendors.filter((v: Vendor) => v.status === "under_review").length,
      approved: vendors.filter((v: Vendor) => v.status === "approved").length,
      suspended: vendors.filter((v: Vendor) => v.status === "suspended").length,
    },
    avg_risk_score: vendors.length > 0
      ? Math.round(vendors.reduce((a: number, v: Vendor) => a + (v.risk_score || 0), 0) / vendors.length * 10) / 10
      : 0,
    contracts_expiring_90d: vendors.filter((v: Vendor) => v.contract_expiry && new Date(v.contract_expiry) >= now && new Date(v.contract_expiry) <= in90Days).length,
    contracts_expired: vendors.filter((v: Vendor) => v.contract_expiry && new Date(v.contract_expiry) < now).length,
    never_assessed: vendors.filter((v: Vendor) => !v.last_assessed_at).length,
  };

  // Top risk vendors
  const highRiskVendors = vendors.filter((v: Vendor) => v.risk_score >= 15 || v.tier === "critical" || v.tier === "high").slice(0, 10);

  // Expiring contracts
  const expiringContracts = vendors
    .filter((v: Vendor) => v.contract_expiry && new Date(v.contract_expiry) >= now && new Date(v.contract_expiry) <= in90Days)
    .sort((a: Vendor, b: Vendor) => new Date(a.contract_expiry!).getTime() - new Date(b.contract_expiry!).getTime());

  return Response.json({
    organization_name: org?.name ?? "Your Organization",
    generated_at: new Date().toISOString(),
    stats,
    high_risk_vendors: highRiskVendors,
    expiring_contracts: expiringContracts,
    vendors,
  });
}
