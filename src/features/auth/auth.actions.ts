"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/shared/lib/supabase/server";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.schema";
import type { AuthResult } from "@/types/auth.types";

/**
 * Get the base URL for auth redirects.
 * Priority: origin header → host headers → NEXT_PUBLIC_APP_URL → localhost
 */
async function getBaseUrl(): Promise<string> {
  const headerStore = await headers();

  // Most reliable: the Origin header sent by browsers on same-origin requests
  const origin = headerStore.get("origin");
  if (origin) return origin;

  // Fallback: reconstruct from Host / X-Forwarded-Host (works on Vercel, nginx, etc.)
  const host =
    headerStore.get("x-forwarded-host") || headerStore.get("host");
  if (host) {
    const proto = headerStore.get("x-forwarded-proto") || "https";
    return `${proto}://${host}`;
  }

  // Last resort: explicit env var (must be set to production URL in Vercel dashboard)
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Translate Supabase auth error codes into user-friendly messages.
 */
function getAuthErrorMessage(error: { message: string; code?: string }): string {
  const message = error.message.toLowerCase();
  const code = (error.code ?? "").toLowerCase();

  // Supabase returns "email_not_confirmed" code or "Email not confirmed" message
  // depending on version — check both
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Please verify your email address before signing in. Check your inbox for a confirmation link.";
  }
  if (message.includes("invalid login credentials") || code === "invalid_credentials") {
    return "Invalid email or password. Please check your credentials and try again.";
  }
  if (message.includes("user already registered")) {
    return "An account with this email already exists. Please sign in or use a different email.";
  }
  if (message.includes("too many requests") || message.includes("rate limit")) {
    return "Too many attempts. Please wait a moment before trying again.";
  }
  if (message.includes("weak password") || message.includes("password")) {
    return "Password does not meet security requirements. Please use a stronger password.";
  }
  if (message.includes("email") && (message.includes("invalid") || message.includes("not found") || message.includes("format"))) {
    return "Please enter a valid email address.";
  }
  if (code === "otp_expired" || message.includes("token has expired") || message.includes("otp expired")) {
    return "Your code has expired. Please request a new one.";
  }
  if (code === "otp_disabled") {
    return "Email codes are not enabled. Please sign in with your password.";
  }
  if (
    message.includes("invalid") &&
    (message.includes("token") || message.includes("otp") || message.includes("code"))
  ) {
    return "Invalid code. Please check and try again, or request a new code.";
  }
  if (
    message.includes("smtp") ||
    message.includes("sending email") ||
    message.includes("send email") ||
    message.includes("confirmation email") ||
    message.includes("recovery email") ||
    message.includes("email could not be sent") ||
    message.includes("email service") ||
    code === "unexpected_failure"
  ) {
    return "We're having trouble sending emails right now. Please try again shortly or contact support@fastgrc.ai.";
  }

  // Log unrecognised errors so we can add them above
  console.error("[getAuthErrorMessage] unhandled Supabase error:", JSON.stringify(error));
  return "An unexpected error occurred. Please try again.";
}

/**
 * Server action: Sign in with email and password.
 */
export async function signInWithPassword(
  formData: FormData
): Promise<AuthResult> {
  const rawData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  // Validate input
  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        message: parsed.error.errors[0].message,
        code: "VALIDATION_ERROR",
      },
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getAuthErrorMessage(error),
        code: error.code,
      },
    };
  }

  redirect("/dashboard");
}

/**
 * Server action: Sign up with email, password, and profile data.
 */
