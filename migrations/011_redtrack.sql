-- ================================================================
-- 011 — Integração RedTrack (postback via GET)
-- ----------------------------------------------------------------
-- O body do /generate aceita um "clickid" opcional. Quando presente:
--   ao gerar o PIX  → GET {url}?clickid={clickid}&sum=0&type=initiate
--   quando for pago → GET {url}?clickid={clickid}&sum={valor}&type=conversion
--
-- A URL base é configurável (default abaixo). O clickid é persistido
-- em transactions.raw_request, então o webhook o recupera no pagamento.
-- ================================================================

INSERT INTO settings (key, value) VALUES
  ('redtrack_postback_url', 'https://kpcab.ttrk.io/postback')
ON CONFLICT (key) DO NOTHING;
