import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { logAudit } from "@/shared/lib/audit";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (admin as any)
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const organizationId = userData?.organization_id ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (admin as any)
      .from("control_library")
      .select(
        "id, code, title, description, control_type, automation_level, status, effectiveness_rating, metadata, owner_id, created_at, updated_at"
      )
      .order("code", { ascending: true });

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    } else {
      query = query.eq("owner_id", user.id);
    }

    const { data: controls, error } = await query;

    if (error) {
      console.error("Controls fetch error:", error);
      return Response.json({ controls: [], error: error.message });
    }

    // Resolve owner names in a single query if there are controls with owner_ids
    const ownerIds = [
      ...new Set(
        (controls || [])
          .map((c: { owner_id: string | null }) => c.owner_id)
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

    const enriched = (controls || []).map(
      (c: { owner_id: string | null; [key: string]: unknown }) => ({
        ...c,
        owner_name: c.owner_id ? (ownerMap[c.owner_id] ?? "Team member") : "Unassigned",
      })
    );

    return Response.json({ controls: enriched });
  } catch (err) {
    console.error("GET /api/controls error:", err);
    return Response.json(
      { controls: [], error: "Failed to fetch controls" },
      { status: 500 }
    );
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
    const admin = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (admin as any)
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    const organizationId = userData?.organization_id ?? null;
    const controlCode =
      String(body.code || "").trim() || `CTRL-${Date.now().toString(36).toUpperCase()}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from("control_library")
      .insert({
        organization_id: organizationId,
        code: controlCode,
        title: body.title || "Untitled Control",
        description: body.description || "",
        control_type: body.control_type || "technical",
        automation_level: body.automation_level || "manual",
        effectiveness_rating: Number(body.effectiveness_rating) || 3,
        status: body.status || "draft",
        metadata: { frameworks: Array.isArray(body.frameworks) ? body.frameworks : [] },
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Create control DB error:", JSON.stringify(error));
      return Response.json(
        { error: "Failed to create control", detail: error.message },
        { status: 500 }
      );
    }

    void logAudit({ organizationId: organizationId, userId: user.id, action: "control.created", entityType: "control", entityId: data.id, newValues: data });
    return Response.json({ success: true, control: data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/controls error:", err);
    return Response.json({ error: "Failed to create control" }, { status: 500 });
  }
}
