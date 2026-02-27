import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (admin as any)
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    // Auto-provision: new users who have never hit the team/members endpoint
    // won't have a users row yet — create their org and users row here.
    if (!userData?.organization_id) {
      const orgName =
        user.user_metadata?.organization_name ??
        user.user_metadata?.full_name ??
        user.email?.split("@")[0] ??
        "My Organization";
      const orgSlug = `org-${user.id.slice(0, 8)}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newOrg } = await (admin as any)
        .from("organizations")
        .upsert({ name: orgName, slug: orgSlug, subscription_tier: "starter" }, { onConflict: "slug" })
        .select("id, name, slug, settings")
        .single();

      if (newOrg?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from("users").upsert(
          { id: user.id, organization_id: newOrg.id, email: user.email ?? "", full_name: user.user_metadata?.full_name ?? null, role: "owner", status: "active" },
          { onConflict: "id" }
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from("subscriptions").upsert(
          { organization_id: newOrg.id, plan: "builder", status: "active", seats_contributors: 1 },
          { onConflict: "organization_id" }
        );
        return Response.json({
          organization: { id: newOrg.id, name: newOrg.name || "", slug: newOrg.slug || "", industry: newOrg.settings?.industry || "", company_size: newOrg.settings?.company_size || "" },
          user_role: "owner",
        });
      }
      return Response.json({ organization: null, user_role: "owner" });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org, error } = await (admin as any)
      .from("organizations")
      .select("id, name, slug, settings")
      .eq("id", userData.organization_id)
      .single();

    if (error) {
      return Response.json({ organization: null, user_role: userData.role ?? null, error: error.message });
    }

    return Response.json({
      organization: {
        id: org.id,
        name: org.name || "",
        slug: org.slug || "",
        industry: org.settings?.industry || "",
        company_size: org.settings?.company_size || "",
      },
      user_role: userData.role ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ organization: null, error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (admin as any)
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return Response.json({ error: "No organization found" }, { status: 400 });
    }

    const body = await request.json();

    // Build update payload
    const orgUpdate: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      orgUpdate.name = body.name.trim();
    }
    if (typeof body.slug === "string" && body.slug.trim()) {
      orgUpdate.slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    }

    // Fetch existing settings to merge
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org } = await (admin as any)
      .from("organizations")
      .select("settings")
      .eq("id", userData.organization_id)
      .single();

    const currentSettings = org?.settings || {};
    const settingsUpdate: Record<string, unknown> = { ...currentSettings };
    if (typeof body.industry === "string") settingsUpdate.industry = body.industry;
    if (typeof body.company_size === "string") settingsUpdate.company_size = body.company_size;

    orgUpdate.settings = settingsUpdate;
    orgUpdate.updated_at = new Date().toISOString();

    if (Object.keys(orgUpdate).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("organizations")
      .update(orgUpdate)
      .eq("id", userData.organization_id);

    if (error) {
      console.error("PATCH /api/settings/organization error:", JSON.stringify(error));
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
