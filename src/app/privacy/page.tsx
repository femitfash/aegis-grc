import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "FastGRC Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            FastGRC
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in →
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="space-y-2 mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground">Effective date: February 26, 2026</p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              FastGRC (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use
              our GRC platform and related services (collectively, the &ldquo;Service&rdquo;).
            </p>
            <p className="mt-3">
              By using the Service, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>

            <h3 className="text-base font-semibold mt-4 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account information:</strong> name, work email address, organization name, password</li>
              <li><strong>Profile data:</strong> job title, role within your organization</li>
              <li><strong>Payment information:</strong> billing address, payment method details (processed securely by Stripe — we do not store card numbers)</li>
              <li><strong>GRC data:</strong> risks, controls, evidence, compliance frameworks, audit logs, vendor records, incident reports, and other compliance content you enter into the platform</li>
              <li><strong>Communications:</strong> messages sent to our support team</li>
            </ul>

            <h3 className="text-base font-semibold mt-4 mb-2">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Usage data:</strong> pages visited, features used, actions taken, timestamps</li>
              <li><strong>Device data:</strong> IP address, browser type and version, operating system</li>
              <li><strong>Cookies and local storage:</strong> session tokens, theme preferences, authentication state</li>
            </ul>

            <h3 className="text-base font-semibold mt-4 mb-2">2.3 Information from Third Parties</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>OAuth providers:</strong> if you sign in with Google or GitHub, we receive your name, email, and profile picture</li>
              <li><strong>Integrations:</strong> when you connect AWS, GitHub, Jira, or Slack, we receive data necessary to provide the integration (e.g., security alerts, issue data)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process transactions and send billing-related communications</li>
              <li>Send transactional emails (account confirmation, password reset, team invitations)</li>
              <li>Respond to support requests</li>
              <li>Send product updates and security notices (you can opt out of marketing emails)</li>
              <li>Detect and prevent fraud, abuse, and security threats</li>
              <li>Comply with legal obligations</li>
              <li>Enforce our Terms of Service</li>
            </ul>
            <p className="mt-3">
              <strong>We do not sell your personal data or Customer Data to third parties.</strong> We do not use your
              GRC content (risks, controls, evidence, etc.) to train AI models.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. AI and Data Processing</h2>
            <p>
              The FastGRC AI copilot sends your queries and relevant context to the Anthropic API to generate
              responses. Data sent to the AI is subject to{" "}
              <a
                href="https://www.anthropic.com/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Anthropic&apos;s Privacy Policy
              </a>
              . We use Anthropic&apos;s API under a commercial agreement that prohibits using our data for model training.
            </p>
            <p className="mt-3">
              If you provide your own AI API key in Settings, your queries are sent directly to the respective AI
              provider under their terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Sharing and Disclosure</h2>
            <p>We share your information only in these circumstances:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Service providers:</strong> Supabase (database and auth), Stripe (payments), Resend (transactional email), Anthropic (AI), Vercel (hosting) — each bound by data processing agreements</li>
              <li><strong>Your organization:</strong> data you enter is visible to other users within your organization account</li>
              <li><strong>Legal requirements:</strong> if required by law, court order, or government authority</li>
              <li><strong>Business transfers:</strong> in connection with a merger, acquisition, or sale of assets, with notice to you</li>
              <li><strong>With your consent:</strong> any other sharing with your explicit permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Security</h2>
            <p>We implement industry-standard security controls, including:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Encryption at rest (AES-256) and in transit (TLS 1.3)</li>
              <li>Row-Level Security (RLS) in the database — your data is isolated from other organizations</li>
              <li>Immutable audit log with cryptographic hash chain for tamper detection</li>
              <li>Role-based access control (RBAC) within organizations</li>
              <li>Multi-factor authentication support</li>
            </ul>
            <p className="mt-3">
              No system is 100% secure. If you believe your account has been compromised, contact us immediately at{" "}
              <a href="mailto:support@fastgrc.ai" className="text-primary hover:underline">
                support@fastgrc.ai
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. GRC content (risks, controls, evidence,
              audit logs) is retained for the duration of your subscription and for 90 days after account closure,
              after which it is permanently deleted. Immutable audit logs may be retained longer to satisfy legal
              or regulatory requirements.
            </p>
            <p className="mt-3">
              You may request a full data export at any time from Settings → Organization.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies</h2>
            <p>We use the following cookies and local storage:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Authentication cookies:</strong> set by Supabase to maintain your session (strictly necessary)</li>
              <li><strong>Preference storage:</strong> theme setting (light/dark) stored in browser localStorage (strictly necessary)</li>
            </ul>
            <p className="mt-3">
              We do not use advertising cookies or track you across third-party websites.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Your Rights</h2>
            <p>Depending on your location, you may have rights including:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Access:</strong> request a copy of your personal data</li>
              <li><strong>Correction:</strong> update inaccurate or incomplete data</li>
              <li><strong>Deletion:</strong> request deletion of your personal data (subject to legal retention requirements)</li>
              <li><strong>Portability:</strong> receive your data in a machine-readable format</li>
              <li><strong>Objection:</strong> object to processing based on legitimate interests</li>
              <li><strong>Restriction:</strong> request restriction of processing in certain circumstances</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:support@fastgrc.ai" className="text-primary hover:underline">
                support@fastgrc.ai
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. International Data Transfers</h2>
            <p>
              FastGRC is based in the United States. If you access the Service from outside the US, your data may be
              transferred to and processed in the US. We use Standard Contractual Clauses (SCCs) and other appropriate
              safeguards for transfers from the European Economic Area (EEA), UK, and Switzerland.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed to individuals under 18 years of age. We do not knowingly collect personal
              information from children. If we become aware that a child under 18 has provided personal data, we will
              delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes via email
              or in-app notice before they take effect. The &ldquo;Effective date&rdquo; at the top reflects the latest revision.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Contact Us</h2>
            <p>
              If you have questions or concerns about this Privacy Policy or our data practices, contact us at:
            </p>
            <div className="mt-3 p-4 rounded-lg border bg-muted/30">
              <p className="font-semibold">FastGRC, Inc.</p>
              <p>
                Email:{" "}
                <a href="mailto:support@fastgrc.ai" className="text-primary hover:underline">
                  support@fastgrc.ai
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-16">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground space-x-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <span>·</span>
          <a href="mailto:support@fastgrc.ai" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </footer>
    </div>
  );
}
