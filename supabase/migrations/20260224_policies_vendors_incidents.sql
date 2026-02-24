-- ============================================================
-- Migration: Add policies, vendors, and incidents tables
-- Run this in your Supabase SQL Editor or via CLI:
--   supabase db push  OR  paste into Supabase > SQL Editor
-- ============================================================

-- ─── POLICIES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS policies (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  policy_id        TEXT        NOT NULL,   -- human-readable: POL-XXXXX
  title            TEXT        NOT NULL,
  description      TEXT        NOT NULL DEFAULT '',
  category         TEXT        NOT NULL DEFAULT 'General',
  owner_id         UUID        REFERENCES users(id),
  status           TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','active','archived')),
  version          TEXT        NOT NULL DEFAULT '1.0',
  effective_date   DATE,
  review_date      DATE,
  attestation_required BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY policies_org_isolation ON policies
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_policies_org ON policies(organization_id);

-- ─── VENDORS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  category         TEXT        NOT NULL DEFAULT 'Technology',
  tier             TEXT        NOT NULL DEFAULT 'medium'
                               CHECK (tier IN ('critical','high','medium','low')),
  status           TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','under_review','approved','suspended')),
  contact_name     TEXT        NOT NULL DEFAULT '',
  contact_email    TEXT        NOT NULL DEFAULT '',
  website          TEXT        NOT NULL DEFAULT '',
  contract_expiry  DATE,
  risk_score       INTEGER     NOT NULL DEFAULT 5 CHECK (risk_score BETWEEN 1 AND 25),
  last_assessed_at TIMESTAMPTZ,
  notes            TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendors_org_isolation ON vendors
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_vendors_org ON vendors(organization_id);

-- ─── INCIDENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id      TEXT        NOT NULL,   -- human-readable: INC-XXXXX
  title            TEXT        NOT NULL,
  description      TEXT        NOT NULL DEFAULT '',
  severity         TEXT        NOT NULL DEFAULT 'medium'
                               CHECK (severity IN ('critical','high','medium','low')),
  status           TEXT        NOT NULL DEFAULT 'detected'
                               CHECK (status IN ('detected','contained','resolved','post_mortem','closed')),
  discovered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  contained_at     TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  impact           TEXT        NOT NULL DEFAULT '',
  affected_systems TEXT        NOT NULL DEFAULT '',
  root_cause       TEXT        NOT NULL DEFAULT '',
  owner_id         UUID        REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY incidents_org_isolation ON incidents
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_incidents_org ON incidents(organization_id);
