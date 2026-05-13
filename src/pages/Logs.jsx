import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLogs, clearLogs } from '../api/client';

export default function Logs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ logs: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const page = parseInt(searchParams.get('page') || '1');
  const level = searchParams.get('level') || '';
  const type = searchParams.get('type') || '';

  const load = () => {
    setLoading(true);
    getLogs({ page, level, type, limit: 50 })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, level, type]);

  const setFilter = (key, val) => {
    const p = new URLSearchParams(searchParams);
    val ? p.set(key, val) : p.delete(key);
    p.set('page', '1');
    setSearchParams(p);
  };

  const handleClear = async () => {
    if (!confirm('Remover logs com mais de 30 dias?')) return;
    await clearLogs();
    load();
  };

  const levelClass = l => l === 'info' ? 'badge-paid' : l === 'warn' ? 'badge-pending' : 'badge-error';
  const levelLabel = l => l === 'info' ? 'INFO' : l === 'warn' ? 'AVISO' : 'ERRO';

  const pages = Math.ceil(data.total / 50);

  return (
    <>
      <div className="top-bar">
        <div><div className="page-title">Logs do Sistema</div><div className="page-sub">{data.total} registro(s)</div></div>
        <button className="btn btn-sm btn-outline-danger" onClick={handleClear}>
          <i className="bi bi-trash me-1" />Limpar antigos
        </button>
      </div>

      <div className="content-area">
        <div className="card-panel mb-3">
          <div className="card-panel-body">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <select className="form-select" value={level} onChange={e => setFilter('level', e.target.value)}>
                  <option value="">Todos os níveis</option>
                  <option value="info">Info</option>
                  <option value="warn">Aviso</option>
                  <option value="error">Erro</option>
                </select>
              </div>
              <div className="col-md-4">
                <select className="form-select" value={type} onChange={e => setFilter('type', e.target.value)}>
                  <option value="">Todos os tipos</option>
                  <option value="auth">Auth</option>
                  <option value="transaction">Transação</option>
                  <option value="api">API</option>
                  <option value="webhook">Webhook</option>
                  <option value="settings">Configurações</option>
                </select>
              </div>
              <div className="col-md-2">
                <button className="btn-outline-custom w-100" onClick={() => setSearchParams({})}>Limpar</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card-panel">
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
            ) : (
              <table className="admin-table">
                <thead><tr><th>Nível</th><th>Tipo</th><th>Mensagem</th><th>Data/Hora</th><th></th></tr></thead>
                <tbody>
                  {data.logs.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-muted py-5">
                      <i className="bi bi-terminal d-block mb-2" style={{ fontSize: '2rem', opacity: .3 }} />Nenhum log encontrado
                    </td></tr>
                  )}
                  {data.logs.map(log => (
                    <tr key={log.id}>
                      <td><span className={`badge-status ${levelClass(log.level)}`} style={{ fontSize: '.68rem' }}>{levelLabel(log.level)}</span></td>
                      <td><code style={{ fontSize: '.78rem' }}>{log.type}</code></td>
                      <td style={{ fontSize: '.875rem' }}>{log.message}</td>
                      <td className="text-muted" style={{ fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td>
                        {log.details && (
                          <button className="btn btn-sm btn-light" onClick={() => setDetail(log.details)}>
                            <i className="bi bi-code" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pages > 1 && (
            <div className="d-flex justify-content-center gap-1 p-3">
              {page > 1 && <button className="btn btn-sm btn-light" onClick={() => setFilter('page', page - 1)}><i className="bi bi-chevron-left" /></button>}
              {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                const p = Math.max(1, page - 2) + i;
                return p <= pages && <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-light'}`} onClick={() => setFilter('page', p)}>{p}</button>;
              })}
              {page < pages && <button className="btn btn-sm btn-light" onClick={() => setFilter('page', page + 1)}><i className="bi bi-chevron-right" /></button>}
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,.5)' }} onClick={() => setDetail(null)}>
          <div className="modal-dialog modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4">
              <div className="modal-header border-0">
                <h6 className="modal-title fw-bold">Detalhes do Log</h6>
                <button className="btn-close" onClick={() => setDetail(null)} />
              </div>
              <div className="modal-body">
                <pre className="bg-light p-3 rounded m-0" style={{ fontSize: '.78rem', maxHeight: 400, overflow: 'auto' }}>
                  {JSON.stringify(detail, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
