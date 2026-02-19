-- D1 Migration: 0008_api_keys_user
-- Adds user_id + key_prefix columns to api_keys table.
-- These are required by the auth handler but were missing from 0002.

ALTER TABLE api_keys ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE api_keys ADD COLUMN key_prefix TEXT;

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
