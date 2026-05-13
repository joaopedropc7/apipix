const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { dbInsert, getSettings, addLog, setCors, sendToUtmify } = require('../_helpers');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const settings = await getSettings();

  // Valida API Key
  const apiKey = req.headers['api-key'] || req.headers['x-api-key'];
  if (!settings.api_key || apiKey !== settings.api_key) {
    return res.status(401).json({ error: 'API Key inválida ou ausente. Envie no header: api-key' });
  }

  if (!settings.suitpay_ci || !settings.suitpay_cs) {
    return res.status(503).json({ error: 'Credenciais SuitPay não configuradas no painel admin' });
  }

  const body = req.body;

  if (!body.amount || !body.client?.name || !body.client?.document) {
    return res.status(400).json({
      error: 'Campos obrigatórios ausentes',
      required: ['amount', 'client.name', 'client.document'],
    });
  }

  // Gera requestNumber único automaticamente
  body.requestNumber = uuidv4().replace(/-/g, '').slice(0, 16);

  // Define dueDate automaticamente como amanhã se não informado
  if (!body.dueDate) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    body.dueDate = tomorrow.toISOString().slice(0, 10);
  }

  // Sempre usa a URL de webhook do próprio sistema — ignora qualquer callbackUrl do body
  const serverBase = settings.server_base_url?.trim().replace(/\/$/, '');
  body.callbackUrl = serverBase
    ? `${serverBase}/api/webhook/suitpay`
    : '';

  const baseUrl = settings.suitpay_environment === 'production'
    ? 'https://ws.suitpay.app'
    : 'https://sandbox.ws.suitpay.app';

  try {
    const { data } = await axios.post(
      `${baseUrl}/api/v1/gateway/request-qrcode`,
      body,
      {
        headers: {
          ci: settings.suitpay_ci,
          cs: settings.suitpay_cs,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const inserted = await dbInsert('transactions', {
      request_number:      body.requestNumber,
      id_transaction:      data.idTransaction || null,
      amount:              parseFloat(body.amount),
      shipping_amount:     parseFloat(body.shippingAmount) || 0,
      discount_amount:     parseFloat(body.discountAmount) || 0,
      client_name:         body.client.name,
      client_document:     body.client.document,
      client_email:        body.client.email || null,
      client_phone:        body.client.phoneNumber || null,
      due_date:            body.dueDate,
      status:              'pending',
      payment_code:        data.paymentCode || null,
      payment_code_base64: data.paymentCodeBase64 || null,
      callback_url:        body.callbackUrl || null,
      username_checkout:   body.usernameCheckout || null,
      raw_request:         body,
      raw_response:        data,
    });

    await addLog('info', 'api', `QR Code gerado: ${body.requestNumber}`, {
      idTransaction: data.idTransaction,
      callbackUrl: body.callbackUrl,
    });

    // Notifica Utmify: venda pendente
    await sendToUtmify(inserted, 'waiting_payment', null);

    return res.status(200).json({
      ...data,
      _id:            inserted?.id,
      requestNumber:  body.requestNumber,
      callbackUrl:    body.callbackUrl,
    });

  } catch (err) {
    const errData = err.response?.data || { message: err.message };
    await addLog('error', 'api', `Erro ao gerar QR Code: ${body.requestNumber}`, errData);

    await dbInsert('transactions', {
      request_number:  body.requestNumber,
      amount:          parseFloat(body.amount) || 0,
      client_name:     body.client?.name || 'N/A',
      client_document: body.client?.document || 'N/A',
      due_date:        body.dueDate || '',
      status:          'error',
      raw_request:     body,
      raw_response:    errData,
    }).catch(() => {});

    return res.status(err.response?.status || 500).json(errData);
  }
};
