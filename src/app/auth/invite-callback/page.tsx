"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/client";

function InviteCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function accept() {
      const code = searchParams.get("code");
      const token_hash = searchParams.get("token_hash");
      const type = searchParams.get("type") ?? "invite";

      const supabase = createClient(); // browser client — no PKCE verifier cookie issue

      let sessionError: string | null = null;

      // Try token_hash first (direct link from custom email template)
      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as "invite" | "magiclink" | "recovery" | "email" | "signup" | "email_change",
        });
        if (error) sessionError = error.message;
        else sessionError = null;
      }

      // Fall back to code exchange (Supabase default invite redirect)
      if (sessionError !== null || (!token_hash && code)) {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) sessionError = error.message;
          else sessionError = null;
        }
      }

      if (sessionError) {
        console.error("[invite-callback] auth error:", sessionError);
        setErrorMsg(sessionError);
        setStatus("error");
        return;
      }

      // Session is now established — provision user into the invited org
      await fetch("/api/team/accept-invite", { method: "POST" });

      router.replace("/dashboard");
    }

    accept();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <p className="text-xl font-semibold">Invite link issue</p>
          <p className="text-sm text-muted-foreground">{errorMsg || "This invite link may have expired or already been used."}</p>
          <a href="/login" className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-3">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-muted-foreground">Accepting invite…</p>
      </div>
    </div>
  );
}

export default function InviteCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    }>
      <InviteCallbackInner />
    </Suspense>
  );
}
