import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTransaction, cancelTransaction } from '../api/client';
import StatusBadge from '../components/StatusBadge';

const fmt = v => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;
const fmtDate = s => s ? new Date(s).toLocaleString('pt-BR') : '-';

export default function TransactionDetail() {
  const { id } = useParams();
  const [tx, setTx] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { getTransaction(id).then(r => setTx(r.data)); }, [id]);

  const cancel = async () => {
    if (!confirm('Cancelar esta transação?')) return;
    setCancelling(true);
    await cancelTransaction(id);
    setTx(t => ({ ...t, status: 'cancelled' }));
    setCancelling(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(tx.payment_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!tx) return <div className="page-loader"><div className="spinner-border text-primary" /></div>;

  const b64 = tx.payment_code_base64;
  const imgSrc = b64 ? (b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`) : null;

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">Transação #{tx.request_number}</div>
          <div className="page-sub">Detalhes da transação PIX</div>
        </div>
        <div className="d-flex gap-2">
          {tx.status === 'pending' && (
            <button className="btn btn-sm btn-outline-danger" onClick={cancel} disabled={cancelling}>
              <i className="bi bi-x-circle me-1" />Cancelar
            </button>
          )}
          <Link to="/transactions" className="btn-outline-custom"><i className="bi bi-arrow-left" /> Voltar</Link>
        </div>
      </div>

      <div className="content-area">
        <div className="row g-3">
          <div className="col-lg-4">
            <div className="card-panel mb-3">
              <div className="card-panel-header"><span className="card-panel-title"><i className="bi bi-qr-code me-2 text-primary" />QR Code PIX</span></div>
              <div className="card-panel-body text-center">
                {imgSrc ? (
                  <>
                    <img src={imgSrc} alt="QR Code" className="img-fluid rounded mb-3" style={{ maxWidth: 200, border: '8px solid #fff', boxShadow: '0 4px 20px rgba(0,0,0,.12)' }} />
                    <div className="text-muted small mb-1 fw-semibold text-uppercase" style={{ fontSize: '.72rem', letterSpacing: '.05em' }}>PIX Copia e Cola</div>
                    <div className={`pix-code-box${copied ? ' bg-success-subtle' : ''}`} onClick={copyCode} title="Clique para copiar">
                      {tx.payment_code}
                    </div>
                    <div className="text-muted mt-2" style={{ fontSize: '.75rem' }}>
                      <i className={`bi ${copied ? 'bi-check-lg text-success' : 'bi-clipboard'} me-1`} />
                      {copied ? 'Copiado!' : 'Clique para copiar'}
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-muted">
                    <i className="bi bi-exclamation-circle d-block mb-2" style={{ fontSize: '2.5rem', opacity: .25 }} />
                    QR Code não disponível
                    {tx.status === 'error' && <div className="text-danger small mt-1">Falha na geração</div>}
                  </div>
                )}
              </div>
            </div>

            <div className="card-panel">
              <div className="card-panel-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '.72rem' }}>STATUS</span>
                  <StatusBadge status={tx.status} />
                </div>
                {[
                  ['Valor', fmt(tx.amount)],
                  tx.shipping_amount > 0 && ['Frete', fmt(tx.shipping_amount)],
                  tx.discount_amount > 0 && ['Desconto', `-${fmt(tx.discount_amount)}`],
                  ['Vencimento', tx.due_date],
                  tx.payment_date && ['Data do Pagamento', fmtDate(tx.payment_date)],
                  tx.paid_value && ['Valor Pago', fmt(tx.paid_value)],
                ].filter(Boolean).map(([label, value]) => (
                  <div key={label} className="d-flex justify-content-between mb-2" style={{ fontSize: '.875rem' }}>
                    <span className="text-muted">{label}</span>
                    <span className="fw-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="card-panel mb-3">
              <div className="card-panel-header"><span className="card-panel-title"><i className="bi bi-info-circle me-2 text-primary" />Informações</span></div>
              <div className="card-panel-body">
                <div className="row g-3">
                  {[
                    ['Número do Pedido', `#${tx.request_number}`],
                    ['ID SuitPay', tx.id_transaction || '-'],
                    ['Criado em', fmtDate(tx.created_at)],
                    ['Atualizado em', fmtDate(tx.updated_at)],
                  ].map(([l, v]) => (
                    <div key={l} className="col-md-6">
                      <div className="text-muted small fw-semibold text-uppercase mb-1" style={{ fontSize: '.72rem', letterSpacing: '.05em' }}>{l}</div>
                      <div className="fw-semibold" style={{ fontSize: '.875rem', wordBreak: 'break-all' }}>{v}</div>
                    </div>
                  ))}
                  {tx.callback_url && (
                    <div className="col-12">
                      <div className="text-muted small fw-semibold text-uppercase mb-1" style={{ fontSize: '.72rem' }}>Webhook URL</div>
                      <code style={{ fontSize: '.8rem', wordBreak: 'break-all' }}>{tx.callback_url}</code>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="card-panel mb-3">
              <div className="card-panel-header"><span className="card-panel-title"><i className="bi bi-person me-2 text-primary" />Cliente</span></div>
              <div className="card-panel-body">
                <div className="row g-3">
                  {[['Nome', tx.client_name], ['Documento', tx.client_document], ['E-mail', tx.client_email || '-'], ['Telefone', tx.client_phone || '-']].map(([l, v]) => (
                    <div key={l} className="col-md-6">
                      <div className="text-muted small fw-semibold text-uppercase mb-1" style={{ fontSize: '.72rem' }}>{l}</div>
                      <div style={{ fontSize: '.875rem' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {(tx.payer_name || tx.payer_tax_id) && (
              <div className="card-panel" style={{ borderLeft: '4px solid #10b981' }}>
                <div className="card-panel-header"><span className="card-panel-title text-success"><i className="bi bi-person-check me-2" />Pagador (via Webhook)</span></div>
                <div className="card-panel-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="text-muted small fw-semibold text-uppercase mb-1" style={{ fontSize: '.72rem' }}>Nome do Pagador</div>
                      <div className="fw-semibold">{tx.payer_name || '-'}</div>
                    </div>
                    <div className="col-md-6">
                      <div className="text-muted small fw-semibold text-uppercase mb-1" style={{ fontSize: '.72rem' }}>CPF/CNPJ do Pagador</div>
                      <div>{tx.payer_tax_id || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
