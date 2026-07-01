require('dotenv').config({ override: true });
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// req.query é getter read-only no Express (defineProperty sem setter) — assign direto não funciona
function setQuery(req, extra) {
  Object.defineProperty(req, 'query', {
    value: { ...req.query, ...extra },
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

function wrap(handler) {
  return (req, res) => {
    if (req.params) setQuery(req, req.params);
    return handler(req, res);
  };
}

// Auth — rota única com action via query
app.all('/api/auth', wrap(require('./api/auth')));
app.all('/api/auth/:action', (req, res) => {
  setQuery(req, { action: req.params.action });
  require('./api/auth')(req, res);
});

// PIX — rota única com action via query
app.all('/api/pix/:action', (req, res) => {
  setQuery(req, { action: req.params.action });
  require('./api/pix')(req, res);
});

// Restante das rotas
app.all('/api/dashboard',          wrap(require('./api/dashboard')));
app.all('/api/transactions',       wrap(require('./api/transactions/index')));
app.all('/api/transactions/:id',   wrap(require('./api/transactions/[id]')));
app.all('/api/settings',           wrap(require('./api/settings/index')));
app.all('/api/webhook/suitpay',    wrap(require('./api/webhook/suitpay')));
app.all('/api/webhook/payfort',    wrap(require('./api/webhook/payfort')));
app.all('/api/webhook/suitpay2',   wrap(require('./api/webhook/suitpay2')));
app.all('/api/webhook/payfort2',   wrap(require('./api/webhook/payfort2')));
app.all('/api/pix2/:action', (req, res) => {
  setQuery(req, { action: req.params.action });
  require('./api/pix2')(req, res);
});
app.all('/api/logs',               wrap(require('./api/logs/index')));

const PORT = 3001;
app.listen(PORT, () => console.log(`API local rodando em http://localhost:${PORT}`));
