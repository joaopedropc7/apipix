const { dbInsert, dbUpdate, dbSelect, addLog, sendToUtmify, sendRedtrack } = require('../_helpers');

// Status da Axxon → status interno
const STATUS_MAP = {
  PENDING:   'pending',
  WAITING:   'pending',
  PROCESSING:'pending',
  PAID:      'paid',
  APPROVED:  'paid',
  COMPLETED: 'paid',
  CONFIRMED: 'paid',
  FINISHED:  'paid',   // Axxon envia FINISHED (event payment.approved) ao aprovar
  SUCCEEDED: 'paid',
  SUCCESS:   'paid',
  REFUNDED:  'refunded',
  CHARGEBACK:'refunded',
  REFUSED:   'error',
  DECLINED:  'error',
  FAILED:    'error',
  CANCELLED: 'cancelled',
  CANCELED:  'cancelled',
};

module.exports = async (req, res, tokenKey = 'utmify_token') => {
  if (req.method !== 'POST') return res.status(405).end();

  const p = req.body;
  const d = p.data || {};

  await dbInsert('webhooks', {
    id_transaction: d.id || null,
    payload: p,
  }).catch(() => {});

  const txId      = d.id;
  const newStatus = STATUS_MAP[(d.status || '').toUpperCase()];

  if (!newStatus) {
    await addLog('warn', 'webhook', `Status Axxon não mapeado: ${d.status} (event ${p.event})`, p);
    return res.status(200).json({ ok: true, warning: `Status não mapeado: ${d.status}` });
  }

  if (!txId) {
    await addLog('warn', 'webhook', 'Webhook Axxon sem data.id', p);
    return res.status(200).json({ ok: true });
  }

  const rows = await dbSelect('transactions', `?id_transaction=eq.${txId}`);
  const transaction = rows[0];
  if (!transaction) {
    await addLog('warn', 'webhook', `Transação Axxon não encontrada: ${txId}`, p);
    return res.status(200).json({ ok: true, warning: 'Transação não encontrada' });
  }

  // metadata vem como string JSON — extrai o documento do pagador
  let meta = d.metadata;
  if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }
  const payerDoc = meta?.customer?.document?.number || null;

  const update = {
    status:       newStatus,
    updated_at:   new Date().toISOString(),
    payment_date: newStatus === 'paid' ? (d.confirmedAt || new Date().toISOString()) : transaction.payment_date,
    payer_name:   d.customerName || transaction.payer_name,
    payer_tax_id: payerDoc       || transaction.payer_tax_id,
    paid_value:   d.amount != null ? d.amount / 100 : transaction.paid_value,
  };

  await dbUpdate('transactions', `id=eq.${transaction.id}`, update);

  await addLog('info', 'webhook',
    `Pagamento Axxon ${newStatus === 'paid' ? 'CONFIRMADO ✅' : newStatus.toUpperCase()}: pedido #${transaction.request_number}`,
    { idTransaction: txId, status: newStatus, event: p.event, payerName: d.customerName, amount: d.amount }
  );

  if (newStatus === 'paid') {
    const fullTx = { ...transaction, ...update, raw_request: transaction.raw_request };
    // clickid salvo no raw_request ao gerar o PIX (raw_request pode vir como string)
    let raw = transaction.raw_request;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = {}; } }
    const clickid = raw?.clickid || null;
    await Promise.race([
      Promise.all([
        sendToUtmify(fullTx, 'paid', update.payment_date, tokenKey),
        sendRedtrack(clickid, 'conversion', update.paid_value),
      ]),
      new Promise(resolve => setTimeout(resolve, 8000)),
    ]);
  }

  return res.status(200).json({ ok: true, status: newStatus, transactionId: transaction.id });
};
