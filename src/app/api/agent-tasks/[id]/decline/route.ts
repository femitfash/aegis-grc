import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { logAudit } from "@/shared/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data: userData } = await admin
      .from("users")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) return Response.json({ error: "No organization" }, { status: 400 });
    if (!["owner", "admin"].includes(userData.role ?? "")) {
      return Response.json({ error: "Only owners and admins can decline agent tasks" }, { status: 403 });
    }

    const { data: task } = await admin
      .from("agent_tasks")
      .select("id, status, skill_used, organization_id")
      .eq("id", id)
      .eq("organization_id", userData.organization_id)
      .single();

    if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
    if (task.status !== "pending_approval") {
      return Response.json({ error: "Task is not pending approval" }, { status: 400 });
    }

    await admin
      .from("agent_tasks")
      .update({
        status: "declined",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    void logAudit({
      organizationId: userData.organization_id,
      userId: user.id,
      action: "agent_task.declined",
      entityType: "agent_task",
      entityId: id,
      newValues: { skill: task.skill_used, status: "declined" },
    });

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
