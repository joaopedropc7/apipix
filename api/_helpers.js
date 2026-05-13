const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
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

async function getSettings(sb) {
  const { data } = await sb.from('settings').select('key, value');
  return Object.fromEntries((data || []).map(r => [r.key, r.value]));
}

async function setSetting(sb, key, value) {
  await sb.from('settings').upsert({ key, value: String(value ?? '') });
}

async function addLog(sb, level, type, message, details = null) {
  try {
    await sb.from('logs').insert({ level, type, message, details });
  } catch (_) {}
}

function parseSuitPayDate(dateStr) {
  if (!dateStr) return null;
  try {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    return new Date(`${year}-${month}-${day}T${timePart}`).toISOString();
  } catch { return null; }
}

module.exports = { getSupabase, authenticate, setCors, getSettings, setSetting, addLog, parseSuitPayDate };
