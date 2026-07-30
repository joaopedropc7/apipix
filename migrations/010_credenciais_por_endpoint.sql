-- ================================================================
-- 010 — Credenciais de gateway independentes por endpoint
-- ----------------------------------------------------------------
-- Cada endpoint passa a ter suas próprias credenciais de ByNet e
-- Umbrella (antes compartilhadas). Assim é possível usar, por ex.,
-- uma conta ByNet no endpoint 1 e outra conta ByNet no endpoint 2.
--
--   Endpoint 1 (/api/pix):  bynet_api_key   / umbrella_api_key
--   Endpoint 2 (/api/pix2): bynet_api_key_2 / umbrella_api_key_2
--
-- SuitPay e PayFort foram removidos da aplicação. As settings antigas
-- (suitpay_*, payfort_*) podem permanecer no banco sem efeito, mas
-- se quiser limpá-las, rode o bloco comentado no final.
-- ================================================================

INSERT INTO settings (key, value) VALUES
  ('bynet_api_key_2',    ''),
  ('umbrella_api_key_2', '')
ON CONFLICT (key) DO NOTHING;

-- Ajusta o gateway padrão (não usa mais 'suitpay')
UPDATE settings SET value = 'bynet' WHERE key IN ('active_gateway', 'active_gateway_2') AND value NOT IN ('bynet', 'umbrella');

-- Opcional — remover as configs legadas de SuitPay/PayFort:
-- DELETE FROM settings WHERE key IN (
--   'suitpay_ci', 'suitpay_cs', 'suitpay_environment',
--   'payfort_account_id', 'payfort_api_key', 'payfort_api_secret'
-- );
