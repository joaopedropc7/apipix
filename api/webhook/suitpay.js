const { getSB, addLog, parseSuitPayDate } = require('../_helpers');

const STATUS_MAP = {
  PAID_OUT: 'paid', PAID: 'paid', COMPLETED: 'paid',
  CANCELLED: 'cancelled', CANCELED: 'cancelled',
  EXPIRED: 'expired', PENDING: 'pending', PROCESSING: 'pending',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const p = req.body;
  const sb = getSB();

  await sb.from('webhooks').insert({ id_transaction: p.idTransaction || null, payload: p }).catch(() => {});

  const newStatus = STATUS_MAP[(p.statusTransaction || '').toUpperCase()];

  if (newStatus && (p.idTransaction || p.requestNumber)) {
    const update = {
      status:       newStatus,
      updated_at:   new Date().toISOString(),
      payment_date: parseSuitPayDate(p.paymentDate),
      payer_name:   p.payerName   || null,
      payer_tax_id: p.payerTaxId  || null,
      paid_value:   p.value       || null,
    };

    if (p.idTransaction) {
      await sb.from('transactions').update(update).eq('id_transaction', p.idTransaction);
    } else {
      await sb.from('transactions').update(update).eq('request_number', p.requestNumber);
    }

    await addLog('info', 'webhook',
      `Pagamento recebido: ${p.idTransaction || p.requestNumber} → ${newStatus}`,
      { payerName: p.payerName, value: p.value, paymentDate: p.paymentDate }
    );
  }

  res.status(200).json({ ok: true });
};
