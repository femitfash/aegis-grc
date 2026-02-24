import { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

const FREE_LIMIT = 10;

export async function POST(request: NextRequest) {
  try {
    const { toolCallId, name, input } = await request.json();

    // Authenticate via session cookies
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use admin client to bypass RLS for writes — safe because we authenticated above
    const admin = createAdminClient();

    // Get the user's organization_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (admin as any)
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    let organizationId: string | null = userData?.organization_id ?? null;

    // Auto-provision an organization + user record for new users (no org yet)
    if (!organizationId) {
      const orgSlug = `org-${user.id.slice(0, 8)}`;
      const orgName = user.email?.split("@")[0] ?? "My Organization";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newOrg } = await (admin as any)
        .from("organizations")
        .insert({ name: orgName, slug: orgSlug, subscription_tier: "starter" })
        .select("id")
        .single();

      if (newOrg?.id) {
        organizationId = newOrg.id as string;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("users")
          .upsert({
            id: user.id,
            organization_id: organizationId,
            email: user.email,
            full_name: user.user_metadata?.full_name ?? user.email,
            role: "admin",
          });
      }
    }

    // Fetch org settings for usage check and custom API key
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orgData } = await (admin as any)
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orgSettings: Record<string, any> = orgData?.settings || {};
    const writeCount: number = orgSettings.copilot_write_count || 0;
    const hasCustomKey = Boolean(orgSettings.anthropic_api_key);

    // Enforce free tier limit unless org has their own API key
    if (writeCount >= FREE_LIMIT && !hasCustomKey) {
      return Response.json(
        {
          error: "free_limit_reached",
          message: `You've used all ${FREE_LIMIT} free AI actions. Add your Anthropic API key in Settings → AI Copilot to unlock unlimited usage.`,
          write_count: writeCount,
          limit: FREE_LIMIT,
        },
        { status: 402 }
      );
    }

    // Helper: increment write count in settings (only when using platform key)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function bumpCount(mergedSettings?: Record<string, any>) {
      if (hasCustomKey) return; // unlimited with custom key
      const base = mergedSettings ?? orgSettings;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("organizations")
        .update({ settings: { ...base, copilot_write_count: writeCount + 1 } })
        .eq("id", organizationId);
    }

    switch (name) {
      case "create_risk": {
        const likelihood = Number(input.inherent_likelihood) || 3;
        const impact = Number(input.inherent_impact) || 3;
        const riskId = `RISK-${Date.now().toString(36).toUpperCase()}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (admin as any)
          .from("risks")
          .insert({
            organization_id: organizationId,
            risk_id: riskId,
            title: input.title || "Untitled Risk",
            description: input.description || "",
            inherent_likelihood: likelihood,
            inherent_impact: impact,
            // inherent_score is a generated column (likelihood * impact) — do not insert
            risk_response: input.risk_response || "mitigate",
            status: "identified",
            owner_id: user.id,
          })
          .select()
          .single();

        if (error) {
          console.error("Create risk DB error:", JSON.stringify(error));
          return Response.json(
            { error: "Failed to create risk", detail: error.message },
            { status: 500 }
          );
        }

        await bumpCount();
        return Response.json({ success: true, result: data, toolCallId });
      }

      case "create_control": {
        const controlCode =
          String(input.code || "").trim() ||
          `CTRL-${Date.now().toString(36).toUpperCase()}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (admin as any)
          .from("control_library")
          .insert({
            organization_id: organizationId,
            code: controlCode,
            title: input.title || "Untitled Control",
            description: input.description || "",
            control_type: input.control_type || "technical",
            automation_level: input.automation_level || "manual",
            effectiveness_rating: Number(input.effectiveness_rating) || 3,
            status: "draft",
            metadata: { frameworks: Array.isArray(input.frameworks) ? input.frameworks : [] },
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

        await bumpCount();
        return Response.json({ success: true, result: data, toolCallId });
      }

      case "update_requirement_status": {
        const key = `${input.framework_code}::${input.requirement_code}`;
        const newStatus = input.status as string;
        const currentStatuses = orgSettings.requirement_statuses || {};
        const newSettings = {
          ...orgSettings,
          requirement_statuses: { ...currentStatuses, [key]: newStatus },
          // Fold counter increment into this update to avoid two writes
          copilot_write_count: hasCustomKey ? writeCount : writeCount + 1,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (admin as any)
          .from("organizations")
          .update({ settings: newSettings })
          .eq("id", organizationId);

        if (error) {
          return Response.json(
            { error: "Failed to update requirement status", detail: error.message },
            { status: 500 }
          );
        }

        return Response.json({ success: true, toolCallId });
      }

      case "create_requirement": {
        const frameworkCode = String(input.framework_code || "").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
        const domainName = String(input.domain || "General").trim();
        const reqCode =
          String(input.code || "").trim() ||
          `REQ-${Date.now().toString(36).toUpperCase()}`;

        const customReqs = orgSettings.custom_framework_requirements || {};
        const fwReqs = customReqs[frameworkCode] || {};
        const domainReqs: object[] = fwReqs[domainName] || [];

        const newReq = {
          id: reqCode.toLowerCase().replace(/[^a-z0-9]/g, "-"),
          code: reqCode,
          title: String(input.title || "Untitled Requirement").trim(),
          domain: domainName,
          controls: [],
          evidence: 0,
          evidenceRequired: Number(input.evidence_required) || 1,
        };

        // Fold counter increment into this update to avoid two writes
        const updatedSettings = {
          ...orgSettings,
          custom_framework_requirements: {
            ...customReqs,
            [frameworkCode]: { ...fwReqs, [domainName]: [...domainReqs, newReq] },
          },
          copilot_write_count: hasCustomKey ? writeCount : writeCount + 1,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: reqError } = await (admin as any)
          .from("organizations")
          .update({ settings: updatedSettings })
          .eq("id", organizationId);

        if (reqError) {
          return Response.json(
            { error: "Failed to create requirement", detail: reqError.message },
            { status: 500 }
          );
        }

        return Response.json({ success: true, result: newReq, toolCallId });
      }

      case "create_framework": {
        const frameworkCode = String(input.code || "").toUpperCase().replace(/[^A-Z0-9_]/g, "_");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (admin as any)
          .from("compliance_frameworks")
          .insert({
            code: frameworkCode,
            name: input.name || "Unnamed Framework",
            version: input.version || "1.0",
            description: input.description || "",
            structure: {},
            is_active: true,
          })
          .select()
          .single();

        if (error) {
          console.error("Create framework DB error:", JSON.stringify(error));
          return Response.json(
            { error: "Failed to create framework", detail: error.message },
            { status: 500 }
          );
        }

        await bumpCount();
        return Response.json({ success: true, result: data, toolCallId });
      }

      case "link_risk_to_control": {
        // Resolve risk: find by risk_id (human-readable) or UUID
        const riskQuery = String(input.risk_id || "").trim();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let riskRow: any = null;
        if (riskQuery) {
          // Try by human-readable risk_id first, then UUID
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: byRiskId } = await (admin as any)
            .from("risks")
            .select("id")
            .eq("organization_id", organizationId)
            .ilike("risk_id", riskQuery)
            .single();
          riskRow = byRiskId;
          if (!riskRow) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: byUuid } = await (admin as any)
              .from("risks")
              .select("id")
              .eq("id", riskQuery)
              .single();
            riskRow = byUuid;
          }
        }
        if (!riskRow) {
          return Response.json({ error: "Risk not found", detail: `No risk matching: ${riskQuery}` }, { status: 404 });
        }

        // Resolve control: find by code or UUID
        const controlQuery = String(input.control_id || "").trim();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let controlRow: any = null;
        if (controlQuery) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: byCode } = await (admin as any)
            .from("control_library")
            .select("id, code, title, effectiveness_rating")
            .eq("organization_id", organizationId)
            .ilike("code", controlQuery)
            .single();
          controlRow = byCode;
          if (!controlRow) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: byUuid } = await (admin as any)
              .from("control_library")
              .select("id, code, title, effectiveness_rating")
              .eq("id", controlQuery)
              .single();
            controlRow = byUuid;
          }
        }
        if (!controlRow) {
          return Response.json({ error: "Control not found", detail: `No control matching: ${controlQuery}` }, { status: 404 });
        }

        // Create the mapping
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: mapError } = await (admin as any)
          .from("risk_control_mappings")
          .upsert(
            { risk_id: riskRow.id, control_id: controlRow.id, notes: input.notes || null },
            { onConflict: "risk_id,control_id" }
          );

        if (mapError) {
          return Response.json({ error: "Failed to link", detail: mapError.message }, { status: 500 });
        }

        // Recalculate residual score
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: allMappings } = await (admin as any)
          .from("risk_control_mappings")
          .select("control_library(effectiveness_rating)")
          .eq("risk_id", riskRow.id);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ratings = (allMappings || []).map((m: any) => m.control_library?.effectiveness_rating ?? 0).filter((r: number) => r > 0);
        if (ratings.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: risk } = await (admin as any)
            .from("risks")
            .select("inherent_likelihood, inherent_impact")
            .eq("id", riskRow.id)
            .single();

          if (risk) {
            const avgEff = ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length;
            const reduction = (avgEff / 5) * 0.7;
            const residualLikelihood = Math.max(1, Math.round(risk.inherent_likelihood * (1 - reduction)));
            const residualImpact = Math.max(1, Math.round(risk.inherent_impact * (1 - reduction)));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (admin as any)
              .from("risks")
              .update({ residual_likelihood: residualLikelihood, residual_impact: residualImpact, status: "assessed" })
              .eq("id", riskRow.id);
          }
        }

        await bumpCount();
        return Response.json({
          success: true,
          result: { risk_id: riskQuery, control: controlRow.code, control_title: controlRow.title },
          toolCallId,
        });
      }

      case "create_evidence": {
        const evidenceId = `EVD-${Date.now().toString(36).toUpperCase()}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (admin as any)
          .from("evidence")
          .insert({
            organization_id: organizationId,
            evidence_id: evidenceId,
            title: input.title || "Untitled Evidence",
            description: input.description || "",
            source_type: input.source_type || "manual",
            // source_url and control_code are not schema columns — store in JSONB fields
            source_metadata: input.source_url ? { source_url: input.source_url } : {},
            metadata: {
              frameworks: Array.isArray(input.frameworks) ? input.frameworks : [],
              control_code: input.control_code || null,
            },
            created_by: user.id,
            collected_at: new Date().toISOString(),
            status: "pending",
          })
          .select()
          .single();

        if (error) {
          console.error("Create evidence DB error:", JSON.stringify(error));
          return Response.json({ error: "Failed to create evidence", detail: error.message }, { status: 500 });
        }

        await bumpCount();
        return Response.json({ success: true, result: data, toolCallId });
      }

      default:
        return Response.json({ error: `Unknown action: ${name}` }, { status: 400 });
    }
  } catch (err) {
    console.error("Execute error:", err);
    return Response.json({ error: "Execution failed" }, { status: 500 });
  }
}
