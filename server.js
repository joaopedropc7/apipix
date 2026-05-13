require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// CORS liberado para a API ser chamada de qualquer origem
app.use('/api', cors());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'pixadmin-secret-2024-xk9p',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 },
}));

// Painel admin
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/', require('./routes/transactions'));
app.use('/', require('./routes/settings'));
app.use('/', require('./routes/logs'));
app.use('/', require('./routes/docs'));

// Webhook da SuitPay (sem autenticação — chamado pela SuitPay)
app.use('/', require('./routes/webhook'));

// API REST pública (autenticada por api-key)
app.use('/', require('./routes/api'));

app.use((req, res) => {
  res.status(404).render('404', { title: '404 - PIX Admin', user: req.session?.user });
});

app.listen(PORT, () => {
  console.log(`\n✅ PIX Admin rodando em http://localhost:${PORT}`);
  console.log(`   Painel:  http://localhost:${PORT}/dashboard`);
  console.log(`   API:     http://localhost:${PORT}/api/v1/gateway/request-qrcode\n`);
});
