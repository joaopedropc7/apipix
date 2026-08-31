-- ================================================================
-- 012 — Gateway Axxon Pay
-- ----------------------------------------------------------------
-- Terceiro gateway disponível em qualquer um dos dois endpoints.
-- Autentica com DUAS chaves no header (publickey + secretkey):
--   POST https://api.axxonpay.com.br/api/v1/direct/payment
--     axxon-gateway-publickey: <public>
--     axxon-gateway-secretkey: <secret>
--
-- Credenciais próprias por endpoint:
--   Endpoint 1: axxon_public_key   / axxon_secret_key
--   Endpoint 2: axxon_public_key_2 / axxon_secret_key_2
-- Webhooks: /api/webhook/axxon e /api/webhook/axxon2
-- ================================================================

INSERT INTO settings (key, value) VALUES
  ('axxon_public_key',    ''),
  ('axxon_secret_key',    ''),
  ('axxon_public_key_2',  ''),
  ('axxon_secret_key_2',  '')
ON CONFLICT (key) DO NOTHING;
