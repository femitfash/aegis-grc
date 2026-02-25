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
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData.user) {
      // If this is an invite callback, provision the user into the invited org
      if (type === "invite") {
        const meta = sessionData.user.user_metadata ?? {};
        const orgId: string | undefined = meta.invited_org_id;
        const role: string = meta.invited_role ?? "viewer";

        if (orgId) {
          const admin = createAdminClient();

          // Upsert user record — may already exist if they had an account
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any).from("users").upsert(
            {
              id: sessionData.user.id,
              organization_id: orgId,
              email: sessionData.user.email ?? "",
              full_name: meta.full_name ?? meta.name ?? null,
              role,
            },
            { onConflict: "id" }
          );

          // Mark invite as accepted
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any)
            .from("invites")
            .update({ accepted_at: new Date().toISOString() })
            .eq("organization_id", orgId)
            .eq("email", (sessionData.user.email ?? "").toLowerCase());
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?message=auth-code-error`);
}
