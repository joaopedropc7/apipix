const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { dbInsert, dbSelect, dbUpdate, getSettings, addLog, setCors, sendToUtmify } = require('./_helpers');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;
  const settings = await getSettings();
  const apiKey = req.headers['api-key'] || req.headers['x-api-key'];

  if (!settings.api_key || apiKey !== settings.api_key) {
    return res.status(401).json({ error: 'API Key inválida ou ausente. Envie no header: api-key' });
  }

  // GET /api/pix?action=status&id=...
  if (action === 'status' && req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Informe o id: /api/pix?action=status&id=...' });

    const [byId, byIdTransaction, byRequestNumber] = await Promise.all([
      dbSelect('transactions', `?id=eq.${id}&limit=1`),
      dbSelect('transactions', `?id_transaction=eq.${id}&limit=1`),
      dbSelect('transactions', `?request_number=eq.${id}&limit=1`),
    ]);

    const tx = byId[0] || byIdTransaction[0] || byRequestNumber[0];
    if (!tx) return res.status(404).json({ error: 'Transação não encontrada' });

    return res.status(200).json({
      id:            tx.id,
      requestNumber: tx.request_number,
      idTransaction: tx.id_transaction,
      status:        tx.status,
      amount:        tx.amount,
      dueDate:       tx.due_date,
      paymentCode:   tx.payment_code,
      paymentDate:   tx.payment_date,
      paidValue:     tx.paid_value,
      payerName:     tx.payer_name,
      payerTaxId:    tx.payer_tax_id,
      createdAt:     tx.created_at,
      updatedAt:     tx.updated_at,
    });
  }

  // POST /api/pix?action=generate
  if (action === 'generate' && req.method === 'POST') {
    if (!settings.suitpay_ci || !settings.suitpay_cs) {
      return res.status(503).json({ error: 'Credenciais SuitPay não configuradas no painel admin' });
    }

    const body = req.body;
    if (!body.amount || !body.client?.name || !body.client?.document) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes', required: ['amount', 'client.name', 'client.document'] });
    }

    const document = body.client.document.replace(/\D/g, '');
    const amount   = parseFloat(body.amount);

    // Gera dedup_key baseada em janela de 5 minutos — muda a cada 5 min
    const WINDOW_MINUTES = 5;
    const windowSlot = Math.floor(Date.now() / (WINDOW_MINUTES * 60 * 1000));
    const dedupKey = crypto.createHash('sha256')
      .update(`${document}-${amount}-${windowSlot}`)
      .digest('hex').slice(0, 40);

    // Verifica se já existe PIX com essa dedup_key (caso normal ou race condition já resolvida)
    const existing = await dbSelect('transactions', `?dedup_key=eq.${dedupKey}&limit=1`);
    if (existing.length > 0) {
      const dup = existing[0];
      return res.status(200).json({
        idTransaction:     dup.id_transaction,
        paymentCode:       dup.payment_code,
        paymentCodeBase64: dup.payment_code_base64,
        response:          'OK',
        _id:               dup.id,
        requestNumber:     dup.request_number,
        callbackUrl:       dup.callback_url,
        _duplicate:        true,
      });
    }

    body.requestNumber = uuidv4().replace(/-/g, '').slice(0, 16);
    if (!body.dueDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      body.dueDate = tomorrow.toISOString().slice(0, 10);
    }

    const serverBase = settings.server_base_url?.trim().replace(/\/$/, '');
    body.callbackUrl = serverBase ? `${serverBase}/api/webhook/suitpay` : '';

    // Reserva o slot no banco com dedup_key — bloqueia race condition no nível do PostgreSQL
    let reserved;
    try {
      reserved = await dbInsert('transactions', {
        request_number:  body.requestNumber,
        dedup_key:       dedupKey,
        amount,
        shipping_amount: parseFloat(body.shippingAmount) || 0,
        discount_amount: parseFloat(body.discountAmount) || 0,
        client_name:     body.client.name,
        client_document: document,
        client_email:    body.client.email    || null,
        client_phone:    body.client.phoneNumber || null,
        due_date:        body.dueDate,
        status:          'generating',
        callback_url:    body.callbackUrl || null,
        username_checkout: body.usernameCheckout || null,
        raw_request:     body,
      });
    } catch (err) {
      // Unique constraint violada — outra requisição simultânea ganhou a corrida
      if (err.response?.status === 409 || err.response?.data?.code === '23505') {
        const rows = await dbSelect('transactions', `?dedup_key=eq.${dedupKey}&limit=1`);
        if (rows.length > 0) {
          const dup = rows[0];
          return res.status(200).json({
            idTransaction:     dup.id_transaction,
            paymentCode:       dup.payment_code,
            paymentCodeBase64: dup.payment_code_base64,
            response:          'OK',
            _id:               dup.id,
            requestNumber:     dup.request_number,
            callbackUrl:       dup.callback_url,
            _duplicate:        true,
          });
        }
      }
      throw err;
    }

    const baseUrl = settings.suitpay_environment === 'production'
      ? 'https://ws.suitpay.app'
      : 'https://sandbox.ws.suitpay.app';

    try {
      const { data } = await axios.post(`${baseUrl}/api/v1/gateway/request-qrcode`, body, {
        headers: { ci: settings.suitpay_ci, cs: settings.suitpay_cs, 'Content-Type': 'application/json' },
        timeout: 30000,
      });

      // Atualiza o registro reservado com os dados reais do SuitPay
      await dbUpdate('transactions', `id=eq.${reserved.id}`, {
        id_transaction:      data.idTransaction || null,
        status:              'pending',
        payment_code:        data.paymentCode || null,
        payment_code_base64: data.paymentCodeBase64 || null,
        raw_response:        data,
      });

      await addLog('info', 'api', `QR Code gerado: ${body.requestNumber}`, { idTransaction: data.idTransaction });
      await sendToUtmify({ ...reserved, id_transaction: data.idTransaction }, 'waiting_payment', null);

      return res.status(200).json({
        ...data,
        _id:           reserved.id,
        requestNumber: body.requestNumber,
        callbackUrl:   body.callbackUrl,
      });

    } catch (err) {
      const errData = err.response?.data || { message: err.message };
      await addLog('error', 'api', `Erro ao gerar QR Code: ${body.requestNumber}`, errData);
      await dbUpdate('transactions', `id=eq.${reserved.id}`, {
        status:       'error',
        raw_response: errData,
      }).catch(() => {});
      return res.status(err.response?.status || 500).json(errData);
    }
  }

  res.status(400).json({ error: 'Action inválida. Use ?action=generate ou ?action=status' });
};
