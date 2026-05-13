const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { redirectIfLoggedIn } = require('../middleware/auth');
const { getSettings, addLog } = require('../utils/helpers');

router.get('/login', redirectIfLoggedIn, (req, res) => {
  res.render('login', { error: null, title: 'Login - PIX Admin' });
});

router.post('/login', redirectIfLoggedIn, async (req, res) => {
  const { username, password } = req.body;
  const settings = getSettings();

  if (username !== settings.adminUser) {
    return res.render('login', { error: 'Usuário ou senha inválidos.', title: 'Login - PIX Admin' });
  }

  const valid = await bcrypt.compare(password, settings.adminPasswordHash);
  if (!valid) {
    addLog('warn', 'auth', `Tentativa de login falhou para usuário: ${username}`);
    return res.render('login', { error: 'Usuário ou senha inválidos.', title: 'Login - PIX Admin' });
  }

  req.session.user = { username };
  addLog('info', 'auth', `Login bem-sucedido: ${username}`);
  const returnTo = req.session.returnTo || '/dashboard';
  delete req.session.returnTo;
  res.redirect(returnTo);
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
