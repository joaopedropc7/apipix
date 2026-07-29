import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../api/client';

const gatewayLabel = (gw) => ({ suitpay: 'SuitPay', payfort: 'PayFort', bynet: 'ByNet', umbrella: 'Umbrella' }[gw] || 'SuitPay');

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div className={`alert alert-${type} position-fixed bottom-0 end-0 m-3 d-flex align-items-center gap-2`}
      style={{ zIndex: 9999, borderRadius: '.75rem', border: 'none', minWidth: 280 }}>
      <i className={`bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} fs-5`} />{msg}
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState({});
  const [showCs, setShowCs] = useState(false);
  const [showPayfortSecret, setShowPayfortSecret] = useState(false);

  const notify = (msg, type = 'success') => setToast({ msg, type });

  useEffect(() => { getSettings().then(r => setSettings(r.data)); }, []);

  const save = async (action, data) => {
    setLoading(l => ({ ...l, [action]: true }));
    try {
      const r = await saveSettings({ action, ...data });
      if (r.data.apiKey) setSettings(s => ({ ...s, apiKey: r.data.apiKey }));
      notify(action === 'password' ? 'Senha alterada com sucesso!' : 'Salvo com sucesso!');
      getSettings().then(r => setSettings(r.data));
    } catch (err) {
      notify(err.response?.data?.error || 'Erro ao salvar', 'danger');
    } finally { setLoading(l => ({ ...l, [action]: false })); }
  };

  const copyKey = () => { navigator.clipboard.writeText(settings?.apiKey || ''); notify('API Key copiada!'); };

  if (!settings) return <div className="page-loader"><div className="spinner-border text-primary" /></div>;

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="top-bar">
        <div><div className="page-title">Configurações</div><div className="page-sub">Gerencie integrações e preferências</div></div>
      </div>

      <div className="content-area">
        <div className="row g-3">
          <div className="col-lg-7">

            {/* Gateway ativo — Endpoint 1 (/api/pix) */}
            <div className="form-section mb-3">
              <div className="form-section-title"><i className="bi bi-toggles" /> Gateway Ativo <span className="badge bg-primary ms-1" style={{ fontSize: '.65rem' }}>Endpoint 1</span></div>
              <div className="form-text mb-2 text-muted">Usado por: <code>/api/pix/generate</code> → Utmify Endpoint 1</div>
              <div className="d-flex gap-2 flex-wrap">
                {[
                  ['suitpay',  'SuitPay',  'bi-qr-code-scan'],
                  ['payfort',  'PayFort',  'bi-bank'],
                  ['bynet',    'ByNet',    'bi-lightning-charge'],
                  ['umbrella', 'Umbrella', 'bi-umbrella'],
                ].map(([value, label, icon]) => (
                  <button
                    key={value}
                    type="button"
                    className={`btn ${settings.activeGateway === value ? 'btn-primary-custom' : 'btn-outline-secondary'} flex-fill`}
                    disabled={loading.gateway || settings.activeGateway === value}
                    onClick={() => save('gateway', { activeGateway: value })}
                  >
                    <i className={`bi ${icon} me-1`} /> {label}
                    {settings.activeGateway === value && <i className="bi bi-check-circle-fill ms-2" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Gateway ativo — Endpoint 2 (/api/pix2) */}
            <div className="form-section mb-3">
              <div className="form-section-title"><i className="bi bi-toggles" /> Gateway Ativo <span className="badge bg-secondary ms-1" style={{ fontSize: '.65rem' }}>Endpoint 2</span></div>
              <div className="form-text mb-2 text-muted">Usado por: <code>/api/pix2/generate</code> → Utmify Endpoint 2</div>
              <div className="d-flex gap-2 flex-wrap">
                {[
                  ['suitpay',  'SuitPay',  'bi-qr-code-scan'],
                  ['payfort',  'PayFort',  'bi-bank'],
                  ['bynet',    'ByNet',    'bi-lightning-charge'],
                  ['umbrella', 'Umbrella', 'bi-umbrella'],
                ].map(([value, label, icon]) => (
                  <button
                    key={value}
                    type="button"
                    className={`btn ${settings.activeGateway2 === value ? 'btn-primary-custom' : 'btn-outline-secondary'} flex-fill`}
                    disabled={loading.gateway2 || settings.activeGateway2 === value}
                    onClick={() => save('gateway2', { activeGateway2: value })}
                  >
                    <i className={`bi ${icon} me-1`} /> {label}
                    {settings.activeGateway2 === value && <i className="bi bi-check-circle-fill ms-2" />}
                  </button>
                ))}
              </div>
            </div>

            {/* SuitPay */}
            <div className="form-section mb-3">
              <div className="form-section-title d-flex justify-content-between">
                <span><i className="bi bi-qr-code-scan" /> Credenciais SuitPay</span>
                <span className={`badge ${settings.suitpayCsSet && settings.suitpayCi ? 'bg-success' : 'bg-warning text-dark'}`} style={{ fontSize: '.68rem' }}>
                  {settings.suitpayCsSet && settings.suitpayCi ? 'Configurado' : 'Não configurado'}
                </span>
              </div>
              <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.target); save('suitpay', { ci: fd.get('ci'), cs: fd.get('cs'), environment: fd.get('environment') }); }}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Client ID (ci)</label>
                  <input name="ci" className="form-control" defaultValue={settings.suitpayCi} placeholder="testesandbox_..." />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Client Secret (cs)</label>
                  <div className="input-group">
                    <input name="cs" type={showCs ? 'text' : 'password'} className="form-control"
                      defaultValue={settings.suitpayCsSet ? settings.suitpayCs : ''} placeholder={settings.suitpayCsSet ? '••••••••' : 'Cole o CS aqui'} />
                    <button className="btn btn-outline-secondary" type="button" onClick={() => setShowCs(v => !v)}>
                      <i className={`bi ${showCs ? 'bi-eye-slash' : 'bi-eye'}`} />
                    </button>
                  </div>
                  {settings.suitpayCsSet && <div className="form-text text-success"><i className="bi bi-check-circle me-1" />CS já configurado — deixe em branco para manter</div>}
                </div>
                <div className="mb-4">
                  <label className="form-label small fw-semibold text-secondary">Ambiente</label>
                  <select name="environment" className="form-select" defaultValue={settings.suitpayEnvironment}>
                    <option value="sandbox">Sandbox (Testes)</option>
                    <option value="production">Produção</option>
                  </select>
                </div>
                <button className="btn-primary-custom" type="submit" disabled={loading.suitpay}>
                  {loading.suitpay ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-save" /> Salvar SuitPay</>}
                </button>
              </form>
            </div>

            {/* PayFort */}
            <div className="form-section mb-3">
              <div className="form-section-title d-flex justify-content-between">
                <span><i className="bi bi-bank" /> Credenciais PayFort</span>
                <span className={`badge ${settings.payfortApiSecretSet && settings.payfortApiKey ? 'bg-success' : 'bg-warning text-dark'}`} style={{ fontSize: '.68rem' }}>
                  {settings.payfortApiSecretSet && settings.payfortApiKey ? 'Configurado' : 'Não configurado'}
                </span>
              </div>
              <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.target); save('payfort', { accountId: fd.get('accountId'), apiKey: fd.get('apiKey'), apiSecret: fd.get('apiSecret') }); }}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">Account ID</label>
                  <input name="accountId" className="form-control" defaultValue={settings.payfortAccountId} placeholder="cmqv6a0dm002fk11tfax6gain" />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">API Key (pública)</label>
                  <input name="apiKey" className="form-control" defaultValue={settings.payfortApiKey} placeholder="cmr0z0uop00001tlmanvp7ev2" />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">API Secret (secreta)</label>
                  <div className="input-group">
                    <input name="apiSecret" type={showPayfortSecret ? 'text' : 'password'} className="form-control"
                      defaultValue={settings.payfortApiSecretSet ? settings.payfortApiSecret : ''} placeholder={settings.payfortApiSecretSet ? '••••••••' : 'Cole a API Secret aqui'} />
                    <button className="btn btn-outline-secondary" type="button" onClick={() => setShowPayfortSecret(v => !v)}>
                      <i className={`bi ${showPayfortSecret ? 'bi-eye-slash' : 'bi-eye'}`} />
                    </button>
                  </div>
                  {settings.payfortApiSecretSet && <div className="form-text text-success"><i className="bi bi-check-circle me-1" />API Secret já configurada — deixe em branco para manter</div>}
                </div>
                <button className="btn-primary-custom" type="submit" disabled={loading.payfort}>
                  {loading.payfort ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-save" /> Salvar PayFort</>}
                </button>
              </form>
            </div>

            {/* ByNet */}
            <div className="form-section mb-3">
              <div className="form-section-title d-flex justify-content-between">
                <span><i className="bi bi-lightning-charge" /> Credenciais ByNet</span>
                <span className={`badge ${settings.bynetApiKey ? 'bg-success' : 'bg-warning text-dark'}`} style={{ fontSize: '.68rem' }}>
                  {settings.bynetApiKey ? 'Configurado' : 'Não configurado'}
                </span>
              </div>
              <form onSubmit={e => { e.preventDefault(); save('bynet', { apiKey: new FormData(e.target).get('apiKey') }); }}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">x-api-key</label>
                  <input name="apiKey" className="form-control font-monospace" defaultValue={settings.bynetApiKey}
                    placeholder="Cole aqui a API Key da ByNet" />
                  <div className="form-text">Obtida no painel da TechByNet → API Keys</div>
                </div>
                <button className="btn-primary-custom" type="submit" disabled={loading.bynet}>
                  {loading.bynet ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-save" /> Salvar ByNet</>}
                </button>
              </form>
            </div>

            {/* Umbrella */}
            <div className="form-section mb-3">
              <div className="form-section-title d-flex justify-content-between">
                <span><i className="bi bi-umbrella" /> Credenciais Umbrella</span>
                <span className={`badge ${settings.umbrellaApiKey ? 'bg-success' : 'bg-warning text-dark'}`} style={{ fontSize: '.68rem' }}>
                  {settings.umbrellaApiKey ? 'Configurado' : 'Não configurado'}
                </span>
              </div>
              <form onSubmit={e => { e.preventDefault(); save('umbrella', { apiKey: new FormData(e.target).get('apiKey') }); }}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-secondary">x-api-key</label>
                  <input name="apiKey" className="form-control font-monospace" defaultValue={settings.umbrellaApiKey}
                    placeholder="Cole aqui a API Key da Umbrella" />
                  <div className="form-text">Painel da UmbrellaPag → API Keys</div>
                </div>
                <button className="btn-primary-custom" type="submit" disabled={loading.umbrella}>
                  {loading.umbrella ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-save" /> Salvar Umbrella</>}
                </button>
              </form>
            </div>

            {/* Utmify — Endpoint 1 (/api/pix/generate) */}
            <div className="form-section mb-3">
              <div className="form-section-title d-flex justify-content-between">
                <span><i className="bi bi-graph-up-arrow" /> Utmify <span className="badge bg-primary ms-1" style={{ fontSize: '.65rem' }}>Endpoint 1</span></span>
                <span className={`badge ${settings.utmifyToken ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '.68rem' }}>
                  {settings.utmifyToken ? 'Configurado' : 'Não configurado'}
                </span>
              </div>
              <div className="form-text mb-2 text-muted">Usado por: <code>/api/pix/generate</code></div>
              <form onSubmit={e => { e.preventDefault(); save('utmify', { utmifyToken: new FormData(e.target).get('utmifyToken') }); }}>
                <div className="mb-2">
                  <label className="form-label small fw-semibold text-secondary">Token da credencial de API</label>
                  <input name="utmifyToken" className="form-control font-monospace" defaultValue={settings.utmifyToken}
                    placeholder="KVRxalfMiBfm8Rm1nP5YxfwYzArNsA0VLeWC" />
                  <div className="form-text">Obtenha em: Utmify → Integrações → Webhooks → Credenciais de API</div>
                </div>
                <button className="btn-primary-custom" type="submit" disabled={loading.utmify}>
                  {loading.utmify ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-save" /> Salvar Token Utmify</>}
                </button>
              </form>
            </div>

            {/* Utmify — Endpoint 2 (/api/pix2/generate) */}
            <div className="form-section mb-3">
              <div className="form-section-title d-flex justify-content-between">
                <span><i className="bi bi-graph-up-arrow" /> Utmify <span className="badge bg-secondary ms-1" style={{ fontSize: '.65rem' }}>Endpoint 2</span></span>
                <span className={`badge ${settings.utmifyToken2 ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '.68rem' }}>
                  {settings.utmifyToken2 ? 'Configurado' : 'Não configurado'}
                </span>
              </div>
              <div className="form-text mb-2 text-muted">Usado por: <code>/api/pix2/generate</code></div>
              <form onSubmit={e => { e.preventDefault(); save('utmify2', { utmifyToken2: new FormData(e.target).get('utmifyToken2') }); }}>
                <div className="mb-2">
                  <label className="form-label small fw-semibold text-secondary">Token da credencial de API</label>
                  <input name="utmifyToken2" className="form-control font-monospace" defaultValue={settings.utmifyToken2}
                    placeholder="KVRxalfMiBfm8Rm1nP5YxfwYzArNsA0VLeWC" />
                  <div className="form-text">Obtenha em: Utmify → Integrações → Webhooks → Credenciais de API</div>
                </div>
                <button className="btn-primary-custom" type="submit" disabled={loading.utmify2}>
                  {loading.utmify2 ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-save" /> Salvar Token Utmify 2</>}
                </button>
              </form>
            </div>

            {/* API Key */}
            <div className="form-section mb-3">
              <div className="form-section-title"><i className="bi bi-shield-lock" /> API Key</div>
              <label className="form-label small fw-semibold text-secondary">Chave para autenticar requisições dos seus clientes</label>
              <div className="input-group mb-2">
                <span className="input-group-text"><i className="bi bi-key" /></span>
                <input className="form-control font-monospace" value={settings.apiKey || ''} readOnly style={{ fontSize: '.85rem' }} />
                <button className="btn btn-outline-secondary" type="button" onClick={copyKey}><i className="bi bi-clipboard" /></button>
              </div>
              <div className="form-text mb-3">Header: <code>api-key: {settings.apiKey || '...'}</code></div>
              <button className="btn btn-sm btn-outline-warning" onClick={() => { if (confirm('Gerar nova API Key? A atual deixará de funcionar.')) save('regenerate-key', {}); }}>
                <i className="bi bi-arrow-clockwise me-1" />Gerar Nova API Key
              </button>
            </div>

            {/* Server URL */}
            <div className="form-section mb-3">
              <div className="form-section-title"><i className="bi bi-globe" /> URL do Servidor</div>
              <form onSubmit={e => { e.preventDefault(); save('server', { serverBaseUrl: new FormData(e.target).get('serverBaseUrl') }); }}>
                <div className="mb-2">
                  <input name="serverBaseUrl" className="form-control" defaultValue={settings.serverBaseUrl} placeholder="https://meusite.com ou https://xxxx.ngrok.io" />
                  {settings.serverBaseUrl && (
                    <div className="form-text">Webhook: <code>{settings.serverBaseUrl.replace(/\/$/, '')}/api/webhook/suitpay</code></div>
                  )}
                </div>
                <button className="btn-primary-custom" type="submit" disabled={loading.server}>
                  {loading.server ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-save" /> Salvar URL</>}
                </button>
              </form>
            </div>

          </div>

          <div className="col-lg-5">
            {/* Supabase status */}
            <div className="form-section mb-3">
              <div className="form-section-title d-flex justify-content-between">
                <span><i className="bi bi-database" /> Supabase</span>
                <span className={`badge ${settings.supabaseConfigured ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '.68rem' }}>
                  {settings.supabaseConfigured ? 'Conectado' : 'Não configurado'}
                </span>
              </div>
              <div className="bg-dark text-light rounded p-3" style={{ fontSize: '.8rem', fontFamily: 'monospace' }}>
                <div className="text-warning mb-1"># .env / Vercel → Environment Variables</div>
                <div>SUPABASE_URL=<span className="text-success">https://xxx.supabase.co</span></div>
                <div>SUPABASE_ANON_KEY=<span className="text-success">eyJhbGci...</span></div>
                <div>JWT_SECRET=<span className="text-success">sua-chave-secreta</span></div>
              </div>
              <div className="form-text mt-2">
                <i className="bi bi-info-circle me-1" />
                Supabase Dashboard → Settings → API → Project URL e anon key
              </div>
            </div>

            {/* Password */}
            <div className="form-section mb-3">
              <div className="form-section-title"><i className="bi bi-lock-fill" /> Alterar Senha do Admin</div>
              <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.target); save('password', { currentPassword: fd.get('currentPassword'), newPassword: fd.get('newPassword'), confirmPassword: fd.get('confirmPassword') }); e.target.reset(); }}>
                <div className="mb-3"><label className="form-label small fw-semibold text-secondary">Senha Atual</label><input name="currentPassword" type="password" className="form-control" placeholder="••••••••" required /></div>
                <div className="mb-3"><label className="form-label small fw-semibold text-secondary">Nova Senha</label><input name="newPassword" type="password" className="form-control" minLength={6} placeholder="Mínimo 6 caracteres" required /></div>
                <div className="mb-4"><label className="form-label small fw-semibold text-secondary">Confirmar Nova Senha</label><input name="confirmPassword" type="password" className="form-control" placeholder="Repita a nova senha" required /></div>
                <button className="btn-primary-custom" type="submit" disabled={loading.password}>
                  {loading.password ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-key" /> Alterar Senha</>}
                </button>
              </form>
            </div>

            {/* System info */}
            <div className="card-panel">
              <div className="card-panel-body">
                <div className="fw-bold mb-3"><i className="bi bi-info-circle text-primary me-2" />Status</div>
                {[
                  ['Usuário admin', settings.adminUser],
                  ['Gateway Endpoint 1', gatewayLabel(settings.activeGateway)],
                  ['Gateway Endpoint 2', gatewayLabel(settings.activeGateway2)],
                  ['Ambiente SuitPay', settings.suitpayEnvironment],
                  ['Supabase', settings.supabaseConfigured ? '✅ Conectado' : '❌ Não configurado'],
                ].map(([l, v]) => (
                  <div key={l} className="d-flex justify-content-between mb-2" style={{ fontSize: '.85rem' }}>
                    <span className="text-muted">{l}</span>
                    <span className="fw-semibold">{v}</span>
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
