import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: mappings, error } = await (admin as any)
    .from("risk_control_mappings")
    .select(
      "id, control_id, notes, control_library(id, code, title, control_type, effectiveness_rating, status)"
    )
    .eq("risk_id", id);

  if (error) {
    return Response.json({ controls: [], error: error.message });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = (mappings || []).map((m: any) => ({
    mappingId: m.id,
    controlId: m.control_id,
    notes: m.notes,
    ...(m.control_library || {}),
  }));

  return Response.json({ controls });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id: riskId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { control_id, notes } = await request.json();
  if (!control_id) return Response.json({ error: "control_id required" }, { status: 400 });

  const admin = createAdminClient();

  // Create the mapping (upsert to avoid duplicates)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: mapError } = await (admin as any)
    .from("risk_control_mappings")
    .upsert({ risk_id: riskId, control_id, notes: notes || null }, { onConflict: "risk_id,control_id" });

  if (mapError) {
    return Response.json({ error: mapError.message }, { status: 500 });
  }

  // Recalculate residual score: fetch all linked controls' effectiveness
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allMappings } = await (admin as any)
    .from("risk_control_mappings")
    .select("control_library(effectiveness_rating)")
    .eq("risk_id", riskId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ratings = (allMappings || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => m.control_library?.effectiveness_rating ?? 0)
    .filter((r: number) => r > 0);

  if (ratings.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: risk } = await (admin as any)
      .from("risks")
      .select("inherent_likelihood, inherent_impact")
      .eq("id", riskId)
      .single();

    if (risk) {
      const avgEff = ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length;
      // Max 70% reduction — stronger controls reduce residual more
      const reduction = (avgEff / 5) * 0.7;
      const residualLikelihood = Math.max(1, Math.round(risk.inherent_likelihood * (1 - reduction)));
      const residualImpact = Math.max(1, Math.round(risk.inherent_impact * (1 - reduction)));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("risks")
        .update({
          residual_likelihood: residualLikelihood,
          residual_impact: residualImpact,
          status: "assessed",
        })
        .eq("id", riskId);
    }
  }

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id: riskId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const controlId = searchParams.get("control_id");
  if (!controlId) return Response.json({ error: "control_id required" }, { status: 400 });

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("risk_control_mappings")
    .delete()
    .eq("risk_id", riskId)
    .eq("control_id", controlId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}
