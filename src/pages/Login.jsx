import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/dashboard');
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Servidor demorou para responder. Tente novamente.');
      } else {
        setError(err.response?.data?.error || 'Erro ao conectar com o servidor.');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="text-center mb-4">
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '.875rem' }}>
            <i className="bi bi-qr-code-scan text-white" style={{ fontSize: '1.75rem' }} />
          </div>
          <h5 className="fw-bold mb-0" style={{ color: '#1e1b4b' }}>PIX Admin</h5>
          <p className="text-muted small">Painel de Gerenciamento</p>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-3" style={{ borderRadius: '.75rem', border: 'none' }}>
            <i className="bi bi-exclamation-triangle-fill" />{error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label fw-semibold text-secondary small">Usuário</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-person" /></span>
              <input className="form-control" placeholder="admin" value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
            </div>
          </div>
          <div className="mb-4">
            <label className="form-label fw-semibold text-secondary small">Senha</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-lock" /></span>
              <input className="form-control" type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
              <button className="btn btn-outline-secondary" type="button" onClick={() => setShowPwd(v => !v)}>
                <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
          </div>
          <button className="btn-primary-custom w-100 justify-content-center" type="submit" disabled={loading}>
            {loading ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-box-arrow-in-right" /> Entrar</>}
          </button>
        </form>
        <p className="text-center text-muted mt-3 mb-0" style={{ fontSize: '.75rem' }}>PIX Admin v2.0 · SuitPay Integration</p>
      </div>
    </div>
  );
}
