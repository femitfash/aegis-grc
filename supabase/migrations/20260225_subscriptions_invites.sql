-- ─────────────────────────────────────────────────────────────────────────────
-- subscriptions: one row per organization, tracks Stripe billing state
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id     text,
  stripe_subscription_id text        UNIQUE,
  plan                   text        NOT NULL DEFAULT 'builder', -- builder | growth | enterprise
  billing_interval       text        NOT NULL DEFAULT 'month',   -- month | year
  status                 text        NOT NULL DEFAULT 'active',  -- active | trialing | past_due | canceled | incomplete
  seats_contributors     integer     NOT NULL DEFAULT 1,
  seats_readonly         integer     NOT NULL DEFAULT 0,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  trial_end              timestamptz,
  cancel_at_period_end   boolean     NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own org's subscription
CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Only service-role (webhook handler) can write
-- Inserts/updates are done by admin client in API routes

-- ─────────────────────────────────────────────────────────────────────────────
-- invites: pending email invitations (7-day expiry)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           text        NOT NULL,
  role            text        NOT NULL DEFAULT 'viewer',
  invited_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  accepted_at     timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_select" ON invites
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Seed every existing org with a builder subscription row so the billing
-- tab always has something to display even before Stripe is connected.
INSERT INTO subscriptions (organization_id, plan, status, seats_contributors)
  SELECT id, 'builder', 'active', 1
  FROM organizations
  ON CONFLICT (organization_id) DO NOTHING;
