const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { getSupabase } = require('../db/supabase');
const { requireLogin } = require('../middleware/auth');
const { getSettings, addLog } = require('../utils/helpers');

function getSuitPayBaseUrl(env) {
  return env === 'production'
    ? 'https://ws.suitpay.app'
    : 'https://sandbox.ws.suitpay.app';
}

router.get('/transactions', requireLogin, async (req, res) => {
  const { status, search, page = 1 } = req.query;
  const limit = 20;
  const from = (parseInt(page) - 1) * limit;
  const to = from + limit - 1;

  const sb = getSupabase();
  if (!sb) {
    return res.render('transactions', {
      title: 'Transações - PIX Admin', active: 'transactions', user: req.session.user,
      transactions: [], total: 0, page: 1, pages: 1, status: '', search: '',
      supabaseWarning: true,
    });
  }

  let query = sb.from('transactions').select('*', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`client_name.ilike.%${search}%,client_document.ilike.%${search}%,request_number.ilike.%${search}%`);

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  res.render('transactions', {
    title: 'Transações - PIX Admin',
    active: 'transactions',
    user: req.session.user,
    transactions: data || [],
    total: count || 0,
    page: parseInt(page),
    pages: Math.ceil((count || 0) / limit),
    status: status || '',
    search: search || '',
    supabaseWarning: false,
  });
});

router.get('/transactions/new', requireLogin, (req, res) => {
  const settings = getSettings();
  const webhookUrl = settings.serverBaseUrl
    ? `${settings.serverBaseUrl.replace(/\/$/, '')}/webhook/suitpay`
    : '';
  res.render('transaction-new', {
    title: 'Nova Transação - PIX Admin',
    active: 'transactions',
    user: req.session.user,
    configured: !!(settings.suitpay.ci && settings.suitpay.cs),
    supabaseConfigured: !!(settings.supabase?.url && settings.supabase?.anonKey),
    defaultCallbackUrl: webhookUrl,
    error: undefined,
    form: undefined,
  });
});

router.post('/transactions/new', requireLogin, async (req, res) => {
  const settings = getSettings();

  if (!settings.suitpay.ci || !settings.suitpay.cs) {
    return res.redirect('/settings?error=Configure+a+CI+e+CS+da+SuitPay+primeiro');
  }

  const {
    requestNumber, dueDate, amount, shippingAmount, discountAmount,
    usernameCheckout, callbackUrl,
    clientName, clientDocument, clientPhone, clientEmail,
    codIbge, street, number, complement, zipCode, neighborhood, city, state,
  } = req.body;

  const parsedProducts = [];
  const descs = [].concat(req.body['product_desc'] || []);
  const qtys = [].concat(req.body['product_qty'] || []);
  const vals = [].concat(req.body['product_val'] || []);
  descs.forEach((desc, i) => {
    if (desc) parsedProducts.push({
      description: desc,
      quantity: parseInt(qtys[i]) || 1,
      value: parseFloat(vals[i]) || 0,
    });
  });

  const payload = {
    requestNumber: requestNumber || uuidv4().slice(0, 8),
    dueDate,
    amount: parseFloat(amount),
    shippingAmount: parseFloat(shippingAmount) || 0,
    discountAmount: parseFloat(discountAmount) || 0,
    usernameCheckout: usernameCheckout || 'admin',
    callbackUrl: callbackUrl || '',
    client: {
      name: clientName,
      document: clientDocument,
      phoneNumber: clientPhone || '',
      email: clientEmail || '',
      address: { codIbge, street, number, complement, zipCode, neighborhood, city, state },
    },
    products: parsedProducts,
  };

  const baseUrl = getSuitPayBaseUrl(settings.suitpay.environment);
  const sb = getSupabase();

  try {
    const response = await axios.post(
      `${baseUrl}/api/v1/gateway/request-qrcode`,
      payload,
      {
        headers: {
          'ci': settings.suitpay.ci,
          'cs': settings.suitpay.cs,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const data = response.data;

    const record = {
      request_number: payload.requestNumber,
      id_transaction: data.idTransaction || null,
      amount: payload.amount,
      shipping_amount: payload.shippingAmount,
      discount_amount: payload.discountAmount,
      client_name: clientName,
      client_document: clientDocument,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      due_date: dueDate,
      status: 'pending',
      payment_code: data.paymentCode || null,
      payment_code_base64: data.paymentCodeBase64 || null,
      callback_url: callbackUrl || null,
      username_checkout: payload.usernameCheckout,
      raw_request: payload,
      raw_response: data,
    };

    let insertedId = null;
    if (sb) {
      const { data: inserted, error: insertErr } = await sb
        .from('transactions')
        .insert(record)
        .select('id')
        .single();

      if (insertErr) throw new Error(`Supabase: ${insertErr.message}`);
      insertedId = inserted.id;
    }

    addLog('info', 'transaction', `QR Code gerado: ${payload.requestNumber}`, {
      id: insertedId,
      idTransaction: data.idTransaction,
    });

    if (insertedId) {
      res.redirect(`/transactions/${insertedId}`);
    } else {
      res.render('transaction-new', {
        title: 'Nova Transação - PIX Admin',
        active: 'transactions',
        user: req.session.user,
        configured: true,
        supabaseConfigured: false,
        defaultCallbackUrl: callbackUrl || '',
        error: 'Supabase não configurado. Configure nas Configurações para salvar a transação.',
        form: req.body,
      });
    }

  } catch (err) {
    const errMsg = err.response?.data || err.message;
    addLog('error', 'transaction', `Falha ao gerar QR Code: ${payload.requestNumber}`, errMsg);

    if (sb) {
      await sb.from('transactions').insert({
        request_number: payload.requestNumber,
        amount: payload.amount,
        shipping_amount: payload.shippingAmount,
        discount_amount: payload.discountAmount,
        client_name: clientName,
        client_document: clientDocument,
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
        due_date: dueDate,
        status: 'error',
        raw_request: payload,
        raw_response: typeof errMsg === 'string' ? { message: errMsg } : errMsg,
      });
    }

    res.render('transaction-new', {
      title: 'Nova Transação - PIX Admin',
      active: 'transactions',
      user: req.session.user,
      configured: true,
      supabaseConfigured: !!(settings.supabase?.url && settings.supabase?.anonKey),
      defaultCallbackUrl: callbackUrl || '',
      error: `Erro SuitPay: ${typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg}`,
      form: req.body,
    });
  }
});

router.get('/transactions/:id', requireLogin, async (req, res) => {
  const sb = getSupabase();
  if (!sb) return res.redirect('/transactions');

  const { data: tx, error } = await sb
    .from('transactions')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !tx) return res.redirect('/transactions');

  res.render('transaction-detail', {
    title: `Transação #${tx.request_number} - PIX Admin`,
    active: 'transactions',
    user: req.session.user,
    tx,
  });
});

router.post('/transactions/:id/cancel', requireLogin, async (req, res) => {
  const sb = getSupabase();
  if (!sb) return res.redirect('/transactions');

  await sb.from('transactions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', req.params.id);

  addLog('info', 'transaction', `Transação cancelada: ${req.params.id}`);
  res.redirect(`/transactions/${req.params.id}`);
});

module.exports = router;
