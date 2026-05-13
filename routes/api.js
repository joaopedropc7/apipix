const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { getSupabase } = require('../db/supabase');
const { getSettings, addLog } = require('../utils/helpers');

function getSuitPayBaseUrl(env) {
  return env === 'production'
    ? 'https://ws.suitpay.app'
    : 'https://sandbox.ws.suitpay.app';
}

// Middleware: valida api-key no header
function requireApiKey(req, res, next) {
  const settings = getSettings();
  const receivedKey = req.headers['api-key'] || req.headers['x-api-key'];

  if (!settings.apiKey) {
    return res.status(503).json({ error: 'API Key não configurada no servidor. Acesse o painel.' });
  }
  if (!receivedKey || receivedKey !== settings.apiKey) {
    return res.status(401).json({ error: 'API Key inválida ou ausente. Envie no header: api-key' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/gateway/request-qrcode
// Gera PIX via SuitPay — mesmo formato de body da SuitPay
// ─────────────────────────────────────────────────────────────
router.post('/api/v1/gateway/request-qrcode', requireApiKey, async (req, res) => {
  const settings = getSettings();

  if (!settings.suitpay.ci || !settings.suitpay.cs) {
    return res.status(503).json({ error: 'Credenciais SuitPay não configuradas no servidor.' });
  }

  const body = req.body;

  if (!body.dueDate || !body.amount || !body.client?.name || !body.client?.document) {
    return res.status(400).json({
      error: 'Campos obrigatórios ausentes',
      required: ['dueDate', 'amount', 'client.name', 'client.document'],
    });
  }

  // Auto-preenche callbackUrl com webhook do próprio servidor se não enviado
  if (!body.callbackUrl && settings.serverBaseUrl) {
    body.callbackUrl = `${settings.serverBaseUrl.replace(/\/$/, '')}/webhook/suitpay`;
  }

  // Garante requestNumber
  if (!body.requestNumber) {
    body.requestNumber = uuidv4().slice(0, 8);
  }

  const baseUrl = getSuitPayBaseUrl(settings.suitpay.environment);

  try {
    const suitpayRes = await axios.post(
      `${baseUrl}/api/v1/gateway/request-qrcode`,
      body,
      {
        headers: {
          'ci': settings.suitpay.ci,
          'cs': settings.suitpay.cs,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const data = suitpayRes.data;

    // Salva no Supabase
    const sb = getSupabase();
    let savedId = null;
    if (sb) {
      const { data: inserted } = await sb.from('transactions').insert({
        request_number: body.requestNumber,
        id_transaction: data.idTransaction || null,
        amount: parseFloat(body.amount),
        shipping_amount: parseFloat(body.shippingAmount) || 0,
        discount_amount: parseFloat(body.discountAmount) || 0,
        client_name: body.client.name,
        client_document: body.client.document,
        client_email: body.client.email || null,
        client_phone: body.client.phoneNumber || null,
        due_date: body.dueDate,
        status: 'pending',
        payment_code: data.paymentCode || null,
        payment_code_base64: data.paymentCodeBase64 || null,
        callback_url: body.callbackUrl || null,
        username_checkout: body.usernameCheckout || null,
        raw_request: body,
        raw_response: data,
      }).select('id').single();
      savedId = inserted?.id || null;
    }

    addLog('info', 'api', `QR Code gerado: ${body.requestNumber}`, { idTransaction: data.idTransaction });

    // Retorna exatamente o que a SuitPay retornou + id interno
    return res.status(200).json({
      ...data,
      _id: savedId,
    });

  } catch (err) {
    const status = err.response?.status || 500;
    const errData = err.response?.data || { message: err.message };

    addLog('error', 'api', `Erro ao gerar QR Code: ${body.requestNumber}`, errData);

    // Salva a tentativa com erro
    const sb = getSupabase();
    if (sb) {
      await sb.from('transactions').insert({
        request_number: body.requestNumber,
        amount: parseFloat(body.amount) || 0,
        client_name: body.client?.name || 'N/A',
        client_document: body.client?.document || 'N/A',
        due_date: body.dueDate || '',
        status: 'error',
        raw_request: body,
        raw_response: errData,
      }).catch(() => {});
    }

    return res.status(status).json(errData);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/transactions
// Lista transações salvas
// ─────────────────────────────────────────────────────────────
router.get('/api/v1/transactions', requireApiKey, async (req, res) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ error: 'Supabase não configurado' });

  const { status, limit = 20, page = 1 } = req.query;
  const from = (parseInt(page) - 1) * parseInt(limit);
  const to = from + parseInt(limit) - 1;

  let query = sb
    .from('transactions')
    .select('id, request_number, id_transaction, amount, status, due_date, client_name, client_document, created_at, payment_date', { count: 'exact' });

  if (status) query = query.eq('status', status);

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  return res.json({
    total: count || 0,
    page: parseInt(page),
    limit: parseInt(limit),
    transactions: data || [],
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/transactions/:id
// Busca transação por ID interno
// ─────────────────────────────────────────────────────────────
router.get('/api/v1/transactions/:id', requireApiKey, async (req, res) => {
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ error: 'Supabase não configurado' });

  const { data, error } = await sb
    .from('transactions')
    .select('id, request_number, id_transaction, amount, status, payment_code, due_date, client_name, client_document, created_at, updated_at, payment_date')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Transação não encontrada' });

  return res.json(data);
});

module.exports = router;
