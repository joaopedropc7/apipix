import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../api/client';

const gatewayLabel = (gw) => ({ bynet: 'ByNet', umbrella: 'Umbrella', axxon: 'Axxon' }[gw] || 'ByNet');

const GATEWAYS = [
  ['bynet',    'ByNet',    'bi-lightning-charge'],
  ['umbrella', 'Umbrella', 'bi-umbrella'],
  ['axxon',    'Axxon',    'bi-hexagon'],
];

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div className={`alert alert-${type} position-fixed bottom-0 end-0 m-3 d-flex align-items-center gap-2`}
      style={{ zIndex: 9999, borderRadius: '.75rem', border: 'none', minWidth: 280 }}>
      <i className={`bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} fs-5`} />{msg}
    </div>
  );
}

// Bloco de configuração de um endpoint: gateway ativo + credenciais ByNet/Umbrella + token Utmify
function EndpointCard({ n, settings, save, loading }) {
  // Nomes dos campos/ações diferem entre endpoint 1 (sufixo vazio) e 2 (sufixo "2")
  const sfx = n === 1 ? '' : '2';
  const activeGateway   = n === 1 ? settings.activeGateway   : settings.activeGateway2;
  const bynetKey        = n === 1 ? settings.bynetApiKey      : settings.bynetApiKey2;
  const umbrellaKey     = n === 1 ? settings.umbrellaApiKey   : settings.umbrellaApiKey2;
  const axxonPublicKey  = n === 1 ? settings.axxonPublicKey   : settings.axxonPublicKey2;
  const axxonSecretKey  = n === 1 ? settings.axxonSecretKey   : settings.axxonSecretKey2;
  const utmifyToken     = n === 1 ? settings.utmifyToken      : settings.utmifyToken2;
  const path            = n === 1 ? '/api/pix' : '/api/pix2';
  const badgeClass      = n === 1 ? 'bg-primary' : 'bg-secondary';

  return (
    <div className="form-section mb-3">
      <div className="form-section-title">
        <i className="bi bi-hdd-network" /> Endpoint {n}
        <span className={`badge ${badgeClass} ms-2`} style={{ fontSize: '.65rem' }}>{path}</span>
      </div>
      <div className="form-text mb-3 text-muted">Gateway, credenciais e Utmify próprios deste endpoint.</div>

      {/* Gateway ativo */}
      <label className="form-label small fw-semibold text-secondary">Gateway ativo</label>
      <div className="d-flex gap-2 flex-wrap mb-3">
        {GATEWAYS.map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            className={`btn ${activeGateway === value ? 'btn-primary-custom' : 'btn-outline-secondary'} flex-fill`}
            disabled={loading[`gateway${sfx}`] || activeGateway === value}
            onClick={() => save(`gateway${sfx}`, { [`activeGateway${sfx}`]: value })}
          >
            <i className={`bi ${icon} me-1`} /> {label}
            {activeGateway === value && <i className="bi bi-check-circle-fill ms-2" />}
          </button>
        ))}
      </div>

      {/* Credencial ByNet */}
      <form className="mb-3" onSubmit={e => { e.preventDefault(); save(`bynet${sfx}`, { apiKey: new FormData(e.target).get('apiKey') }); }}>
        <label className="form-label small fw-semibold text-secondary d-flex justify-content-between">
          <span><i className="bi bi-lightning-charge me-1" /> API Key ByNet</span>
          <span className={`badge ${bynetKey ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '.62rem' }}>{bynetKey ? 'Configurado' : 'Vazio'}</span>
        </label>
        <div className="input-group">
          <input name="apiKey" className="form-control font-monospace" defaultValue={bynetKey} placeholder="x-api-key da TechByNet" />
          <button className="btn-primary-custom" type="submit" disabled={loading[`bynet${sfx}`]}>
            {loading[`bynet${sfx}`] ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-save" />}
          </button>
        </div>
      </form>

      {/* Credencial Umbrella */}
      <form className="mb-3" onSubmit={e => { e.preventDefault(); save(`umbrella${sfx}`, { apiKey: new FormData(e.target).get('apiKey') }); }}>
        <label className="form-label small fw-semibold text-secondary d-flex justify-content-between">
          <span><i className="bi bi-umbrella me-1" /> API Key Umbrella</span>
          <span className={`badge ${umbrellaKey ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '.62rem' }}>{umbrellaKey ? 'Configurado' : 'Vazio'}</span>
        </label>
        <div className="input-group">
          <input name="apiKey" className="form-control font-monospace" defaultValue={umbrellaKey} placeholder="x-api-key da UmbrellaPag" />
          <button className="btn-primary-custom" type="submit" disabled={loading[`umbrella${sfx}`]}>
            {loading[`umbrella${sfx}`] ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-save" />}
          </button>
        </div>
      </form>

      {/* Credencial Axxon (duas chaves) */}
      <form className="mb-3" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.target); save(`axxon${sfx}`, { publicKey: fd.get('publicKey'), secretKey: fd.get('secretKey') }); }}>
        <label className="form-label small fw-semibold text-secondary d-flex justify-content-between">
          <span><i className="bi bi-hexagon me-1" /> Credenciais Axxon</span>
          <span className={`badge ${axxonPublicKey && axxonSecretKey ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '.62rem' }}>{axxonPublicKey && axxonSecretKey ? 'Configurado' : 'Vazio'}</span>
        </label>
        <input name="publicKey" className="form-control font-monospace mb-2" defaultValue={axxonPublicKey} placeholder="axxon-gateway-publickey" />
        <div className="input-group">
          <input name="secretKey" className="form-control font-monospace" defaultValue={axxonSecretKey} placeholder="axxon-gateway-secretkey" />
          <button className="btn-primary-custom" type="submit" disabled={loading[`axxon${sfx}`]}>
            {loading[`axxon${sfx}`] ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-save" />}
          </button>
        </div>
      </form>

      {/* Token Utmify */}
      <form onSubmit={e => { e.preventDefault(); save(`utmify${sfx}`, { [`utmifyToken${sfx}`]: new FormData(e.target).get('token') }); }}>
        <label className="form-label small fw-semibold text-secondary d-flex justify-content-between">
          <span><i className="bi bi-graph-up-arrow me-1" /> Token Utmify</span>
          <span className={`badge ${utmifyToken ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '.62rem' }}>{utmifyToken ? 'Configurado' : 'Vazio'}</span>
        </label>
        <div className="input-group">
          <input name="token" className="form-control font-monospace" defaultValue={utmifyToken} placeholder="Credencial de API da Utmify" />
          <button className="btn-primary-custom" type="submit" disabled={loading[`utmify${sfx}`]}>
            {loading[`utmify${sfx}`] ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-save" />}
          </button>
        </div>
        <div className="form-text">Webhook: <code>/api/webhook/{activeGateway}{sfx}</code> → este token</div>
      </form>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState({});

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

            <EndpointCard n={1} settings={settings} save={save} loading={loading} />
            <EndpointCard n={2} settings={settings} save={save} loading={loading} />

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
                    <div className="form-text">Base dos webhooks: <code>{settings.serverBaseUrl.replace(/\/$/, '')}/api/webhook/…</code></div>
                  )}
                </div>
                <button className="btn-primary-custom" type="submit" disabled={loading.server}>
                  {loading.server ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-save" /> Salvar URL</>}
                </button>
              </form>
            </div>

            {/* RedTrack */}
            <div className="form-section mb-3">
              <div className="form-section-title"><i className="bi bi-crosshair" /> RedTrack (Postback)</div>
              <p className="text-secondary small mb-3">
                Envie <code>clickid</code> no body ao gerar o PIX. Ao gerar dispara <code>type=InitiateCheckout</code> (sum=0)
                e, quando pago, <code>type=conversion</code> (sum=valor pago).
              </p>
              <form onSubmit={e => { e.preventDefault(); save('redtrack', { redtrackPostbackUrl: new FormData(e.target).get('redtrackPostbackUrl') }); }}>
                <div className="mb-2">
                  <label className="form-label small fw-semibold text-secondary">URL base do postback</label>
                  <input name="redtrackPostbackUrl" className="form-control font-monospace" defaultValue={settings.redtrackPostbackUrl}
                    placeholder="https://kpcab.ttrk.io/postback" />
                  <div className="form-text">Sem query string — o sistema anexa <code>?clickid=…&sum=…&type=…</code></div>
                </div>
                <button className="btn-primary-custom" type="submit" disabled={loading.redtrack}>
                  {loading.redtrack ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-save" /> Salvar RedTrack</>}
                </button>
              </form>
            </div>

            {/* Axxon postback (via domínio próprio) */}
            <div className="form-section mb-3">
              <div className="form-section-title"><i className="bi bi-hexagon" /> URL de Postback Axxon <span className="badge bg-primary ms-1" style={{ fontSize: '.65rem' }}>Endpoint 1</span></div>
              <p className="text-secondary small mb-3">
                A Axxon exige o postback em domínio próprio. Informe a URL do seu domínio (ex.: <code>lojaconfort.site</code>)
                que recebe o webhook e reenvia para <code>/api/webhook/axxon</code>. Deixe vazio para usar a URL do Servidor.
              </p>
              <form onSubmit={e => { e.preventDefault(); save('axxon-postback', { axxonPostbackUrl: new FormData(e.target).get('axxonPostbackUrl') }); }}>
                <div className="mb-2">
                  <input name="axxonPostbackUrl" className="form-control font-monospace" defaultValue={settings.axxonPostbackUrl}
                    placeholder="https://lojaconfort.site/webhook/" />
                  <div className="form-text">Enviado como <code>postbackUrl</code> só nas transações Axxon do endpoint 1.</div>
                </div>
                <button className="btn-primary-custom" type="submit" disabled={loading['axxon-postback']}>
                  {loading['axxon-postback'] ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-save" /> Salvar Postback Axxon</>}
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
