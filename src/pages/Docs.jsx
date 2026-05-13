export default function Docs() {
  return (
    <>
      <div className="top-bar">
        <div><div className="page-title">Documentação</div><div className="page-sub">SQL, API e configuração de webhooks</div></div>
      </div>

      <div className="content-area">

        {/* SQL */}
        <div className="card-panel mb-4">
          <div className="card-panel-header">
            <span className="card-panel-title"><i className="bi bi-database me-2 text-primary" />SQL — Tabelas Supabase</span>
          </div>
          <div className="card-panel-body">
            <p className="text-muted mb-3">Execute no <strong>SQL Editor</strong> do seu projeto Supabase:</p>
            <pre className="bg-dark text-light p-3 rounded mb-3" style={{ fontSize: '.78rem', overflowX: 'auto' }}>{`-- Tabela de configurações (substitui settings.json)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

INSERT INTO settings (key, value) VALUES
  ('admin_user',           'admin'),
  ('admin_password_hash',  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'),
  ('suitpay_ci',           ''),
  ('suitpay_cs',           ''),
  ('suitpay_environment',  'sandbox'),
  ('api_key',              ''),
  ('server_base_url',      '')
ON CONFLICT (key) DO NOTHING;
-- Senha padrão: password

-- Tabela de Transações PIX
CREATE TABLE IF NOT EXISTS transactions (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number      TEXT NOT NULL,
  id_transaction      TEXT,
  amount              NUMERIC(12,2) NOT NULL,
  shipping_amount     NUMERIC(12,2) DEFAULT 0,
  discount_amount     NUMERIC(12,2) DEFAULT 0,
  client_name         TEXT NOT NULL,
  client_document     TEXT NOT NULL,
  client_email        TEXT,
  client_phone        TEXT,
  due_date            TEXT NOT NULL,
  status              TEXT DEFAULT 'pending',
  payment_code        TEXT,
  payment_code_base64 TEXT,
  payment_date        TIMESTAMPTZ,
  paid_value          NUMERIC(12,2),
  payer_name          TEXT,
  payer_tax_id        TEXT,
  callback_url        TEXT,
  username_checkout   TEXT,
  raw_request         JSONB,
  raw_response        JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Logs
CREATE TABLE IF NOT EXISTS logs (
  id         BIGSERIAL PRIMARY KEY,
  level      TEXT NOT NULL,
  type       TEXT NOT NULL,
  message    TEXT NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Webhooks recebidos
CREATE TABLE IF NOT EXISTS webhooks (
  id             BIGSERIAL PRIMARY KEY,
  id_transaction TEXT,
  payload        JSONB NOT NULL,
  processed_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_transactions_status         ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_id_transaction ON transactions(id_transaction);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at     ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_created_at             ON logs(created_at DESC);`}
            </pre>
            <div className="alert alert-warning mb-0" style={{ borderRadius: '.75rem', border: 'none', fontSize: '.82rem' }}>
              <i className="bi bi-info-circle me-2" />
              O Supabase habilita RLS por padrão. Para desenvolvimento, execute:
              {' '}<code>ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;</code>{' '}
              para cada tabela, ou configure políticas de acesso.
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-lg-8">
            {/* API */}
            <div className="card-panel mb-3">
              <div className="card-panel-header">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-success">POST</span>
                  <code className="fw-bold">/api/pix/generate</code>
                </div>
              </div>
              <div className="card-panel-body">
                <p className="text-muted mb-3">Gera um QR Code PIX. Autenticado por <code>api-key</code> no header.</p>
                <div className="fw-semibold mb-2" style={{ fontSize: '.85rem' }}>Headers</div>
                <pre className="bg-light p-3 rounded mb-3" style={{ fontSize: '.78rem' }}>{`Content-Type: application/json
api-key: SUA_API_KEY`}</pre>
                <div className="fw-semibold mb-2" style={{ fontSize: '.85rem' }}>Body</div>
                <pre className="bg-light p-3 rounded mb-3" style={{ fontSize: '.78rem' }}>{`{
  "requestNumber": "12345",
  "dueDate": "2025-12-31",
  "amount": 300.00,
  "shippingAmount": 0,
  "discountAmount": 0,
  "client": {
    "name": "José da Silva",
    "document": "927.300.300-18",
    "phoneNumber": "62999815500",
    "email": "jose@email.com",
    "address": { "codIbge": "5208707", "street": "Rua Paraíba",
      "number": "150", "zipCode": "74663-520",
      "neighborhood": "Goiânia 2", "city": "Goiânia", "state": "GO" }
  },
  "products": [{ "description": "Produto", "quantity": 1, "value": 300.00 }]
}`}</pre>
                <div className="fw-semibold mb-2" style={{ fontSize: '.85rem' }}>Resposta</div>
                <pre className="bg-light p-3 rounded" style={{ fontSize: '.78rem' }}>{`{
  "idTransaction": "0b935d10-...",
  "paymentCode": "00020101...",
  "paymentCodeBase64": "iVBORw0KGgo...",
  "response": "OK",
  "_id": "uuid-interno-supabase"
}`}</pre>
              </div>
            </div>

            {/* Webhook */}
            <div className="card-panel">
              <div className="card-panel-header">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-info text-dark">WEBHOOK</span>
                  <code className="fw-bold">POST /api/webhook/suitpay</code>
                </div>
              </div>
              <div className="card-panel-body">
                <p className="text-muted mb-3">A SuitPay envia este payload quando o status muda. O sistema atualiza automaticamente o Supabase.</p>
                <pre className="bg-light p-3 rounded mb-3" style={{ fontSize: '.78rem' }}>{`{
  "idTransaction":   "205bb038-...",
  "typeTransaction": "PIX",
  "statusTransaction": "PAID_OUT",
  "value":           1.00,
  "payerName":       "JOAO PEDRO PEREIRA DA CUNHA",
  "payerTaxId":      "04749338303",
  "paymentDate":     "12/05/2026 23:20:00",
  "requestNumber":   "12345"
}`}</pre>
                <div className="alert alert-info mb-0" style={{ borderRadius: '.75rem', border: 'none', fontSize: '.82rem' }}>
                  <i className="bi bi-lightbulb me-2" />
                  Para testes locais com <code>vercel dev</code>, use <strong>ngrok</strong>:
                  {' '}<code>ngrok http 3000</code> e configure a URL em <strong>Configurações → URL do Servidor</strong>.
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card-panel mb-3">
              <div className="card-panel-header"><span className="card-panel-title"><i className="bi bi-list-check me-2 text-primary" />Outros Endpoints</span></div>
              <div className="card-panel-body" style={{ fontSize: '.85rem' }}>
                {[
                  ['GET', '/api/transactions', 'Lista transações'],
                  ['GET', '/api/transactions/:id', 'Busca por ID'],
                  ['GET', '/api/dashboard', 'Dados do dashboard'],
                  ['GET', '/api/logs', 'Lista logs'],
                  ['GET', '/api/settings', 'Configurações'],
                  ['POST', '/api/auth/login', 'Login admin'],
                ].map(([method, path, desc]) => (
                  <div key={path} className="mb-2 pb-2 border-bottom">
                    <span className={`badge ${method === 'GET' ? 'bg-info text-dark' : 'bg-success'} me-2`} style={{ fontSize: '.68rem' }}>{method}</span>
                    <code style={{ fontSize: '.78rem' }}>{path}</code>
                    <div className="text-muted" style={{ fontSize: '.75rem', marginTop: 2 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-panel">
              <div className="card-panel-header"><span className="card-panel-title"><i className="bi bi-diagram-3 me-2 text-primary" />Fluxo</span></div>
              <div className="card-panel-body" style={{ fontSize: '.82rem' }}>
                {[
                  ['1', 'Cliente chama POST /api/pix/generate com api-key'],
                  ['2', 'Sistema encaminha para SuitPay com CI/CS'],
                  ['3', 'Salva transação no Supabase'],
                  ['4', 'Retorna QR Code ao cliente'],
                  ['5', 'Cliente paga o PIX'],
                  ['6', 'SuitPay envia webhook PAID_OUT'],
                  ['✓', 'Status atualizado no Supabase'],
                ].map(([n, t]) => (
                  <div key={n} className="d-flex gap-2 mb-2">
                    <span className={`badge rounded-circle flex-shrink-0 ${n === '✓' ? 'bg-success' : 'bg-primary'}`} style={{ width: 20, height: 20, fontSize: '.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
