const { dbInsert, dbUpdate, dbSelect, addLog, sendToUtmify } = require('../_helpers');

const STATUS_MAP = {
  paid:            'paid',
  waiting_payment: 'pending',
  refunded:        'refunded',
  refused:         'error',
  cancelled:       'cancelled',
  canceled:        'cancelled',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const p = req.body;

  await dbInsert('webhooks', {
    id_transaction: p.objectId || p.data?.id || null,
    payload: p,
  }).catch(() => {});

  if (p.type !== 'transaction') {
    await addLog('info', 'webhook', `Evento ByNet ignorado (tipo ${p.type})`, p);
    return res.status(200).json({ ok: true });
  }

  const txId     = p.objectId || p.data?.id;
  const status   = (p.data?.status || '').toLowerCase();
  const newStatus = STATUS_MAP[status];

  if (!newStatus) {
    await addLog('warn', 'webhook', `Status ByNet não mapeado: ${status}`, p);
    return res.status(200).json({ ok: true, warning: `Status não mapeado: ${status}` });
  }

  if (!txId) {
    await addLog('warn', 'webhook', 'Webhook ByNet sem objectId/data.id', p);
    return res.status(200).json({ ok: true });
  }

  const rows = await dbSelect('transactions', `?id_transaction=eq.${txId}`);
  const transaction = rows[0];
  if (!transaction) {
    await addLog('warn', 'webhook', `Transação ByNet não encontrada: ${txId}`, p);
    return res.status(200).json({ ok: true, warning: 'Transação não encontrada' });
  }

  const payer  = p.data?.payer || {};
  const update = {
    status:       newStatus,
    updated_at:   new Date().toISOString(),
    payment_date: newStatus === 'paid' ? (p.data?.paidAt || new Date().toISOString()) : transaction.payment_date,
    payer_name:   payer.name     || transaction.payer_name,
    payer_tax_id: payer.documentNumber || transaction.payer_tax_id,
    paid_value:   p.data?.amount != null ? p.data.amount / 100 : transaction.paid_value,
  };

  await dbUpdate('transactions', `id=eq.${transaction.id}`, update);

  await addLog('info', 'webhook',
    `Pagamento ByNet ${newStatus === 'paid' ? 'CONFIRMADO ✅' : newStatus.toUpperCase()}: pedido #${transaction.request_number}`,
    { idTransaction: txId, status: newStatus, payerName: payer.name, amount: p.data?.amount }
  );

  if (newStatus === 'paid') {
    const fullTx = { ...transaction, ...update, raw_request: transaction.raw_request };
    await Promise.race([
      sendToUtmify(fullTx, 'paid', update.payment_date),
      new Promise(resolve => setTimeout(resolve, 8000)),
    ]);
  }

  return res.status(200).json({ ok: true, status: newStatus, transactionId: transaction.id });
};
