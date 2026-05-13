-- ================================================================
-- Migration 003 — Chave de deduplicação para evitar PIX duplicados
-- Execute no Supabase: Dashboard → SQL Editor → New query → Run
-- ================================================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dedup_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_dedup_key
  ON transactions(dedup_key)
  WHERE dedup_key IS NOT NULL;
