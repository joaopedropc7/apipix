-- ================================================================
-- Migration 004 — Integração PayFort + seleção de gateway ativo
-- Execute no Supabase: Dashboard → SQL Editor → New query → Run
-- ================================================================

INSERT INTO settings (key, value) VALUES
  ('payfort_account_id', ''),
  ('payfort_api_key',    ''),
  ('payfort_api_secret', ''),
  ('active_gateway',     'suitpay')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'suitpay';

CREATE INDEX IF NOT EXISTS idx_transactions_gateway ON transactions(gateway);
