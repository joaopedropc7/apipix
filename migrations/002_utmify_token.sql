-- ================================================================
-- Migration 002 — Adicionar token Utmify nas configurações
-- Execute no Supabase: Dashboard → SQL Editor → New query → Run
-- ================================================================

INSERT INTO settings (key, value)
VALUES ('utmify_token', '')
ON CONFLICT (key) DO NOTHING;
