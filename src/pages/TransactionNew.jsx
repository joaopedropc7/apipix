import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { getSettings } from '../api/client';

export default function TransactionNew() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([{ description: '', quantity: 1, value: '' }]);

  useEffect(() => { getSettings().then(r => setSettings(r.data)); }, []);

  const addProduct = () => setProducts(p => [...p, { description: '', quantity: 1, value: '' }]);
  const removeProduct = i => setProducts(p => p.filter((_, idx) => idx !== i));
  const updateProduct = (i, field, val) => setProducts(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const submit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    const fd = new FormData(e.target);
    const body = {
      requestNumber: fd.get('requestNumber'),
      dueDate: fd.get('dueDate'),
      amount: parseFloat(fd.get('amount')),
      shippingAmount: parseFloat(fd.get('shippingAmount')) || 0,
      discountAmount: parseFloat(fd.get('discountAmount')) || 0,
      usernameCheckout: fd.get('usernameCheckout') || 'admin',
      callbackUrl: fd.get('callbackUrl'),
      client: {
        name: fd.get('clientName'), document: fd.get('clientDocument'),
        phoneNumber: fd.get('clientPhone'), email: fd.get('clientEmail'),
        address: {
          codIbge: fd.get('codIbge'), street: fd.get('street'), number: fd.get('number'),
          complement: fd.get('complement'), zipCode: fd.get('zipCode'),
          neighborhood: fd.get('neighborhood'), city: fd.get('city'), state: fd.get('state'),
        },
      },
      products: products.filter(p => p.description).map(p => ({ ...p, quantity: parseInt(p.quantity), value: parseFloat(p.value) })),
    };
    try {
      const r = await axios.post('/api/pix/generate', body, {
        headers: { 'api-key': settings?.apiKey || '' },
        withCredentials: true,
      });
      navigate(`/transactions/${r.data._id}`);
    } catch (err) {
      setError(JSON.stringify(err.response?.data || err.message));
    } finally { setLoading(false); }
  };

  const configured = settings?.suitpayCsSet && settings?.suitpayCi;
  const webhookUrl = settings?.serverBaseUrl
    ? `${settings.serverBaseUrl.replace(/\/$/, '')}/api/webhook/suitpay` : '';

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">Nova Transação PIX</div>
          <div className="page-sub">Gerar QR Code via SuitPay</div>
        </div>
        <Link to="/transactions" className="btn-outline-custom"><i className="bi bi-arrow-left" /> Voltar</Link>
      </div>

      <div className="content-area">
        {!configured && (
          <div className="alert alert-warning d-flex gap-2 align-items-center mb-3" style={{ borderRadius: '.75rem', border: 'none' }}>
            <i className="bi bi-exclamation-triangle-fill" />
            <span>Credenciais SuitPay não configuradas. <Link to="/settings">Configurar agora</Link></span>
          </div>
        )}
        {error && <div className="alert alert-danger mb-3" style={{ borderRadius: '.75rem', border: 'none', fontSize: '.85rem' }}>{error}</div>}

        <form onSubmit={submit}>
          <div className="row g-3">
            <div className="col-lg-8">
              <div className="form-section mb-3">
                <div className="form-section-title"><i className="bi bi-receipt" /> Dados da Transação</div>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold text-secondary">Número do Pedido *</label>
                    <input name="requestNumber" className="form-control" placeholder="12345" required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold text-secondary">Vencimento *</label>
                    <input name="dueDate" type="date" className="form-control" required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold text-secondary">Valor (R$) *</label>
                    <div className="input-group">
                      <span className="input-group-text">R$</span>
                      <input name="amount" type="number" step="0.01" min="0.01" className="form-control" placeholder="0,00" required />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold text-secondary">Frete (R$)</label>
                    <div className="input-group"><span className="input-group-text">R$</span><input name="shippingAmount" type="number" step="0.01" min="0" className="form-control" defaultValue="0" /></div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold text-secondary">Desconto (R$)</label>
                    <div className="input-group"><span className="input-group-text">R$</span><input name="discountAmount" type="number" step="0.01" min="0" className="form-control" defaultValue="0" /></div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold text-secondary">Username Checkout</label>
                    <input name="usernameCheckout" className="form-control" defaultValue="checkout" />
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold text-secondary">URL de Callback (Webhook)</label>
                    <input name="callbackUrl" type="url" className="form-control" defaultValue={webhookUrl} placeholder="https://seu-servidor.com/api/webhook/suitpay" />
                    {webhookUrl && <div className="form-text text-success"><i className="bi bi-check-circle me-1" />Preenchido automaticamente</div>}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="form-section-title"><i className="bi bi-person-circle" /> Dados do Cliente</div>
                <div className="row g-3">
                  <div className="col-md-6"><label className="form-label small fw-semibold text-secondary">Nome *</label><input name="clientName" className="form-control" placeholder="José da Silva" required /></div>
                  <div className="col-md-6"><label className="form-label small fw-semibold text-secondary">CPF/CNPJ *</label><input name="clientDocument" className="form-control" placeholder="000.000.000-00" required /></div>
                  <div className="col-md-6"><label className="form-label small fw-semibold text-secondary">Telefone</label><input name="clientPhone" className="form-control" placeholder="62999815500" /></div>
                  <div className="col-md-6"><label className="form-label small fw-semibold text-secondary">E-mail</label><input name="clientEmail" type="email" className="form-control" /></div>
                  <div className="col-12"><hr className="my-1" /></div>
                  <div className="col-md-3"><label className="form-label small fw-semibold text-secondary">CEP</label><input name="zipCode" className="form-control" placeholder="74663-520" /></div>
                  <div className="col-md-3"><label className="form-label small fw-semibold text-secondary">Cód. IBGE</label><input name="codIbge" className="form-control" placeholder="5208707" /></div>
                  <div className="col-md-6"><label className="form-label small fw-semibold text-secondary">Rua</label><input name="street" className="form-control" /></div>
                  <div className="col-md-2"><label className="form-label small fw-semibold text-secondary">Número</label><input name="number" className="form-control" /></div>
                  <div className="col-md-4"><label className="form-label small fw-semibold text-secondary">Complemento</label><input name="complement" className="form-control" /></div>
                  <div className="col-md-3"><label className="form-label small fw-semibold text-secondary">Bairro</label><input name="neighborhood" className="form-control" /></div>
                  <div className="col-md-2"><label className="form-label small fw-semibold text-secondary">Cidade</label><input name="city" className="form-control" /></div>
                  <div className="col-md-1"><label className="form-label small fw-semibold text-secondary">UF</label><input name="state" className="form-control" maxLength={2} /></div>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="form-section">
                <div className="form-section-title d-flex justify-content-between">
                  <span><i className="bi bi-box" /> Produtos</span>
                  <button type="button" className="btn btn-sm btn-light" onClick={addProduct}><i className="bi bi-plus" /></button>
                </div>
                {products.map((p, i) => (
                  <div key={i} className="mb-3 p-2 bg-light rounded position-relative">
                    {i > 0 && <button type="button" className="btn btn-sm btn-light position-absolute top-0 end-0 m-1 py-0 px-1" onClick={() => removeProduct(i)}>×</button>}
                    <input className="form-control form-control-sm mb-2" placeholder="Descrição" value={p.description} onChange={e => updateProduct(i, 'description', e.target.value)} required />
                    <div className="row g-2">
                      <div className="col-5"><input type="number" className="form-control form-control-sm" placeholder="Qtd" min="1" value={p.quantity} onChange={e => updateProduct(i, 'quantity', e.target.value)} /></div>
                      <div className="col-7"><div className="input-group input-group-sm"><span className="input-group-text" style={{ fontSize: '.75rem' }}>R$</span><input type="number" step="0.01" className="form-control" placeholder="0,00" value={p.value} onChange={e => updateProduct(i, 'value', e.target.value)} /></div></div>
                    </div>
                  </div>
                ))}
                <button type="submit" className="btn-primary-custom w-100 justify-content-center mt-2" disabled={loading || !configured}>
                  {loading ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-qr-code-scan" /> Gerar QR Code PIX</>}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
