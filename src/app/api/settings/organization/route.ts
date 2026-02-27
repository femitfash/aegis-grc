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
    // won't have a users row yet. Before creating a new org, check if there is
    // a pending invite — if so, join the invited org instead.
    if (!userData?.organization_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pendingInvite } = await (admin as any)
        .from("invites")
        .select("organization_id, role")
        .eq("email", (user.email ?? "").toLowerCase())
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingInvite?.organization_id) {
        // Join the invited org rather than creating a new one
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from("users").upsert(
          {
            id: user.id,
            organization_id: pendingInvite.organization_id,
            email: user.email ?? "",
            full_name: user.user_metadata?.full_name ?? null,
            role: pendingInvite.role ?? "viewer",
            status: "active",
          },
          { onConflict: "id" }
        );
        // Mark invite as accepted
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("invites")
          .update({ accepted_at: new Date().toISOString() })
          .eq("organization_id", pendingInvite.organization_id)
          .eq("email", (user.email ?? "").toLowerCase())
          .is("accepted_at", null);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: invitedOrg } = await (admin as any)
          .from("organizations")
          .select("id, name, slug, settings")
          .eq("id", pendingInvite.organization_id)
          .single();

        return Response.json({
          organization: {
            id: invitedOrg?.id ?? pendingInvite.organization_id,
            name: invitedOrg?.name ?? "",
            slug: invitedOrg?.slug ?? "",
            industry: invitedOrg?.settings?.industry ?? "",
            company_size: invitedOrg?.settings?.company_size ?? "",
          },
          user_role: pendingInvite.role ?? "viewer",
        });
      }

      // No pending invite — create a brand-new org for this user
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
