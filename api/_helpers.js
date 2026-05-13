require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });
const axios = require('axios');
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
      Prefer: 'return=representation',
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
  const { data } = await sbAxios().post(`/${table}`, body);
  return Array.isArray(data) ? data[0] : data;
}

// UPSERT — insere ou atualiza
async function dbUpsert(table, body) {
  const { data } = await sbAxios().post(`/${table}`, body, {
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  });
  return Array.isArray(data) ? data[0] : data;
}

// UPDATE — atualiza por filtro ex: 'id=eq.uuid'
async function dbUpdate(table, filter, body) {
  const { data } = await sbAxios().patch(`/${table}?${filter}`, body);
  return data;
}

// DELETE por filtro
async function dbDelete(table, filter) {
  await sbAxios().delete(`/${table}?${filter}`);
}

// COUNT — retorna número de rows
async function dbCount(table, query = '') {
  const inst = sbAxios();
  const { data } = await inst.get(`/${table}${query}`, {
    headers: { ...inst.defaults.headers, Prefer: 'count=exact' },
  });
  return Array.isArray(data) ? data.length : 0;
}

// Configurações
async function getSettings() {
  const rows = await dbSelect('settings', '?select=key,value');
  if (!rows.length) throw new Error('Tabela settings vazia — execute migrations/001_init.sql no Supabase');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

async function setSetting(key, value) {
  await dbUpsert('settings', { key, value: String(value ?? '') });
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

function parseSuitPayDate(dateStr) {
  if (!dateStr) return null;
  try {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    return new Date(`${year}-${month}-${day}T${timePart}`).toISOString();
  } catch { return null; }
}

module.exports = {
  dbSelect, dbInsert, dbUpsert, dbUpdate, dbDelete, dbCount,
  getSettings, setSetting, addLog, authenticate, setCors, parseSuitPayDate,
};
