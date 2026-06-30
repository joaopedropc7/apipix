require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });
const axios = require('axios');
const https = require('https');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

// Cliente HTTP direto para o Supabase REST API — sem usar fetch
function sbAxios() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  return axios.create({
    baseURL: `${url}/rest/v1`,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
}

// SELECT — retorna array de rows
async function dbSelect(table, query = '') {
  const { data } = await sbAxios().get(`/${table}${query}`);
  return data || [];
}

// INSERT — retorna o row inserido
async function dbInsert(table, body) {
  const { data } = await sbAxios().post(`/${table}`, body, {
    headers: { Prefer: 'return=representation' },
  });
  return Array.isArray(data) ? data[0] : data;
}

// UPSERT — insere ou atualiza (body pode ser objeto ou array)
async function dbUpsert(table, body, onConflict = null) {
  const payload = Array.isArray(body) ? body : [body];
  const url = onConflict ? `/${table}?on_conflict=${onConflict}` : `/${table}`;
  const { data } = await sbAxios().post(url, payload, {
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  });
  return Array.isArray(data) ? data[0] : data;
}

// UPDATE — atualiza por filtro ex: 'id=eq.uuid'
async function dbUpdate(table, filter, body) {
  await sbAxios().patch(`/${table}?${filter}`, body, {
    headers: { Prefer: 'return=minimal' },
  });
}

// DELETE por filtro
async function dbDelete(table, filter) {
  await sbAxios().delete(`/${table}?${filter}`);
}

// Configurações
async function getSettings() {
  const rows = await dbSelect('settings', '?select=key,value');
  if (!rows.length) throw new Error('Tabela settings vazia — execute migrations/001_init.sql no Supabase');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

async function setSetting(key, value) {
  await dbUpsert('settings', { key, value: String(value ?? '') }, 'key');
}

async function addLog(level, type, message, details = null) {
  try {
    await dbInsert('logs', { level, type, message, details: details || null });
  } catch (_) {}
}

function authenticate(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.pix_token;
  if (!token) { res.status(401).json({ error: 'Não autenticado' }); return null; }
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'pixadmin-jwt-secret');
  } catch {
    res.status(401).json({ error: 'Sessão expirada' }); return null;
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, api-key');
}

// Gera token JWT da Payfort via Basic Auth (api_key:api_secret) — expira em 60s
// Usa https nativo (não axios): a Payfort retorna 500 se a requisição tiver
// Content-Type, e o axios sempre injeta um por padrão mesmo sem body.
function getPayfortToken(settings) {
  const credentials = Buffer.from(`${settings.payfort_api_key}:${settings.payfort_api_secret}`).toString('base64');
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.payfortbank.com',
      path:     '/api/auth',
      method:   'POST',
      headers:  { Authorization: `Basic ${credentials}` },
      timeout:  15000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = { message: body }; }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed.token);
        } else {
          const err = new Error(`Payfort auth failed: ${res.statusCode}`);
          err.response = { status: res.statusCode, data: parsed };
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Payfort auth timeout')));
    req.end();
  });
}

function parseSuitPayDate(dateStr) {
  if (!dateStr) return null;
  try {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    return new Date(`${year}-${month}-${day}T${timePart}`).toISOString();
  } catch { return null; }
}

function toUtmifyDate(isoDate) {
  if (!isoDate) return null;
  try {
    return new Date(isoDate).toISOString().replace('T', ' ').slice(0, 19);
  } catch { return null; }
}

async function sendToUtmify(transaction, status, approvedDate = null) {
  try {
    const settings = await getSettings();
    const token = settings.utmify_token;
    if (!token) return;

    const raw = transaction.raw_request || {};
    const tracking = raw.trackingParameters || {};
    const rawProducts = raw.products || [];
    const amountCents = Math.round(parseFloat(transaction.amount || 0) * 100);

    const products = rawProducts.length
      ? rawProducts.map(p => ({
          id: String(p.description || 'produto').slice(0, 50),
          name: p.description || 'Produto',
          planId: null,
          planName: null,
          quantity: parseInt(p.quantity) || 1,
          priceInCents: Math.round(parseFloat(p.value || 0) * 100),
        }))
      : [{ id: transaction.request_number, name: 'Produto', planId: null, planName: null, quantity: 1, priceInCents: amountCents }];

    const body = {
      orderId:       transaction.request_number,
      platform:      'PIXAdmin',
      paymentMethod: 'pix',
      status,
      createdAt:    toUtmifyDate(transaction.created_at),
      approvedDate: approvedDate ? toUtmifyDate(approvedDate) : null,
      refundedAt:   null,
      customer: {
        name:     transaction.client_name,
        email:    transaction.client_email || '',
        phone:    transaction.client_phone   || null,
        document: transaction.client_document || null,
        country:  'BR',
      },
      products,
      trackingParameters: {
        src:          tracking.src          || null,
        sck:          tracking.sck          || null,
        utm_source:   tracking.utm_source   || null,
        utm_campaign: tracking.utm_campaign || null,
        utm_medium:   tracking.utm_medium   || null,
        utm_content:  tracking.utm_content  || null,
        utm_term:     tracking.utm_term     || null,
      },
      commission: {
        totalPriceInCents:      amountCents,
        gatewayFeeInCents:      0,
        userCommissionInCents:  amountCents,
      },
      isTest: false,
    };

    await addLog('info', 'utmify', `Utmify: enviando ${transaction.request_number} → ${status}`, { payload: body });

    const resp = await axios.post('https://api.utmify.com.br/api-credentials/orders', body, {
      headers: { 'x-api-token': token, 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    await addLog('info', 'utmify', `Utmify: ${transaction.request_number} → ${status} ✅`, {
      httpStatus: resp.status,
      response:   resp.data,
    });
  } catch (err) {
    await addLog('error', 'utmify',
      `Erro Utmify: ${transaction.request_number}`,
      {
        httpStatus:   err.response?.status,
        errorBody:    err.response?.data,
        errorMessage: err.message,
      }
    );
  }
}

module.exports = {
  dbSelect, dbInsert, dbUpsert, dbUpdate, dbDelete,
  getSettings, setSetting, addLog, authenticate, setCors,
  parseSuitPayDate, toUtmifyDate, sendToUtmify, getPayfortToken,
};
