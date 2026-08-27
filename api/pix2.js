const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { dbInsert, dbSelect, dbUpdate, getSettings, addLog, setCors, sendToUtmify, sendRedtrack } = require('./_helpers');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;
  const settings = await getSettings();
  const apiKey = req.headers['api-key'] || req.headers['x-api-key'];

  if (!settings.api_key || apiKey !== settings.api_key) {
    return res.status(401).json({ error: 'API Key inválida ou ausente. Envie no header: api-key' });
  }

  // GET /api/pix2?action=status&id=...
  if (action === 'status' && req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Informe o id: /api/pix2?action=status&id=...' });

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
      gateway:       tx.gateway,
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

  // POST /api/pix2?action=generate
  if (action === 'generate' && req.method === 'POST') {
    // Endpoint 2 — gateway e credenciais próprios, independentes do endpoint 1
    const gateway = settings.active_gateway_2 === 'umbrella' ? 'umbrella' : 'bynet';
    const gwApiKey = gateway === 'umbrella' ? settings.umbrella_api_key_2 : settings.bynet_api_key_2;

    if (!gwApiKey) {
      return res.status(503).json({ error: `API Key ${gateway === 'umbrella' ? 'Umbrella' : 'ByNet'} (endpoint 2) não configurada no painel admin` });
    }

    const body = req.body;
    if (!body.amount || !body.client?.name || !body.client?.document) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes', required: ['amount', 'client.name', 'client.document'] });
    }

    // clickid opcional (RedTrack) — normaliza e persiste em raw_request p/ o webhook usar depois
    const clickid = body.clickid || body.clickId || body.click_id || null;
    if (clickid) body.clickid = clickid;

    const document = body.client.document.replace(/\D/g, '');
    const amount   = parseFloat(body.amount);

    const WINDOW_MINUTES = 5;
    const windowSlot = Math.floor(Date.now() / (WINDOW_MINUTES * 60 * 1000));
    const dedupKey = crypto.createHash('sha256')
      .update(`pix2-${document}-${amount}-${windowSlot}`)
      .digest('hex').slice(0, 40);

    const existing = await dbSelect('transactions', `?dedup_key=eq.${dedupKey}&status=not.in.(error,generating)&limit=1`);
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
    // Webhooks dedicados ao endpoint 2 — encaminham para utmify_token_2
    const webhookPath = gateway === 'umbrella' ? '/api/webhook/umbrella2' : '/api/webhook/bynet2';
    body.callbackUrl = serverBase ? `${serverBase}${webhookPath}` : '';

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
        gateway,
        raw_request:     body,
      });
    } catch (err) {
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

    try {
      let idTransaction, paymentCode, paymentCodeBase64, data;

      // ByNet e Umbrella usam exatamente a mesma API — muda só a URL base e a key
      const baseUrl = gateway === 'umbrella'
        ? 'https://api-gateway.umbrellapag.com/api'
        : 'https://api-gateway.techbynet.com/api';
      const amountInCents = Math.round(amount * 100);
      const payload = {
        amount:        amountInCents,
        paymentMethod: 'PIX',
        pix:           { expiresInDays: 1 },
        items: [{
          title:       `Pedido ${body.requestNumber}`,
          quantity:    1,
          tangible:    false,
          unitPrice:   amountInCents,
          externalRef: body.requestNumber,
        }],
        customer: {
          name:  body.client.name,
          email: body.client.email       || undefined,
          phone: body.client.phoneNumber || undefined,
          document: {
            type:   document.length > 11 ? 'CNPJ' : 'CPF',
            number: document,
          },
        },
        postbackUrl: body.callbackUrl || undefined,
      };

      // Log da requisição: body recebido da plataforma + payload enviado ao gateway
      await addLog('info', 'api', `Enviando ao gateway (${gateway}) [pix2]: ${body.requestNumber}`, {
        url:            `${baseUrl}/user/transactions`,
        receivedBody:   body,
        gatewayPayload: payload,
      });

      const resp = await axios.post(`${baseUrl}/user/transactions`, payload, {
        headers: { 'x-api-key': gwApiKey, 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      data              = resp.data;
      idTransaction     = data.data?.id;
      paymentCode       = data.data?.qrCode || data.data?.pix?.qrcode;
      paymentCodeBase64 = null;

      await dbUpdate('transactions', `id=eq.${reserved.id}`, {
        id_transaction:      idTransaction || null,
        status:              'pending',
        payment_code:        paymentCode || null,
        payment_code_base64: paymentCodeBase64 || null,
        raw_response:        data,
      });

      await addLog('info', 'api', `QR Code gerado (${gateway}) [pix2]: ${body.requestNumber}`, { idTransaction });

      await Promise.race([
        Promise.all([
          sendToUtmify({ ...reserved, id_transaction: idTransaction }, 'waiting_payment', null, 'utmify_token_2'),
          sendRedtrack(clickid, 'InitiateCheckout', 0),
        ]),
        new Promise(resolve => setTimeout(resolve, 8000)),
      ]);

      return res.status(200).json({
        idTransaction,
        paymentCode,
        paymentCodeBase64,
        response:      'OK',
        _id:           reserved.id,
        requestNumber: body.requestNumber,
        callbackUrl:   body.callbackUrl,
      });

    } catch (err) {
      const errData = err.response?.data || { message: err.message };
      await addLog('error', 'api', `Erro ao gerar QR Code (${gateway}) [pix2]: ${body.requestNumber}`, {
        httpStatus:   err.response?.status,
        errorBody:    errData,
        errorMessage: err.message,
      });
      await dbUpdate('transactions', `id=eq.${reserved.id}`, {
        status:       'error',
        raw_response: errData,
      }).catch(() => {});
      return res.status(err.response?.status || 500).json(errData);
    }
  }

  res.status(400).json({ error: 'Action inválida. Use ?action=generate ou ?action=status' });
};
