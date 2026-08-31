const { dbSelect, dbUpdate, addLog, authenticate, setCors, sendToUtmify, sendRedtrack } = require('../_helpers');

// Reprocessa APENAS pagamentos da Axxon que chegaram com status "FINISHED"
// (event payment.approved) e não foram enviados à Utmify por o status não ser
// mapeado na época. Não toca em pendentes, gerados ou de outros gateways.
//
// GET /api/admin/reprocess            → processa e reenvia
// GET /api/admin/reprocess?dry=1      → apenas simula (não altera nada nem envia)
// GET /api/admin/reprocess?limit=3000 → quantos webhooks recentes varrer (default 2000)

// Endpoint 2 usa webhooks terminados em "2" (bynet2/umbrella2/axxon2) → utmify_token_2
function tokenKeyFromCallback(callbackUrl) {
  const clean = (callbackUrl || '').replace(/\/$/, '');
  return /2$/.test(clean) ? 'utmify_token_2' : 'utmify_token';
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!authenticate(req, res)) return;

  const dry   = req.query.dry === '1' || req.query.dry === 'true';
  const limit = Math.min(parseInt(req.query.limit) || 2000, 5000);

  try {
    // Webhooks mais recentes primeiro
    const hooks = await dbSelect('webhooks', `?select=*&order=id.desc&limit=${limit}`);

    // Filtra ESTRITAMENTE webhooks da Axxon com status FINISHED (pagamento aprovado)
    const approved = hooks.filter(h => {
      const p = h.payload || {};
      return (p.data?.status || '').toUpperCase() === 'FINISHED';
    });

    // Deduplica por id da transação (mantém o mais recente, já ordenado desc)
    const seen = new Set();
    const unique = [];
    for (const h of approved) {
      const txId = h.id_transaction || h.payload?.data?.id;
      if (!txId || seen.has(txId)) continue;
      seen.add(txId);
      unique.push({ txId, payload: h.payload });
    }

    const result = { scanned: hooks.length, approvedWebhooks: approved.length, uniqueTx: unique.length, processed: [], skipped: [] };

    for (const { txId, payload } of unique) {
      const rows = await dbSelect('transactions', `?id_transaction=eq.${txId}&limit=1`);
      const tx = rows[0];
      if (!tx) { result.skipped.push({ txId, reason: 'transação não encontrada' }); continue; }
      if (tx.gateway !== 'axxon') { result.skipped.push({ txId, reason: `gateway ${tx.gateway} (não é axxon)` }); continue; }

      const d = payload?.data || {};
      let meta = d.metadata;
      if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }
      const payerDoc = meta?.customer?.document?.number || null;

      const paymentDate = d.confirmedAt || tx.payment_date || new Date().toISOString();
      const paidValue   = d.amount != null ? d.amount / 100 : tx.paid_value;
      const alreadyPaid = tx.status === 'paid';

      if (dry) {
        result.processed.push({ txId, requestNumber: tx.request_number, alreadyPaid, wouldSendUtmify: true, paidValue });
        continue;
      }

      const update = {
        status:       'paid',
        updated_at:   new Date().toISOString(),
        payment_date: paymentDate,
        payer_name:   d.customerName || tx.payer_name,
        payer_tax_id: payerDoc       || tx.payer_tax_id,
        paid_value:   paidValue,
      };
      await dbUpdate('transactions', `id=eq.${tx.id}`, update);

      const tokenKey = tokenKeyFromCallback(tx.callback_url);
      let raw = tx.raw_request;
      if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = {}; } }
      const clickid = raw?.clickid || null;

      const fullTx = { ...tx, ...update };
      await Promise.race([
        Promise.all([
          sendToUtmify(fullTx, 'paid', paymentDate, tokenKey),
          sendRedtrack(clickid, 'conversion', paidValue),
        ]),
        new Promise(resolve => setTimeout(resolve, 9000)),
      ]);

      await addLog('info', 'reprocess', `Reprocessado pago: pedido #${tx.request_number}`, { txId, tokenKey, alreadyPaid, paidValue });
      result.processed.push({ txId, requestNumber: tx.request_number, alreadyPaid, tokenKey, paidValue });
    }

    return res.status(200).json({ ok: true, dry, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
