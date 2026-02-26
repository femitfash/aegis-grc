import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "FastGRC Terms of Service — read our usage terms and conditions.",
};

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground">Effective date: February 26, 2026</p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using FastGRC (&ldquo;Service&rdquo;), you agree to be bound by these Terms of Service
              (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not use the Service. FastGRC is operated by
              FastGRC, Inc. (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p>
              FastGRC is a cloud-based Governance, Risk, and Compliance (GRC) platform that uses artificial intelligence
              to help organizations manage compliance programs, risk registers, security controls, and audit evidence.
              The Service includes a conversational AI copilot, dashboard, reporting tools, and integrations with
              third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Account Registration</h2>
            <p>
              You must create an account to access most features of the Service. You agree to provide accurate,
              current, and complete information during registration and to keep your account information updated.
              You are responsible for maintaining the confidentiality of your login credentials and for all activities
              that occur under your account.
            </p>
            <p className="mt-3">
              You must be at least 18 years old and authorized to bind your organization to these Terms if registering
              on behalf of a company.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Subscription Plans and Billing</h2>
            <p>
              FastGRC offers a free tier and paid subscription plans. Paid plans are billed in advance on a monthly
              or annual basis. By providing a payment method, you authorize us to charge the applicable fees.
              All fees are non-refundable except as required by law or as expressly stated in these Terms.
            </p>
            <p className="mt-3">
              We reserve the right to change pricing with 30 days&apos; notice. Continued use of the Service after
              a price change constitutes acceptance of the new pricing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Use the Service for any unlawful purpose or in violation of any regulations</li>
              <li>Attempt to gain unauthorized access to any part of the Service or other user accounts</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Upload or transmit malicious code, viruses, or any other harmful software</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Resell or sublicense access to the Service without our written consent</li>
              <li>Use the AI copilot to generate misleading compliance reports intended to deceive auditors</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your Data and Intellectual Property</h2>
            <p>
              You retain all rights to the data, content, and materials you upload to the Service (&ldquo;Customer Data&rdquo;).
              By using the Service, you grant us a limited license to process your Customer Data solely to provide
              and improve the Service.
            </p>
            <p className="mt-3">
              We do not use your Customer Data to train AI models without your explicit consent. FastGRC retains
              ownership of the Service, its underlying technology, and any improvements or derivative works.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. AI-Generated Content Disclaimer</h2>
            <p>
              The AI copilot provides suggestions and generates content to assist your compliance program. AI-generated
              content is provided for informational purposes only and does not constitute legal, regulatory, or
              professional compliance advice. You are solely responsible for reviewing, validating, and acting on
              any AI-generated output. FastGRC is not liable for any compliance failures resulting from reliance on
              AI-generated content without independent review.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Confidentiality</h2>
            <p>
              We treat your Customer Data as confidential. We implement industry-standard security measures including
              encryption at rest and in transit, role-based access controls, and immutable audit logs. For more
              details, see our{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Third-Party Integrations</h2>
            <p>
              The Service may integrate with third-party platforms (AWS, GitHub, Jira, Slack, Stripe, etc.).
              Your use of third-party services is governed by their respective terms and privacy policies.
              We are not responsible for the availability, accuracy, or security of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, FastGRC shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including loss of profits, data, business,
              or goodwill, even if we have been advised of the possibility of such damages.
            </p>
            <p className="mt-3">
              Our total liability to you for any claims arising from or related to these Terms or the Service shall
              not exceed the amounts you paid to FastGRC in the twelve (12) months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Warranty Disclaimer</h2>
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND,
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
              ERROR-FREE, OR THAT COMPLIANCE GOALS WILL BE ACHIEVED.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Termination</h2>
            <p>
              You may cancel your account at any time from Settings → Billing. We may suspend or terminate your
              access if you breach these Terms, with or without notice. Upon termination, you may request a data
              export within 30 days; after that, your data may be deleted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes via email or
              in-app notice at least 14 days before changes take effect. Continued use of the Service after changes
              constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Delaware, United States, without regard to
              conflict of law principles. Any disputes shall be resolved through binding arbitration under the
              rules of the American Arbitration Association, except that either party may seek injunctive relief
              in a court of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a href="mailto:support@fastgrc.ai" className="text-primary hover:underline">
                support@fastgrc.ai
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-16">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground space-x-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <span>·</span>
          <a href="mailto:support@fastgrc.ai" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </footer>
    </div>
  );
}
