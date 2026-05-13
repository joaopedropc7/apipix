const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getSettings, setSetting, addLog, authenticate } = require('../_helpers');

module.exports = async (req, res) => {
  if (!authenticate(req, res)) return;

  if (req.method === 'GET') {
    const s = await getSettings();
    return res.status(200).json({
      adminUser:          s.admin_user || 'admin',
      suitpayCi:          s.suitpay_ci || '',
      suitpayCs:          s.suitpay_cs ? '••••••••' : '',
      suitpayCsSet:       !!s.suitpay_cs,
      suitpayEnvironment: s.suitpay_environment || 'sandbox',
      apiKey:             s.api_key || '',
      serverBaseUrl:      s.server_base_url || '',
      utmifyToken:        s.utmify_token || '',
      supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    });
  }

  if (req.method === 'POST') {
    const { action, ...data } = req.body;

    if (action === 'suitpay') {
      await setSetting('suitpay_ci', data.ci || '');
      if (data.cs && !data.cs.startsWith('•')) await setSetting('suitpay_cs', data.cs);
      await setSetting('suitpay_environment', data.environment === 'production' ? 'production' : 'sandbox');
      await addLog('info', 'settings', `Credenciais SuitPay atualizadas (${data.environment})`);
      return res.status(200).json({ ok: true });
    }

    if (action === 'server') {
      await setSetting('server_base_url', data.serverBaseUrl || '');
      await addLog('info', 'settings', `URL Base atualizada`);
      return res.status(200).json({ ok: true });
    }

    if (action === 'utmify') {
      await setSetting('utmify_token', data.utmifyToken || '');
      await addLog('info', 'settings', 'Token Utmify atualizado');
      return res.status(200).json({ ok: true });
    }

    if (action === 'regenerate-key') {
      const newKey = uuidv4().replace(/-/g, '');
      await setSetting('api_key', newKey);
      await addLog('info', 'settings', 'API Key regenerada');
      return res.status(200).json({ ok: true, apiKey: newKey });
    }

    if (action === 'password') {
      const s = await getSettings();
      const valid = await bcrypt.compare(data.currentPassword, s.admin_password_hash || '');
      if (!valid) return res.status(400).json({ error: 'Senha atual incorreta' });
      if (data.newPassword !== data.confirmPassword) return res.status(400).json({ error: 'As senhas não coincidem' });
      if ((data.newPassword || '').length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
      const hash = await bcrypt.hash(data.newPassword, 10);
      await setSetting('admin_password_hash', hash);
      await addLog('info', 'settings', 'Senha alterada');
      return res.status(200).json({ ok: true });
    }
  }

  res.status(405).end();
};
