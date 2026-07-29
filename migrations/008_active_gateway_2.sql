-- ================================================================
-- 008 — Gateway ativo independente para o endpoint 2 (/api/pix2)
-- ----------------------------------------------------------------
-- Antes, /api/pix e /api/pix2 liam a mesma setting `active_gateway`.
-- Agora o endpoint 2 usa `active_gateway_2`, permitindo 2 gateways
-- ativos ao mesmo tempo, cada um com seu token Utmify:
--   /api/pix  → active_gateway   → utmify_token
--   /api/pix2 → active_gateway_2 → utmify_token_2
-- ================================================================

INSERT INTO settings (key, value) VALUES
  ('active_gateway_2', 'suitpay')
ON CONFLICT (key) DO NOTHING;
