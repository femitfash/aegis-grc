import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

/**
 * Auth callback handler for Supabase.
 *
 * Handles:
 * 1. OAuth provider redirects (Google, GitHub, Azure)
 * 2. Email confirmation links
 * 3. Password reset links
 * 4. Invite accept links (?type=invite) — provisions user into the invited org
 */
/** Provision an invited user into their org and mark the invite accepted. */
async function provisionInvitedUser(
  userId: string,
  email: string,
  meta: Record<string, string>
) {
  const orgId: string | undefined = meta.invited_org_id;
  const role: string = meta.invited_role ?? "viewer";
  if (!orgId) return;

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("users").upsert(
    {
      id: userId,
      organization_id: orgId,
      email,
      full_name: meta.full_name ?? meta.name ?? null,
      role,
    },
    { onConflict: "id" }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("email", email.toLowerCase());
}

function buildRedirect(origin: string, forwardedHost: string | null, path: string) {
  // Production: always redirect to the canonical URL to avoid www vs non-www
  // mismatches that cause "site cannot be reached" errors.
  const canonical = process.env.NEXT_PUBLIC_APP_URL;
  if (canonical && !canonical.includes("localhost")) {
    return `${canonical}${path}`;
  }

  // Development: derive from request headers so localhost works automatically.
  const isLocal = process.env.NODE_ENV === "development";
  if (isLocal || !forwardedHost) return `${origin}${path}`;
  return `https://${forwardedHost}${path}`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";
  const forwardedHost = request.headers.get("x-forwarded-host");

  const supabase = await createClient();

  // ── token_hash flow (Supabase invite & magic-link emails) ──────────────────
  // Supabase invite emails include token_hash + type=invite (not a PKCE code).
  if (token_hash && type) {
    const { data: sessionData, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "invite" | "magiclink" | "recovery" | "email" | "signup" | "email_change",
    });

    if (!error && sessionData.user) {
      if (type === "invite") {
        const meta = sessionData.user.user_metadata ?? {};
        await provisionInvitedUser(
          sessionData.user.id,
          sessionData.user.email ?? "",
          meta as Record<string, string>
        );
      }
      return NextResponse.redirect(buildRedirect(origin, forwardedHost, next));
    }
  }

  // ── PKCE code flow (OAuth, email confirm, OTP sign-in) ────────────────────
  if (code) {
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData.user) {
      if (type === "invite") {
        const meta = sessionData.user.user_metadata ?? {};
        await provisionInvitedUser(
          sessionData.user.id,
          sessionData.user.email ?? "",
          meta as Record<string, string>
        );
      }
      return NextResponse.redirect(buildRedirect(origin, forwardedHost, next));
    }
  }

  return NextResponse.redirect(`${origin}/login?message=auth-code-error`);
}
