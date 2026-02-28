import Link from "next/link";
import { BrandLogo } from "@/shared/components/brand-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar with brand */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4">
          <Link href="/" className="flex items-center">
            <BrandLogo className="text-2xl" />
          </Link>
        </div>
      </header>

      {/* Centered auth form */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          FastGRC.ai &mdash; Copilot-first Governance, Risk &amp;
          Compliance
        </div>
      </footer>
    </div>
  );
}
