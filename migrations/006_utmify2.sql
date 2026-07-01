-- ================================================================
-- Migration 006 — Adiciona token Utmify para o segundo endpoint
-- Execute no Supabase: Dashboard → SQL Editor → New query → Run
-- ================================================================

INSERT INTO settings (key, value) VALUES ('utmify_token_2', '')
ON CONFLICT (key) DO NOTHING;
