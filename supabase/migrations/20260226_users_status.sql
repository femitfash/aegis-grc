-- Add status column to users table for suspend/active tracking
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Allowed values: active | suspended
