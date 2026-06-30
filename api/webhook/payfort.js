const { dbInsert, dbUpdate, dbSelect, addLog, sendToUtmify } = require('../_helpers');

const STATUS_BY_FIELD = {
  pending:  'pending',
  paid:     'paid',
  canceled: 'cancelled',
  refunded: 'refunded',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const p = req.body;

  // Salva webhook bruto para auditoria
  await dbInsert('webhooks', {
    id_transaction: p.transaction?.id || null,
    payload: p,
  }).catch(() => {});

  if (p.type !== 'transaction') {
    await addLog('info', 'webhook', `Evento Payfort ignorado (tipo ${p.type}): ${p.event}`, p);
    return res.status(200).json({ ok: true });
  }

  if (p.event === 'infraction') {
    await addLog('warn', 'webhook', `Infração PIX recebida: ${p.transaction?.id}`, p);
    return res.status(200).json({ ok: true });
  }

  const newStatus = p.event === 'transaction_paid'     ? 'paid'
    : p.event === 'transaction_refunded' ? 'refunded'
    : p.event === 'transaction_created'  ? 'pending'
    : STATUS_BY_FIELD[p.transaction?.status] || null;

  if (!newStatus) {
    await addLog('warn', 'webhook', `Evento Payfort não mapeado: ${p.event}`, p);
    return res.status(200).json({ ok: true, warning: `Evento não mapeado: ${p.event}` });
  }

  const txId = p.transaction?.id;
  if (!txId) {
    await addLog('warn', 'webhook', 'Webhook Payfort sem transaction.id', p);
    return res.status(200).json({ ok: true });
  }

  const rows = await dbSelect('transactions', `?id_transaction=eq.${txId}`);
  const transaction = rows[0];
  if (!transaction) {
    await addLog('warn', 'webhook', `Transação Payfort não encontrada: ${txId}`, p);
    return res.status(200).json({ ok: true, warning: 'Transação não encontrada' });
  }

  const payerInfo = p.transaction.pix?.payerInfo || {};
  const update = {
    status:       newStatus,
    updated_at:   new Date().toISOString(),
    payment_date: newStatus === 'paid' ? new Date().toISOString() : transaction.payment_date,
    payer_name:   payerInfo.name     || transaction.payer_name,
    payer_tax_id: payerInfo.document || transaction.payer_tax_id,
    paid_value:   p.transaction.amount != null ? p.transaction.amount / 100 : transaction.paid_value,
  };

  await dbUpdate('transactions', `id=eq.${transaction.id}`, update);

  await addLog('info', 'webhook',
    `Pagamento Payfort ${newStatus === 'paid' ? 'CONFIRMADO ✅' : newStatus.toUpperCase()}: pedido #${transaction.request_number}`,
    {
      idTransaction: txId,
      status:        newStatus,
      payerName:     payerInfo.name,
      payerTaxId:    payerInfo.document,
      amount:        p.transaction.amount,
    }
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
