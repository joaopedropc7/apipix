import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { getDashboard } from '../api/client';
import StatusBadge from '../components/StatusBadge';

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip);

const fmt = v => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => { getDashboard().then(r => setData(r.data)); }, []);

  if (!data) return <div className="page-loader"><div className="spinner-border text-primary" /></div>;

  const { stats, recent, chart } = data;

  const statCards = [
    { label: 'Total de Transações', value: stats.total, icon: 'bi-arrow-left-right', cls: 'purple' },
    { label: 'Pendentes', value: stats.pending, icon: 'bi-hourglass-split', cls: 'yellow' },
    { label: 'Pagas', value: stats.paid, icon: 'bi-check-circle', cls: 'green' },
    { label: 'Canceladas/Expiradas', value: stats.cancelled, icon: 'bi-x-circle', cls: 'red' },
  ];

  return (
    <>
      <div className="top-bar">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Visão geral das transações PIX</div>
        </div>
        <Link to="/transactions/new" className="btn-primary-custom">
          <i className="bi bi-plus-lg" /> Nova Transação
        </Link>
      </div>

      <div className="content-area">
        <div className="row g-3 mb-3">
          {statCards.map(c => (
            <div key={c.label} className="col-6 col-lg-3">
              <div className="stat-card">
                <div className={`stat-icon ${c.cls}`}><i className={`bi ${c.icon}`} /></div>
                <div>
                  <div className="stat-value">{c.value}</div>
                  <div className="stat-label">{c.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="row g-3 mb-3">
          {[
            { label: 'Volume Total', value: fmt(stats.totalAmount), cls: 'blue', icon: 'bi-cash-stack' },
            { label: 'Volume Recebido', value: fmt(stats.paidAmount), cls: 'green', icon: 'bi-wallet2' },
            { label: 'Volume Pendente', value: fmt(stats.pendingAmount), cls: 'yellow', icon: 'bi-clock' },
          ].map(c => (
            <div key={c.label} className="col-md-4">
              <div className="stat-card">
                <div className={`stat-icon ${c.cls}`}><i className={`bi ${c.icon}`} /></div>
                <div>
                  <div className="stat-value" style={{ fontSize: '1.15rem' }}>{c.value}</div>
                  <div className="stat-label">{c.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="row g-3">
          <div className="col-lg-7">
            <div className="card-panel">
              <div className="card-panel-header">
                <span className="card-panel-title"><i className="bi bi-bar-chart-line me-2 text-primary" />Últimos 7 dias</span>
              </div>
              <div className="card-panel-body">
                <Bar
                  data={{
                    labels: chart.length ? chart.map(r => r.day) : ['Sem dados'],
                    datasets: [{ label: 'Transações', data: chart.length ? chart.map(r => r.count) : [0], backgroundColor: 'rgba(79,70,229,.7)', borderRadius: 6, borderSkipped: false }],
                  }}
                  options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } }}
                />
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="card-panel h-100">
              <div className="card-panel-header">
                <span className="card-panel-title"><i className="bi bi-clock-history me-2 text-primary" />Recentes</span>
                <Link to="/transactions" className="btn-outline-custom" style={{ fontSize: '.78rem', padding: '.25rem .65rem' }}>Ver Todas</Link>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead><tr><th>Pedido</th><th>Cliente</th><th>Valor</th><th>Status</th></tr></thead>
                  <tbody>
                    {recent.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-4">Nenhuma transação ainda</td></tr>}
                    {recent.map(tx => (
                      <tr key={tx.id}>
                        <td><Link to={`/transactions/${tx.id}`} className="text-decoration-none fw-semibold">#{tx.request_number}</Link></td>
                        <td className="text-muted" style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.client_name}</td>
                        <td className="fw-semibold">{fmt(tx.amount)}</td>
                        <td><StatusBadge status={tx.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
