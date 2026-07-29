-- ================================================================
-- PIX Admin — Setup completo (banco novo)
-- Substitui todas as migrations 001 a 007
-- Execute no Supabase: Dashboard → SQL Editor → New query → Run
-- ================================================================

-- ----------------------------------------------------------------
-- TABELA: settings
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- Configurações iniciais — login: admin / password
INSERT INTO settings (key, value) VALUES
  ('admin_user',          'admin'),
  ('admin_password_hash', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
  ('suitpay_ci',          ''),
  ('suitpay_cs',          ''),
  ('suitpay_environment', 'sandbox'),
  ('api_key',             ''),
  ('server_base_url',     ''),
  ('active_gateway',      'suitpay'),
  ('active_gateway_2',    'suitpay'),
  ('utmify_token',        ''),
  ('utmify_token_2',      ''),
  ('payfort_account_id',  ''),
  ('payfort_api_key',     ''),
  ('payfort_api_secret',  ''),
  ('bynet_api_key',       '')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------
-- TABELA: transactions
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number      TEXT        NOT NULL,
  id_transaction      TEXT,
  dedup_key           TEXT,
  amount              NUMERIC(12,2) NOT NULL,
  shipping_amount     NUMERIC(12,2) DEFAULT 0,
  discount_amount     NUMERIC(12,2) DEFAULT 0,
  client_name         TEXT        NOT NULL,
  client_document     TEXT        NOT NULL,
  client_email        TEXT,
  client_phone        TEXT,
  due_date            TEXT        NOT NULL,
  status              TEXT        DEFAULT 'pending',
  payment_code        TEXT,
  payment_code_base64 TEXT,
  payment_date        TIMESTAMPTZ,
  paid_value          NUMERIC(12,2),
  payer_name          TEXT,
  payer_tax_id        TEXT,
  callback_url        TEXT,
  username_checkout   TEXT,
  gateway             TEXT        DEFAULT 'suitpay',
  raw_request         JSONB,
  raw_response        JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABELA: logs
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logs (
  id         BIGSERIAL PRIMARY KEY,
  level      TEXT        NOT NULL,
  type       TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABELA: webhooks
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhooks (
  id             BIGSERIAL PRIMARY KEY,
  id_transaction TEXT,
  payload        JSONB       NOT NULL,
  processed_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- ÍNDICES
-- ----------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_dedup_key
  ON transactions(dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_status         ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_id_transaction ON transactions(id_transaction);
CREATE INDEX IF NOT EXISTS idx_transactions_gateway        ON transactions(gateway);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at     ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_created_at             ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level                  ON logs(level);
CREATE INDEX IF NOT EXISTS idx_webhooks_id_transaction     ON webhooks(id_transaction);

-- ----------------------------------------------------------------
-- DESABILITAR RLS + GRANTS (anon key do Supabase)
-- ----------------------------------------------------------------
ALTER TABLE settings     DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE logs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks     DISABLE ROW LEVEL SECURITY;

GRANT ALL ON settings     TO anon, authenticated;
GRANT ALL ON transactions TO anon, authenticated;
GRANT ALL ON logs         TO anon, authenticated;
GRANT ALL ON webhooks     TO anon, authenticated;

GRANT USAGE, SELECT ON SEQUENCE logs_id_seq     TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE webhooks_id_seq TO anon, authenticated;
