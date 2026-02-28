"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { updatePassword } from "../auth.actions";
import { AuthAlert } from "./AuthAlert";
import { PasswordInput } from "./PasswordInput";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const isInvite = searchParams.get("invite") === "1";
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsLoading(true);

    try {
      const result = await updatePassword(formData);
      // If we get here (no redirect), there was an error
      if (!result.success && result.error) {
        setError(result.error.message);
      }
    } catch (err) {
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
        <h1 className="text-2xl font-bold tracking-tight">
          {isInvite ? "Welcome to FastGRC.ai!" : "Set a new password"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isInvite
            ? "Your account is ready. Set a password to complete your setup."
            : "Enter your new password below. Make sure it\u2019s strong and unique."}
        </p>
      </div>

      {/* Error message */}
      {error && <AuthAlert type="error" message={error} />}

      {/* Form */}
      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="password"
            className="text-sm font-medium leading-none"
          >
            New password
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            placeholder="Enter your new password"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Must be at least 8 characters with uppercase, lowercase, number, and
            special character.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium leading-none"
          >
            Confirm new password
          </label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
            placeholder="Confirm your new password"
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
              Updating password...
            </span>
          ) : (
            isInvite ? "Set password & continue" : "Update password"
          )}
        </button>
      </form>

      {/* Back to login */}
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Back to sign in
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