export async function signUp(formData: FormData): Promise<AuthResult> {
  const rawData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
    fullName: formData.get("fullName") as string,
    organizationName: (formData.get("organizationName") as string) || undefined,
  };

  // Validate input
  const parsed = registerSchema.safeParse(rawData);
  if (!parsed.success) {
    // Prefer field-level errors over cross-field refinement errors (code "custom")
    // so "Full name is required" shows before "Passwords do not match"
    const firstError =
      parsed.error.errors.find((e) => e.code !== "custom") ??
      parsed.error.errors[0];
    return {
      success: false,
      error: {
        message: firstError.message,
        code: "VALIDATION_ERROR",
      },
    };
  }

  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        organization_name: parsed.data.organizationName,
      },
      emailRedirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) {
    console.error("[signUp] Supabase error:", JSON.stringify({ message: error.message, code: error.code, status: error.status }));
    return {
      success: false,
      error: {
        message: getAuthErrorMessage(error),
        code: error.code,
      },
    };
  }

  return {
    success: true,
    redirectTo: "/login?message=check-email",
  };
}

/**
 * Server action: Send password reset email.
 */
export async function resetPasswordRequest(
  formData: FormData
): Promise<AuthResult> {
  const rawData = {
    email: formData.get("email") as string,
  };

  const parsed = forgotPasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        message: parsed.error.errors[0].message,
        code: "VALIDATION_ERROR",
      },
    };
  }

  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${baseUrl}/auth/callback?next=/reset-password`,
    }
  );

  // Always return success regardless of Supabase errors.
  // This prevents email enumeration attacks and avoids surfacing
  // redirect-URL whitelist errors to the user when the email still sends.
  if (error) {
    console.error("[resetPasswordRequest]", error.message);
  }

  return {
    success: true,
    redirectTo: "/login?message=reset-link-sent",
  };
}

/**
 * Server action: Update password (after reset link clicked).
 */
export async function updatePassword(
  formData: FormData
): Promise<AuthResult> {
  const rawData = {
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = resetPasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        message: parsed.error.errors[0].message,
        code: "VALIDATION_ERROR",
      },
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getAuthErrorMessage(error),
        code: error.code,
      },
    };
  }

  redirect("/dashboard");
}

/**
 * Server action: Sign in with OAuth provider.
 */
export async function signInWithOAuth(
  formData: FormData
): Promise<AuthResult> {
  const provider = formData.get("provider") as string;

  if (!["google", "github", "azure"].includes(provider)) {
    return {
      success: false,
      error: {
        message: "Unsupported authentication provider.",
        code: "INVALID_PROVIDER",
      },
    };
  }

  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as "google" | "github" | "azure",
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) {
    return {
      success: false,
      error: {
        message: getAuthErrorMessage(error),
        code: error.code,
      },
    };
  }

  if (data.url) {
    redirect(data.url);
  }

  return {
    success: false,
    error: {
      message: "Failed to initiate OAuth sign-in.",
      code: "OAUTH_ERROR",
    },
  };
}

/**
 * Server action: Send a one-time passcode to the user's email.
 * Uses shouldCreateUser: false so it only works for existing accounts.
 */
export async function signInWithOtp(formData: FormData): Promise<AuthResult> {
  const email = (formData.get("email") as string)?.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      error: { message: "Please enter a valid email address.", code: "VALIDATION_ERROR" },
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    console.error("[signInWithOtp]", JSON.stringify({ message: error.message, code: error.code }));
    return {
      success: false,
      error: { message: getAuthErrorMessage(error), code: error.code },
    };
  }

  // Always return success to prevent email enumeration
  return { success: true };
}

/**
 * Server action: Verify a one-time passcode and sign the user in.
 */
export async function verifyOtp(formData: FormData): Promise<AuthResult> {
  const email = (formData.get("email") as string)?.trim();
  const token = (formData.get("token") as string)?.trim().replace(/\s/g, "");

  if (!email || !token) {
    return {
      success: false,
      error: { message: "Email and code are required.", code: "VALIDATION_ERROR" },
    };
  }

  if (!/^\d{6}$/.test(token)) {
    return {
      success: false,
      error: { message: "Please enter the 6-digit code from your email.", code: "VALIDATION_ERROR" },
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error) {
    console.error("[verifyOtp]", JSON.stringify({ message: error.message, code: error.code }));
    return {
      success: false,
      error: { message: getAuthErrorMessage(error), code: error.code },
    };
  }

  redirect("/dashboard");
}

/**
 * Server action: Sign out.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
