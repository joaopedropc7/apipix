const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { dbInsert, dbSelect, getSettings, addLog, setCors, sendToUtmify } = require('./_helpers');

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

    // Validação de duplicidade: mesmo documento + mesmo valor com PIX pendente nos últimos 5 min
    const DUPLICATE_WINDOW_MINUTES = 5;
    const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString();
    const document = body.client.document.replace(/\D/g, '');
    const amount = parseFloat(body.amount);

    const recent = await dbSelect('transactions',
      `?client_document=eq.${document}&amount=eq.${amount}&status=eq.pending&created_at=gte.${windowStart}&limit=1`
    );

    if (recent.length > 0) {
      const dup = recent[0];
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

    const baseUrl = settings.suitpay_environment === 'production'
      ? 'https://ws.suitpay.app'
      : 'https://sandbox.ws.suitpay.app';

    try {
      const { data } = await axios.post(`${baseUrl}/api/v1/gateway/request-qrcode`, body, {
        headers: { ci: settings.suitpay_ci, cs: settings.suitpay_cs, 'Content-Type': 'application/json' },
        timeout: 30000,
      });

      const inserted = await dbInsert('transactions', {
        request_number: body.requestNumber, id_transaction: data.idTransaction || null,
        amount: parseFloat(body.amount), shipping_amount: parseFloat(body.shippingAmount) || 0,
        discount_amount: parseFloat(body.discountAmount) || 0,
        client_name: body.client.name, client_document: document,
        client_email: body.client.email || null, client_phone: body.client.phoneNumber || null,
        due_date: body.dueDate, status: 'pending',
        payment_code: data.paymentCode || null, payment_code_base64: data.paymentCodeBase64 || null,
        callback_url: body.callbackUrl || null, username_checkout: body.usernameCheckout || null,
        raw_request: body, raw_response: data,
      });

      await addLog('info', 'api', `QR Code gerado: ${body.requestNumber}`, { idTransaction: data.idTransaction, callbackUrl: body.callbackUrl });
      await sendToUtmify(inserted, 'waiting_payment', null);

      return res.status(200).json({ ...data, _id: inserted?.id, requestNumber: body.requestNumber, callbackUrl: body.callbackUrl });

    } catch (err) {
      const errData = err.response?.data || { message: err.message };
      await addLog('error', 'api', `Erro ao gerar QR Code: ${body.requestNumber}`, errData);
      await dbInsert('transactions', {
        request_number: body.requestNumber, amount: parseFloat(body.amount) || 0,
        client_name: body.client?.name || 'N/A', client_document: document,
        due_date: body.dueDate || '', status: 'error', raw_request: body, raw_response: errData,
      }).catch(() => {});
      return res.status(err.response?.status || 500).json(errData);
    }
  }

  res.status(400).json({ error: 'Action inválida. Use ?action=generate ou ?action=status' });
};
