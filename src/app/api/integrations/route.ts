import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

const SENSITIVE_KEYS = ["token", "secret", "password", "api_key", "webhook_url", "client_secret"];

function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (
      SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s)) &&
      typeof value === "string" &&
      value.length > 4
    ) {
      masked[key] = `••••${value.slice(-4)}`;
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

interface UserRecord {
  organization_id: string | null;
  role: string | null;
}

async function getUserRecord(
  userId: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<UserRecord> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("users")
    .select("organization_id, role")
    .eq("id", userId)
    .single();
  return {
    organization_id: data?.organization_id ?? null,
    role: data?.role ?? null,
  };
}

/** Only admins and owners can create/modify/delete integrations */
function assertAdminRole(role: string | null): Response | null {
  if (!role || !["admin", "owner"].includes(role)) {
    return Response.json(
      { error: "Forbidden: only organization admins can manage integrations." },
      { status: 403 }
    );
  }
  return null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { organization_id: organizationId } = await getUserRecord(user.id, admin);
    if (!organizationId) return Response.json({ integrations: [] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from("integrations")
      .select("id, provider, name, status, last_sync_at, last_sync_status, metadata, config")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Mask sensitive config fields before returning to client
    const integrations = (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      config: maskConfig(row.config as Record<string, unknown>),
    }));

    return Response.json({ integrations });
  } catch (error) {
    console.error("GET /api/integrations error:", error);
    return Response.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { provider, name, config } = body;

    if (!provider || !name || !config) {
      return Response.json({ error: "provider, name, and config are required" }, { status: 400 });
    }

    const VALID_PROVIDERS = ["github", "jira", "slack", "aws", "azure", "gcp"];
    if (!VALID_PROVIDERS.includes(provider)) {
      return Response.json({ error: "Unsupported provider" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { organization_id: organizationId, role } = await getUserRecord(user.id, admin);
    if (!organizationId) return Response.json({ error: "Organization not found" }, { status: 404 });

    // Only admins/owners can create integrations
    const forbidden = assertAdminRole(role);
    if (forbidden) return forbidden;

    // Upsert: one integration per provider per org
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from("integrations")
      .upsert(
        {
          organization_id: organizationId,
          provider,
          name,
          config,
          status: "inactive",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider" }
      )
      .select("id, provider, name, status")
      .single();

    if (error) {
      console.error("Upsert integration error:", JSON.stringify(error));
      return Response.json({ error: "Failed to save integration", detail: error.message }, { status: 500 });
    }

    return Response.json({ integration: data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/integrations error:", error);
    return Response.json({ error: "Failed to save integration" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "id is required" }, { status: 400 });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { organization_id: organizationId, role } = await getUserRecord(user.id, admin);
    if (!organizationId) return Response.json({ error: "Organization not found" }, { status: 404 });

    // Only admins/owners can delete integrations
    const forbidden = assertAdminRole(role);
    if (forbidden) return forbidden;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("integrations")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      return Response.json({ error: "Failed to delete integration", detail: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/integrations error:", error);
    return Response.json({ error: "Failed to delete integration" }, { status: 500 });
  }
}
