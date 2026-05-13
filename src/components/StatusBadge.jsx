const labels = { pending: 'Pendente', paid: 'Paga', cancelled: 'Cancelada', expired: 'Expirada', error: 'Erro' };

export default function StatusBadge({ status }) {
  return <span className={`badge-status badge-${status}`}>{labels[status] || status}</span>;
}
