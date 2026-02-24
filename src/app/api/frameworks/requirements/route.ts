import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { logAudit } from "@/shared/lib/audit";

// GET — return custom framework requirements stored in organizations.settings
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
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) {
      return Response.json({ custom_requirements: {} });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org } = await (admin as any)
      .from("organizations")
      .select("settings")
      .eq("id", userData.organization_id)
      .single();

    return Response.json({
      custom_requirements: org?.settings?.custom_framework_requirements || {},
    });
  } catch {
    return Response.json({ custom_requirements: {} });
  }
}

// POST — add a requirement to a custom framework
// Body: { framework_code, domain, code, title, evidence_required }
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { framework_code, domain, code, title, evidence_required } = body;

    if (!framework_code || !title) {
      return Response.json(
        { error: "framework_code and title are required" },
        { status: 400 }
      );
    }

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
    const { data: org } = await (admin as any)
      .from("organizations")
      .select("settings")
      .eq("id", userData.organization_id)
      .single();

    const currentSettings = org?.settings || {};
    const customReqs = currentSettings.custom_framework_requirements || {};
    const fwReqs = customReqs[framework_code] || {};
    const domainName = (domain as string)?.trim() || "General";
    const domainReqs: object[] = fwReqs[domainName] || [];

    // Auto-generate a code if not provided
    const reqCode =
      String(code || "").trim() ||
      `REQ-${Date.now().toString(36).toUpperCase()}`;

    const newReq = {
      id: reqCode.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      code: reqCode,
      title: String(title).trim(),
      domain: domainName,
      controls: [],
      evidence: 0,
      evidenceRequired: Number(evidence_required) || 1,
    };

    const updatedSettings = {
      ...currentSettings,
      custom_framework_requirements: {
        ...customReqs,
        [framework_code]: {
          ...fwReqs,
          [domainName]: [...domainReqs, newReq],
        },
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("organizations")
      .update({ settings: updatedSettings })
      .eq("id", userData.organization_id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    void logAudit({ organizationId: userData.organization_id, userId: user.id, action: "requirement.created", entityType: "framework_requirement", entityId: newReq.id, newValues: { framework_code, domain: domainName, code: reqCode, title } });
    return Response.json({ success: true, requirement: newReq });
  } catch {
    return Response.json({ error: "Failed to add requirement" }, { status: 500 });
  }
}
