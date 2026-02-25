import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata = {
  title: "Sign In - FastGRC",
  description: "Sign in to your FastGRC account",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="text-center space-y-2">
        <div className="h-8 bg-muted rounded w-48 mx-auto" />
        <div className="h-4 bg-muted rounded w-64 mx-auto" />
      </div>
      <div className="space-y-4">
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
      </div>
    </div>
  );
}
