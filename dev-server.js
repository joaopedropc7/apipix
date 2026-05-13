require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Adapta handlers da pasta api/ para Express.
// Vercel passa params dinâmicos via req.query — aqui mapeamos req.params → req.query.
function wrap(handler) {
  return (req, res) => {
    if (req.params) {
      req.query = { ...req.query, ...req.params };
    }
    return handler(req, res);
  };
}

app.all('/api/auth/login',        wrap(require('./api/auth/login')));
app.all('/api/auth/logout',       wrap(require('./api/auth/logout')));
app.all('/api/auth/me',           wrap(require('./api/auth/me')));
app.all('/api/dashboard',         wrap(require('./api/dashboard')));
app.all('/api/transactions',      wrap(require('./api/transactions/index')));
app.all('/api/transactions/:id',  wrap(require('./api/transactions/[id]')));
app.all('/api/settings',          wrap(require('./api/settings/index')));
app.all('/api/pix/generate',      wrap(require('./api/pix/generate')));
app.all('/api/webhook/suitpay',   wrap(require('./api/webhook/suitpay')));
app.all('/api/logs',              wrap(require('./api/logs/index')));
app.all('/api/debug',             wrap(require('./api/debug')));

const PORT = 3001;
app.listen(PORT, () => console.log(`API local rodando em http://localhost:${PORT}`));
