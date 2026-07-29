-- ================================================================
-- 009 — Gateway Umbrella (UmbrellaPag)
-- ----------------------------------------------------------------
-- API idêntica à da ByNet, muda apenas a URL base:
--   ByNet:    https://api-gateway.techbynet.com/api
--   Umbrella: https://api-gateway.umbrellapag.com/api
-- Selecionável em qualquer um dos dois endpoints (active_gateway
-- e active_gateway_2). Webhooks: /api/webhook/umbrella e /umbrella2
-- ================================================================

INSERT INTO settings (key, value) VALUES
  ('umbrella_api_key', '')
ON CONFLICT (key) DO NOTHING;
