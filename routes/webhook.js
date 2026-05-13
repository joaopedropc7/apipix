const express = require('express');
const router = express.Router();
const { getSupabase } = require('../db/supabase');
const { addLog } = require('../utils/helpers');

// SuitPay envia data no formato "DD/MM/YYYY HH:MM:SS"
function parseSuitPayDate(dateStr) {
  if (!dateStr) return null;
  try {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    return new Date(`${year}-${month}-${day}T${timePart}`).toISOString();
  } catch (_) {
    return null;
  }
}

const STATUS_MAP = {
  'PAID_OUT':   'paid',
  'PAID':       'paid',
  'COMPLETED':  'paid',
  'CANCELLED':  'cancelled',
  'CANCELED':   'cancelled',
  'EXPIRED':    'expired',
  'PENDING':    'pending',
  'PROCESSING': 'pending',
};

router.post('/webhook/suitpay', async (req, res) => {
  const payload = req.body;
  const sb = getSupabase();

  // Salva webhook bruto
  if (sb) {
    await sb.from('webhooks').insert({
      id_transaction: payload.idTransaction || null,
      payload,
    }).catch(() => {});
  }

  const idTransaction  = payload.idTransaction;
  const requestNumber  = payload.requestNumber;
  const rawStatus      = payload.statusTransaction || payload.status || '';
  const newStatus      = STATUS_MAP[rawStatus.toUpperCase()] || null;

  if (sb && newStatus && (idTransaction || requestNumber)) {
    const update = {
      status:      newStatus,
      updated_at:  new Date().toISOString(),
      payment_date: parseSuitPayDate(payload.paymentDate),
      payer_name:   payload.payerName   || null,
      payer_tax_id: payload.payerTaxId  || null,
      paid_value:   payload.value       || null,
    };

    // Tenta atualizar por idTransaction primeiro, depois por requestNumber
    if (idTransaction) {
      await sb.from('transactions').update(update).eq('id_transaction', idTransaction);
    } else if (requestNumber) {
      await sb.from('transactions').update(update).eq('request_number', requestNumber);
    }

    addLog('info', 'webhook',
      `Pagamento recebido: ${idTransaction || requestNumber} → ${newStatus}`,
      {
        payerName:   payload.payerName,
        payerTaxId:  payload.payerTaxId,
        value:       payload.value,
        paymentDate: payload.paymentDate,
        channel:     payload.channel,
      }
    );
  }

  res.status(200).json({ ok: true });
});

module.exports = router;
