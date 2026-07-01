const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getSettings, setSetting, addLog, authenticate } = require('../_helpers');

module.exports = async (req, res) => {
  if (!authenticate(req, res)) return;

  try {
    if (req.method === 'GET') {
      const s = await getSettings();
      return res.status(200).json({
        adminUser:              s.admin_user || 'admin',
        suitpayCi:              s.suitpay_ci || '',
        suitpayCs:              s.suitpay_cs ? '••••••••' : '',
        suitpayCsSet:           !!s.suitpay_cs,
        suitpayEnvironment:     s.suitpay_environment || 'sandbox',
        payfortAccountId:       s.payfort_account_id || '',
        payfortApiKey:          s.payfort_api_key || '',
        payfortApiSecret:       s.payfort_api_secret ? '••••••••' : '',
        payfortApiSecretSet:    !!s.payfort_api_secret,
        activeGateway:          s.active_gateway || 'suitpay',
        apiKey:                 s.api_key || '',
        serverBaseUrl:          s.server_base_url || '',
        utmifyToken:            s.utmify_token || '',
        utmifyToken2:           s.utmify_token_2 || '',
        supabaseConfigured:     !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
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

      if (action === 'payfort') {
        await setSetting('payfort_account_id', data.accountId || '');
        await setSetting('payfort_api_key', data.apiKey || '');
        if (data.apiSecret && !data.apiSecret.startsWith('•')) await setSetting('payfort_api_secret', data.apiSecret);
        await addLog('info', 'settings', 'Credenciais Payfort atualizadas');
        return res.status(200).json({ ok: true });
      }

      if (action === 'gateway') {
        const gw = data.activeGateway === 'payfort' ? 'payfort' : 'suitpay';
        await setSetting('active_gateway', gw);
        await addLog('info', 'settings', `Gateway ativo alterado para: ${gw}`);
        return res.status(200).json({ ok: true });
      }

      if (action === 'server') {
        await setSetting('server_base_url', data.serverBaseUrl || '');
        await addLog('info', 'settings', 'URL Base atualizada');
        return res.status(200).json({ ok: true });
      }

      if (action === 'utmify') {
        await setSetting('utmify_token', data.utmifyToken || '');
        await addLog('info', 'settings', 'Token Utmify atualizado');
        return res.status(200).json({ ok: true });
      }

      if (action === 'utmify2') {
        await setSetting('utmify_token_2', data.utmifyToken2 || '');
        await addLog('info', 'settings', 'Token Utmify 2 atualizado');
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

      return res.status(400).json({ error: `Action desconhecida: ${action}` });
    }

    res.status(405).end();
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data || err.message || 'Erro interno';
    return res.status(500).json({ error: String(msg) });
  }
};
