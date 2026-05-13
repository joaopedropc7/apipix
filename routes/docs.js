const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const { getSettings } = require('../utils/helpers');

router.get('/docs', requireLogin, (req, res) => {
  const settings = getSettings();
  res.render('docs', {
    title: 'Documentação - PIX Admin',
    active: 'docs',
    user: req.session.user,
    environment: settings.suitpay.environment,
    baseUrl: settings.suitpay.environment === 'production'
      ? 'https://ws.suitpay.app'
      : 'https://sandbox.ws.suitpay.app',
  });
});

module.exports = router;
