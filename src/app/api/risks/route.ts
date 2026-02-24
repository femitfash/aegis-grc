import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function GET(_request: NextRequest) {
  try {
    // Guard: service role key must be configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("GET /api/risks: SUPABASE_SERVICE_ROLE_KEY is not set");
      return Response.json({ risks: [], error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing" }, { status: 500 });
    }

    // Authenticate the user via session cookies
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use admin client to bypass RLS — safe because we've already authenticated above
    const admin = createAdminClient();

    // Try to get the user's organization_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (admin as any)
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const organizationId = userData?.organization_id ?? null;

    // Use select("*") so the query succeeds regardless of schema variations.
    // GENERATED ALWAYS AS columns (inherent_score / residual_score) are included
    // when they exist and simply absent when they don't — both cases are fine
    // because we (re-)compute scores in the application layer below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (admin as any)
      .from("risks")
      .select("*")
      .order("created_at", { ascending: false });

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    } else {
      // Fallback: show risks owned by this user (no org set up yet)
      query = query.eq("owner_id", user.id);
    }

    const { data: risks, error } = await query;

    if (error) {
      console.error("Risks fetch error:", JSON.stringify(error));
      // Return the actual error so callers can diagnose it
      return Response.json({ risks: [], error: error.message }, { status: 500 });
    }

    // Compute scores application-side (avoids dependency on GENERATED ALWAYS AS columns)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scored = (risks || []).map((r: any) => ({
      ...r,
      inherent_score:
        typeof r.inherent_likelihood === "number" && typeof r.inherent_impact === "number"
          ? r.inherent_likelihood * r.inherent_impact
          : null,
      residual_score:
        typeof r.residual_likelihood === "number" && typeof r.residual_impact === "number"
          ? r.residual_likelihood * r.residual_impact
          : null,
    }));

    // Sort by computed inherent_score descending (highest risk first)
    scored.sort((a: { inherent_score: number | null }, b: { inherent_score: number | null }) =>
      (b.inherent_score ?? 0) - (a.inherent_score ?? 0)
    );

    // Resolve owner names from the users table (same pattern as controls API)
    const ownerIds = [
      ...new Set(
        scored
          .map((r: { owner_id: string | null }) => r.owner_id)
          .filter(Boolean)
      ),
    ] as string[];

    let ownerMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: owners } = await (admin as any)
        .from("users")
        .select("id, full_name, email")
        .in("id", ownerIds);

      ownerMap = Object.fromEntries(
        (owners || []).map((u: { id: string; full_name: string | null; email: string }) => [
          u.id,
          u.full_name || u.email,
        ])
      );
    }

    const enriched = scored.map((r: { owner_id: string | null; [key: string]: unknown }) => ({
      ...r,
      owner_name: r.owner_id ? (ownerMap[r.owner_id] ?? "Team member") : "Unassigned",
    }));

    return Response.json({ risks: enriched });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET /api/risks error:", msg);
    return Response.json({ risks: [], error: msg }, { status: 500 });
  }
}
