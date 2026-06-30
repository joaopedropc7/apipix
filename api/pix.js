const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { dbInsert, dbSelect, dbUpdate, getSettings, addLog, setCors, sendToUtmify, getPayfortToken } = require('./_helpers');

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

  // POST /api/pix?action=generate
  if (action === 'generate' && req.method === 'POST') {
    const gateway = settings.active_gateway === 'payfort' ? 'payfort' : 'suitpay';

    if (gateway === 'suitpay' && (!settings.suitpay_ci || !settings.suitpay_cs)) {
      return res.status(503).json({ error: 'Credenciais SuitPay não configuradas no painel admin' });
    }
    if (gateway === 'payfort' && (!settings.payfort_api_key || !settings.payfort_api_secret)) {
      return res.status(503).json({ error: 'Credenciais Payfort não configuradas no painel admin' });
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

    // Dedup: ignora registros com falha (error/generating sem idTransaction) — só bloqueia se há PIX válido pendente
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
    const webhookPath = gateway === 'payfort' ? '/api/webhook/payfort' : '/api/webhook/suitpay';
    body.callbackUrl = serverBase ? `${serverBase}${webhookPath}` : '';

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
        gateway,
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

    try {
      let idTransaction, paymentCode, paymentCodeBase64, data;

      if (gateway === 'payfort') {
        const token = await getPayfortToken(settings);
        const payload = {
          amountInCents: Math.round(amount * 100),
          description:   `Pedido ${body.requestNumber}`.slice(0, 140),
          postbackUrl:   body.callbackUrl || undefined,
          customer: {
            name:         body.client.name,
            email:        body.client.email || undefined,
            documentType: document.length > 11 ? 'cnpj' : 'cpf',
            document,
            phone:        body.client.phoneNumber || undefined,
          },
        };
        const resp = await axios.post('https://api.payfortbank.com/api/v1/pix/in/qrcode', payload, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 30000,
        });
        data = resp.data;
        idTransaction     = data.data?.id;
        paymentCode       = data.data?.pix?.emv;
        paymentCodeBase64 = data.data?.pix?.qrCode;
      } else {
        const baseUrl = settings.suitpay_environment === 'production'
          ? 'https://ws.suitpay.app'
          : 'https://sandbox.ws.suitpay.app';
        const resp = await axios.post(`${baseUrl}/api/v1/gateway/request-qrcode`, body, {
          headers: { ci: settings.suitpay_ci, cs: settings.suitpay_cs, 'Content-Type': 'application/json' },
          timeout: 30000,
        });
        data = resp.data;
        idTransaction     = data.idTransaction;
        paymentCode       = data.paymentCode;
        paymentCodeBase64 = data.paymentCodeBase64;
      }

      // Atualiza o registro reservado com os dados reais do gateway
      await dbUpdate('transactions', `id=eq.${reserved.id}`, {
        id_transaction:      idTransaction || null,
        status:              'pending',
        payment_code:        paymentCode || null,
        payment_code_base64: paymentCodeBase64 || null,
        raw_response:        data,
      });

      // fire-and-forget: não bloqueiam a resposta ao cliente
      addLog('info', 'api', `QR Code gerado (${gateway}): ${body.requestNumber}`, { idTransaction });
      sendToUtmify({ ...reserved, id_transaction: idTransaction }, 'waiting_payment', null);

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
      await addLog('error', 'api', `Erro ao gerar QR Code (${gateway}): ${body.requestNumber}`, {
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
