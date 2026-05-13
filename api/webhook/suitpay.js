const { dbInsert, dbUpdate, addLog, parseSuitPayDate } = require('../_helpers');

const STATUS_MAP = {
  PAID_OUT: 'paid', PAID: 'paid', COMPLETED: 'paid',
  CANCELLED: 'cancelled', CANCELED: 'cancelled',
  EXPIRED: 'expired', PENDING: 'pending', PROCESSING: 'pending',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const p = req.body;

  await dbInsert('webhooks', { id_transaction: p.idTransaction || null, payload: p }).catch(() => {});

  const newStatus = STATUS_MAP[(p.statusTransaction || '').toUpperCase()];

  if (newStatus && (p.idTransaction || p.requestNumber)) {
    const update = {
      status: newStatus, updated_at: new Date().toISOString(),
      payment_date: parseSuitPayDate(p.paymentDate),
      payer_name: p.payerName || null, payer_tax_id: p.payerTaxId || null,
      paid_value: p.value || null,
    };

    const filter = p.idTransaction
      ? `id_transaction=eq.${p.idTransaction}`
      : `request_number=eq.${p.requestNumber}`;

    await dbUpdate('transactions', filter, update);
    await addLog('info', 'webhook',
      `Pagamento: ${p.idTransaction || p.requestNumber} → ${newStatus}`,
      { payerName: p.payerName, value: p.value, paymentDate: p.paymentDate }
    );
  }

  res.status(200).json({ ok: true });
};
