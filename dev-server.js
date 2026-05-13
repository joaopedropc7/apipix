require('dotenv').config({ override: true });
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function wrap(handler) {
  return (req, res) => {
    if (req.params) req.query = { ...req.query, ...req.params };
    return handler(req, res);
  };
}

// Auth — rota única com action via query
app.all('/api/auth/:action', (req, res) => {
  req.query = { ...req.query, action: req.params.action };
  require('./api/auth')(req, res);
});

// PIX — rota única com action via query
app.all('/api/pix/:action', (req, res) => {
  req.query = { ...req.query, action: req.params.action };
  require('./api/pix')(req, res);
});

// Restante das rotas
app.all('/api/dashboard',          wrap(require('./api/dashboard')));
app.all('/api/transactions',       wrap(require('./api/transactions/index')));
app.all('/api/transactions/:id',   wrap(require('./api/transactions/[id]')));
app.all('/api/settings',           wrap(require('./api/settings/index')));
app.all('/api/webhook/suitpay',    wrap(require('./api/webhook/suitpay')));
app.all('/api/logs',               wrap(require('./api/logs/index')));

const PORT = 3001;
app.listen(PORT, () => console.log(`API local rodando em http://localhost:${PORT}`));
