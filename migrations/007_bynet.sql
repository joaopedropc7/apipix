-- ================================================================
-- Migration 007 — Adiciona credencial ByNet
-- Execute no Supabase: Dashboard → SQL Editor → New query → Run
-- ================================================================

INSERT INTO settings (key, value) VALUES ('bynet_api_key', '')
ON CONFLICT (key) DO NOTHING;
