import Stripe from "stripe";

// Stripe is optional — routes return 503 when keys are absent so the app
// works in development before billing is configured.
export const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-01-28.clover" })
  : null;

// Per-seat price IDs — set these in Vercel env vars after creating products in
// the Stripe dashboard (or via `stripe prices create`).
export const PRICES = {
  contributor_monthly: process.env.STRIPE_PRICE_CONTRIBUTOR_MONTHLY ?? "",
  contributor_annual:  process.env.STRIPE_PRICE_CONTRIBUTOR_ANNUAL  ?? "",
  readonly_monthly:    process.env.STRIPE_PRICE_READONLY_MONTHLY    ?? "",
  readonly_annual:     process.env.STRIPE_PRICE_READONLY_ANNUAL     ?? "",
} as const;

// Public display pricing (cents)
export const DISPLAY_PRICES = {
  contributor_monthly: 4900,   // $49.00
  contributor_annual:  3900,   // $39.00 /mo billed annually ($468/yr)
  readonly_monthly:     999,   // $9.99
  readonly_annual:      799,   // $7.99 /mo billed annually ($95.88/yr)
} as const;
