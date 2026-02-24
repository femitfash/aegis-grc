import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aegisgrc.com";

// Safe URL factory — avoids Turbopack "module factory" crash if env var is malformed
function toURL(href: string): URL {
  try {
    return new URL(href);
  } catch {
    return new URL("https://aegisgrc.com");
  }
}

export const metadata: Metadata = {
  metadataBase: toURL(siteUrl),
  title: {
    default: "Aegis GRC — AI-Powered Compliance Platform",
    template: "%s | Aegis GRC",
  },
  description:
    "The copilot-first GRC platform. Manage SOC 2, ISO 27001, NIST CSF, and HIPAA compliance through conversation — not forms. Zero setup, AI-powered risk management, 15-minute time to value.",
  keywords: [
    "GRC platform",
    "AI compliance software",
    "SOC 2 automation",
    "ISO 27001 tool",
    "NIST CSF compliance",
    "HIPAA compliance software",
    "risk management AI",
    "copilot compliance",
    "security compliance platform",
    "compliance management software",
    "AI GRC tool",
    "governance risk compliance",
    "SOC 2 readiness",
    "compliance copilot",
    "automated compliance",
    "Vanta alternative",
    "Drata alternative",
  ],
  authors: [{ name: "Aegis GRC", url: siteUrl }],
  creator: "Aegis GRC",
  publisher: "Aegis GRC",
  category: "Technology",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Aegis GRC",
    title: "Aegis GRC — AI-Powered Compliance Platform",
    description:
      "Manage SOC 2, ISO 27001, NIST, and HIPAA compliance through conversation — not 50-field forms. The AI-native GRC platform with 15-minute setup.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Aegis GRC - Copilot-first compliance platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis GRC — AI-Powered Compliance Platform",
    description:
      "Manage compliance through conversation, not forms. SOC 2, ISO 27001, NIST, HIPAA. Free tier. 15-minute setup.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Defined inside the component so it's not evaluated at module instantiation time
  const schemaOrg = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Aegis GRC",
    url: siteUrl,
    description:
      "AI-powered Governance, Risk, and Compliance (GRC) platform. Manage SOC 2, ISO 27001, NIST CSF, and HIPAA compliance through conversational AI. Zero-field risk entry, immutable audit trail, and 15-minute setup.",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free tier with 10 AI actions. Unlimited via bring-your-own Anthropic API key.",
    },
    featureList: [
      "AI Copilot for risk management",
      "SOC 2 Type II compliance tracking",
      "ISO 27001:2022 framework",
      "NIST CSF 2.0 framework",
      "HIPAA compliance management",
      "Zero-field risk entry via natural language",
      "Immutable audit trail with cryptographic hash chain",
      "Custom compliance frameworks",
      "Bring your own Anthropic API key",
      "Multi-framework compliance dashboard",
    ],
    softwareHelp: {
      "@type": "CreativeWork",
      name: "Aegis GRC Documentation",
    },
    screenshot: `${siteUrl}/og-image.png`,
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking script: apply saved theme before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('aegis-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(t!=='light'&&d)){document.documentElement.classList.add('dark')}})()`,
          }}
        />
        {/* Schema.org structured data for LLM and search engine understanding */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
      </head>
      <body
        className={inter.className}
        suppressHydrationWarning
        data-gramm="false"
        data-gramm_editor="false"
        data-lt-installed="false"
      >
        {children}
      </body>
    </html>
  );
}
