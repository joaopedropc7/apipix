const { dbInsert, dbUpdate, dbSelect, addLog, parseSuitPayDate } = require('../_helpers');

const STATUS_MAP = {
  PAID_OUT:   'paid',
  PAID:       'paid',
  COMPLETED:  'paid',
  CANCELLED:  'cancelled',
  CANCELED:   'cancelled',
  EXPIRED:    'expired',
  PENDING:    'pending',
  PROCESSING: 'pending',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const p = req.body;

  // Salva webhook bruto para auditoria
  await dbInsert('webhooks', {
    id_transaction: p.idTransaction || null,
    payload: p,
  }).catch(() => {});

  const newStatus = STATUS_MAP[(p.statusTransaction || '').toUpperCase()];

  if (!newStatus) {
    await addLog('warn', 'webhook', `Status desconhecido recebido: ${p.statusTransaction}`, p);
    return res.status(200).json({ ok: true, warning: `Status não mapeado: ${p.statusTransaction}` });
  }

  // Localiza transação por idTransaction ou requestNumber
  let transaction = null;
  if (p.idTransaction) {
    const rows = await dbSelect('transactions', `?id_transaction=eq.${p.idTransaction}`);
    transaction = rows[0] || null;
  }
  if (!transaction && p.requestNumber) {
    const rows = await dbSelect('transactions', `?request_number=eq.${p.requestNumber}`);
    transaction = rows[0] || null;
  }

  if (!transaction) {
    await addLog('warn', 'webhook', `Transação não encontrada: ${p.idTransaction || p.requestNumber}`, p);
    return res.status(200).json({ ok: true, warning: 'Transação não encontrada' });
  }

  // Monta atualização completa
  const update = {
    status:       newStatus,
    updated_at:   new Date().toISOString(),
    payment_date: parseSuitPayDate(p.paymentDate) || null,
    payer_name:   p.payerName   || null,
    payer_tax_id: p.payerTaxId  || null,
    paid_value:   p.value != null ? parseFloat(p.value) : null,
  };

  await dbUpdate('transactions', `id=eq.${transaction.id}`, update);

  await addLog('info', 'webhook',
    `Pagamento ${newStatus === 'paid' ? 'CONFIRMADO ✅' : newStatus.toUpperCase()}: pedido #${transaction.request_number}`,
    {
      idTransaction: p.idTransaction,
      requestNumber: p.requestNumber,
      status:        newStatus,
      payerName:     p.payerName,
      payerTaxId:    p.payerTaxId,
      value:         p.value,
      paymentDate:   p.paymentDate,
    }
  );

  return res.status(200).json({ ok: true, status: newStatus, transactionId: transaction.id });
};
