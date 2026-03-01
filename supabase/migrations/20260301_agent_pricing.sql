-- Add agent-specific subscription fields for agent actions pricing
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS agent_plan text DEFAULT NULL
    CHECK (agent_plan IS NULL OR agent_plan IN ('unlimited')),
  ADD COLUMN IF NOT EXISTS agent_stripe_subscription_id text UNIQUE;
