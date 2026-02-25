"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signInWithPassword, signInWithOAuth } from "../auth.actions";
import { AuthAlert } from "./AuthAlert";
import { OAuthButtons } from "./OAuthButtons";
import { PasswordInput } from "./PasswordInput";

const INFO_MESSAGES: Record<string, string> = {
  "check-email":
    "Registration successful! Please check your email for a confirmation link.",
  "reset-link-sent":
    "Password reset link sent! Check your email to reset your password.",
  "password-updated":
    "Your password has been updated. You can now sign in with your new password.",
};

const ERROR_MESSAGES: Record<string, string> = {
  "auth-code-error":
    "Authentication failed. Please try signing in again.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const infoMessage = message ? INFO_MESSAGES[message] : null;
  const urlError = message ? ERROR_MESSAGES[message] : null;

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsLoading(true);

    try {
      const result = await signInWithPassword(formData);
      // If we get here (no redirect), there was an error
      if (!result.success && result.error) {
        setError(result.error.message);
      }
    } catch (err) {
      // redirect() from server actions throws NEXT_REDIRECT - this is expected
      // Only set error for actual errors
      if (
        err instanceof Error &&
        !err.message.includes("NEXT_REDIRECT")
      ) {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your FastGRC account
        </p>
      </div>

      {/* Info message from redirects */}
      {infoMessage && <AuthAlert type="info" message={infoMessage} />}

      {/* URL error message (e.g., from failed auth callback) */}
      {urlError && <AuthAlert type="error" message={urlError} />}

      {/* Error message from form submission */}
      {error && <AuthAlert type="error" message={error} />}

      {/* OAuth Providers */}
      <OAuthButtons action={signInWithOAuth} isLoading={isLoading} />

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      {/* Email/Password form */}
      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="text-sm font-medium leading-none"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium leading-none"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
              tabIndex={-1}
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center w-full h-10 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner />
              Signing in...
            </span>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      {/* Register link */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
