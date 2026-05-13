const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireLogin } = require('../middleware/auth');
const { getSettings, saveSettings, addLog } = require('../utils/helpers');

router.get('/settings', requireLogin, (req, res) => {
  const settings = getSettings();
  res.render('settings', {
    title: 'Configurações - PIX Admin',
    active: 'settings',
    user: req.session.user,
    settings,
    supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    supabaseUrl: process.env.SUPABASE_URL || '',
    success: req.query.success || null,
    error: req.query.error || null,
  });
});

router.post('/settings/suitpay', requireLogin, (req, res) => {
  const { ci, cs, environment } = req.body;
  const settings = getSettings();
  settings.suitpay.ci = ci?.trim() || '';
  settings.suitpay.cs = cs?.trim() || '';
  settings.suitpay.environment = environment === 'production' ? 'production' : 'sandbox';
  saveSettings(settings);
  addLog('info', 'settings', `Credenciais SuitPay atualizadas (env: ${settings.suitpay.environment})`);
  res.redirect('/settings?success=Credenciais+SuitPay+salvas+com+sucesso');
});

router.post('/settings/server', requireLogin, (req, res) => {
  const { serverBaseUrl } = req.body;
  const settings = getSettings();
  settings.serverBaseUrl = serverBaseUrl?.trim() || '';
  saveSettings(settings);
  addLog('info', 'settings', `URL Base do servidor atualizada: ${settings.serverBaseUrl}`);
  res.redirect('/settings?success=URL+do+servidor+salva+com+sucesso');
});

router.post('/settings/regenerate-key', requireLogin, (req, res) => {
  const { v4: uuidv4 } = require('uuid');
  const settings = getSettings();
  settings.apiKey = uuidv4().replace(/-/g, '');
  saveSettings(settings);
  addLog('info', 'settings', 'API Key regenerada');
  res.redirect('/settings?success=Nova+API+Key+gerada+com+sucesso');
});

router.post('/settings/password', requireLogin, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const settings = getSettings();

  const valid = await bcrypt.compare(currentPassword, settings.adminPasswordHash);
  if (!valid) return res.redirect('/settings?error=Senha+atual+incorreta');
  if (newPassword !== confirmPassword) return res.redirect('/settings?error=As+senhas+não+coincidem');
  if (newPassword.length < 6) return res.redirect('/settings?error=A+senha+deve+ter+no+mínimo+6+caracteres');

  settings.adminPasswordHash = await bcrypt.hash(newPassword, 10);
  saveSettings(settings);
  addLog('info', 'settings', 'Senha do admin alterada com sucesso');
  res.redirect('/settings?success=Senha+alterada+com+sucesso');
});

module.exports = router;
