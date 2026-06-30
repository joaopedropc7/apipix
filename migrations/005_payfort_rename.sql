-- ================================================================
-- Migration 005 — Corrige nomes dos campos Payfort no settings
-- Execute no Supabase: Dashboard → SQL Editor → New query → Run
-- ================================================================

-- Adiciona os campos com os nomes corretos
INSERT INTO settings (key, value) VALUES
  ('payfort_account_id', ''),
  ('payfort_api_key',    ''),
  ('payfort_api_secret', '')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Remove os campos com nomes antigos (não são mais usados)
DELETE FROM settings WHERE key IN ('payfort_client_id', 'payfort_client_secret');
