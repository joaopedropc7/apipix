require('dotenv').config({ override: true });
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

function getSB() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

async function getSettings() {
  const { data, error } = await getSB().from('settings').select('key, value');
  if (error) throw new Error(`Supabase erro ao ler settings: ${error.message}`);
  if (!data || data.length === 0) throw new Error('Tabela settings vazia — execute a migration 001_init.sql no Supabase');
  return Object.fromEntries(data.map(r => [r.key, r.value]));
}

async function setSetting(key, value) {
  await getSB().from('settings').upsert({ key, value: String(value ?? '') });
}

async function addLog(level, type, message, details = null) {
  try {
    await getSB().from('logs').insert({ level, type, message, details: details || null });
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

module.exports = { getSB, getSettings, setSetting, addLog, authenticate, setCors, parseSuitPayDate };
