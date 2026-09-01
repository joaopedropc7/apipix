-- ================================================================
-- 013 — URL de postback dedicada da Axxon (endpoint 1)
-- ----------------------------------------------------------------
-- A Axxon exige que o postback (webhook) passe por um domínio próprio
-- (ex.: lojaconfort.site), que reenvia o mesmo payload para
-- /api/webhook/axxon deste sistema.
--
-- Quando preenchido, o postbackUrl enviado à Axxon (apenas endpoint 1)
-- passa a ser este valor, em vez de server_base_url + /api/webhook/axxon.
-- Vazio = usa a URL do Servidor normal.
-- ================================================================

INSERT INTO settings (key, value) VALUES
  ('axxon_postback_url', '')
ON CONFLICT (key) DO NOTHING;
