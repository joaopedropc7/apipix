const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '..', 'config', 'settings.json');

function getSettings() {
  return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
}

function saveSettings(data) {
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
}

async function addLog(level, type, message, details = null) {
  try {
    const { getSupabase } = require('../db/supabase');
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('logs').insert({
      level,
      type,
      message,
      details: details || null,
    });
  } catch (_) {}
}

module.exports = { getSettings, saveSettings, addLog };
