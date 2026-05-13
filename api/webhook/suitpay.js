const { getSupabase, addLog, parseSuitPayDate } = require('../_helpers');

const STATUS_MAP = {
  PAID_OUT: 'paid', PAID: 'paid', COMPLETED: 'paid',
  CANCELLED: 'cancelled', CANCELED: 'cancelled',
  EXPIRED: 'expired', PENDING: 'pending', PROCESSING: 'pending',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const payload = req.body;
  const sb = getSupabase();

  try { await sb.from('webhooks').insert({ id_transaction: payload.idTransaction || null, payload }); } catch (_) {}

  const newStatus = STATUS_MAP[(payload.statusTransaction || '').toUpperCase()];

  if (newStatus && (payload.idTransaction || payload.requestNumber)) {
    const update = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      payment_date: parseSuitPayDate(payload.paymentDate),
      payer_name: payload.payerName || null,
      payer_tax_id: payload.payerTaxId || null,
      paid_value: payload.value || null,
    };

    if (payload.idTransaction) {
      await sb.from('transactions').update(update).eq('id_transaction', payload.idTransaction);
    } else {
      await sb.from('transactions').update(update).eq('request_number', payload.requestNumber);
    }

    await addLog(sb, 'info', 'webhook',
      `Pagamento recebido: ${payload.idTransaction || payload.requestNumber} → ${newStatus}`,
      { payerName: payload.payerName, value: payload.value, paymentDate: payload.paymentDate }
    );
  }

  res.status(200).json({ ok: true });
};
