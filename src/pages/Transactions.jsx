import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getTransactions } from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ transactions: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get('page') || '1');
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    getTransactions({ page, status, search, limit })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [page, status, search]);

  const pages = Math.ceil(data.total / limit);

  const setFilter = (key, val) => {
    const p = new URLSearchParams(searchParams);
    p.set(key, val); p.set('page', '1');
    if (!val) p.delete(key);
    setSearchParams(p);
  };

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">Transações</div>
          <div className="page-sub">{data.total} transação(ões) encontrada(s)</div>
        </div>
        <Link to="/transactions/new" className="btn-primary-custom">
          <i className="bi bi-plus-lg" /> Nova Transação
        </Link>
      </div>

      <div className="content-area">
        <div className="card-panel mb-3">
          <div className="card-panel-body">
            <div className="row g-2 align-items-end">
              <div className="col-md-5">
                <input className="form-control" placeholder="Buscar por nome, CPF ou pedido..." defaultValue={search}
                  onKeyDown={e => e.key === 'Enter' && setFilter('search', e.target.value)} />
              </div>
              <div className="col-md-3">
                <select className="form-select" value={status} onChange={e => setFilter('status', e.target.value)}>
                  <option value="">Todos os status</option>
                  <option value="pending">Pendente</option>
                  <option value="paid">Paga</option>
                  <option value="cancelled">Cancelada</option>
                  <option value="expired">Expirada</option>
                  <option value="error">Erro</option>
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
                <thead>
                  <tr><th>Pedido</th><th>ID SuitPay</th><th>Cliente</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Criado em</th><th></th></tr>
                </thead>
                <tbody>
                  {data.transactions.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-muted py-5">
                      <i className="bi bi-inbox d-block mb-2" style={{ fontSize: '2rem', opacity: .3 }} />Nenhuma transação encontrada
                    </td></tr>
                  )}
                  {data.transactions.map(tx => (
                    <tr key={tx.id}>
                      <td><span className="fw-semibold">#{tx.request_number}</span></td>
                      <td className="text-muted" style={{ fontSize: '.78rem' }}>{tx.id_transaction?.slice(0, 8) || '-'}…</td>
                      <td>
                        <div className="fw-medium">{tx.client_name}</div>
                        <div className="text-muted" style={{ fontSize: '.75rem' }}>{tx.client_document}</div>
                      </td>
                      <td className="fw-semibold">R$ {(tx.amount || 0).toFixed(2).replace('.', ',')}</td>
                      <td className="text-muted">{tx.due_date}</td>
                      <td><StatusBadge status={tx.status} /></td>
                      <td className="text-muted" style={{ fontSize: '.78rem' }}>
                        {tx.created_at ? new Date(tx.created_at).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td>
                        <Link to={`/transactions/${tx.id}`} className="btn btn-sm btn-light"><i className="bi bi-eye" /></Link>
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
    </>
  );
}
