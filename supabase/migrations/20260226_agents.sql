-- ─────────────────────────────────────────────────────────────────────────────
-- agent_types: reusable blueprints that define what an agent can do
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_types (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text        NOT NULL DEFAULT '',
  skills          jsonb       NOT NULL DEFAULT '[]', -- array of skill IDs from SKILL_CATALOG
  is_default      boolean     NOT NULL DEFAULT false,
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_types_org ON agent_types(organization_id);

ALTER TABLE agent_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_types_org_isolation" ON agent_types
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- agents: scheduled instances of agent_types
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_type_id   uuid        NOT NULL REFERENCES agent_types(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text        NOT NULL DEFAULT '',
  status          text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'suspended', 'deleted')),
  schedule        text        NOT NULL DEFAULT 'manual'
                              CHECK (schedule IN ('manual', 'hourly', 'daily_6am', 'daily_9am', 'weekly_monday')),
  last_run_at     timestamptz,
  next_run_at     timestamptz,
  config          jsonb       NOT NULL DEFAULT '{}', -- e.g. {"search_query": "NIST policies 2026"}
  created_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_org ON agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_status_next_run ON agents(status, next_run_at);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_org_isolation" ON agents
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- agent_tasks: each skill execution creates a task record
-- read skills → status: completed immediately
-- write skills → status: pending_approval until user approves
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_tasks (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id          uuid        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id           text        NOT NULL,               -- TASK-XXXXXX human-readable
  run_id            uuid        NOT NULL,               -- groups all tasks from one agent run
  title             text        NOT NULL,
  description       text        NOT NULL DEFAULT '',
  skill_used        text        NOT NULL,
  action_type       text        NOT NULL CHECK (action_type IN ('read', 'write')),
  status            text        NOT NULL DEFAULT 'completed'
                                CHECK (status IN ('pending_approval', 'approved', 'declined', 'completed', 'failed')),
  result            jsonb,                              -- output: search results, created record, etc.
  error_message     text,
  requires_approval boolean     NOT NULL DEFAULT false,
  approved_by       uuid        REFERENCES users(id) ON DELETE SET NULL,
  approved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_org ON agent_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_run ON agent_tasks(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_tasks_org_isolation" ON agent_tasks
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: create a Default GRC Agent Type for every existing organization
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO agent_types (organization_id, name, description, skills, is_default, is_active)
  SELECT
    id,
    'Default GRC Agent',
    'Built-in agent for compliance monitoring and risk research. Available to all contributors.',
    '["web_search", "risk_analysis", "compliance_check"]'::jsonb,
    true,
    true
  FROM organizations
ON CONFLICT DO NOTHING;
