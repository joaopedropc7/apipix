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
        // Endpoint 1
        bynetApiKey:            s.bynet_api_key || '',
        umbrellaApiKey:         s.umbrella_api_key || '',
        axxonPublicKey:         s.axxon_public_key || '',
        axxonSecretKey:         s.axxon_secret_key || '',
        activeGateway:          ['umbrella', 'axxon'].includes(s.active_gateway) ? s.active_gateway : 'bynet',
        utmifyToken:            s.utmify_token || '',
        // Endpoint 2
        bynetApiKey2:           s.bynet_api_key_2 || '',
        umbrellaApiKey2:        s.umbrella_api_key_2 || '',
        axxonPublicKey2:        s.axxon_public_key_2 || '',
        axxonSecretKey2:        s.axxon_secret_key_2 || '',
        activeGateway2:         ['umbrella', 'axxon'].includes(s.active_gateway_2) ? s.active_gateway_2 : 'bynet',
        utmifyToken2:           s.utmify_token_2 || '',
        // Comum
        apiKey:                 s.api_key || '',
        serverBaseUrl:          s.server_base_url || '',
        redtrackPostbackUrl:    s.redtrack_postback_url || 'https://kpcab.ttrk.io/postback',
        supabaseConfigured:     !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      });
    }

    if (req.method === 'POST') {
      const { action, ...data } = req.body;

      // --- Endpoint 1 ---
      if (action === 'bynet') {
        await setSetting('bynet_api_key', data.apiKey || '');
        await addLog('info', 'settings', 'API Key ByNet (endpoint 1) atualizada');
        return res.status(200).json({ ok: true });
      }

      if (action === 'umbrella') {
        await setSetting('umbrella_api_key', data.apiKey || '');
        await addLog('info', 'settings', 'API Key Umbrella (endpoint 1) atualizada');
        return res.status(200).json({ ok: true });
      }

      if (action === 'axxon') {
        await setSetting('axxon_public_key', data.publicKey || '');
        await setSetting('axxon_secret_key', data.secretKey || '');
        await addLog('info', 'settings', 'Credenciais Axxon (endpoint 1) atualizadas');
        return res.status(200).json({ ok: true });
      }

      if (action === 'gateway') {
        const gw = ['umbrella', 'axxon'].includes(data.activeGateway) ? data.activeGateway : 'bynet';
        await setSetting('active_gateway', gw);
        await addLog('info', 'settings', `Gateway ativo (endpoint 1) alterado para: ${gw}`);
        return res.status(200).json({ ok: true });
      }

      // --- Endpoint 2 ---
      if (action === 'bynet2') {
        await setSetting('bynet_api_key_2', data.apiKey || '');
        await addLog('info', 'settings', 'API Key ByNet (endpoint 2) atualizada');
        return res.status(200).json({ ok: true });
      }

      if (action === 'umbrella2') {
        await setSetting('umbrella_api_key_2', data.apiKey || '');
        await addLog('info', 'settings', 'API Key Umbrella (endpoint 2) atualizada');
        return res.status(200).json({ ok: true });
      }

      if (action === 'axxon2') {
        await setSetting('axxon_public_key_2', data.publicKey || '');
        await setSetting('axxon_secret_key_2', data.secretKey || '');
        await addLog('info', 'settings', 'Credenciais Axxon (endpoint 2) atualizadas');
        return res.status(200).json({ ok: true });
      }

      if (action === 'gateway2') {
        const gw = ['umbrella', 'axxon'].includes(data.activeGateway2) ? data.activeGateway2 : 'bynet';
        await setSetting('active_gateway_2', gw);
        await addLog('info', 'settings', `Gateway ativo (endpoint 2) alterado para: ${gw}`);
        return res.status(200).json({ ok: true });
      }

      if (action === 'server') {
        await setSetting('server_base_url', data.serverBaseUrl || '');
        await addLog('info', 'settings', 'URL Base atualizada');
        return res.status(200).json({ ok: true });
      }

      if (action === 'redtrack') {
        await setSetting('redtrack_postback_url', (data.redtrackPostbackUrl || '').trim());
        await addLog('info', 'settings', 'URL de postback RedTrack atualizada');
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
