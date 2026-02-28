"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

/**
 * Client-side auth hook that provides the current user, session, and sign-out function.
 * Listens to Supabase auth state changes and stays synced.
 */
export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Get the initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);

      // Refresh the page on sign in/out to update server components
      router.refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Even if the Supabase call fails (timeout, network), clear local state
      // and redirect so the user isn't stuck on a broken session.
    }
    router.push("/login");
    router.refresh();
  }, [router]);

  return { user, session, isLoading, signOut };
}
