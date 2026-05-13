const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { getSettings, addLog } = require('../_helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password } = req.body;
  const settings = await getSettings();

  if (username !== settings.admin_user) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  const valid = await bcrypt.compare(password, settings.admin_password_hash || '');
  if (!valid) {
    await addLog('warn', 'auth', `Login falhou: ${username}`);
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }

  const token = jwt.sign(
    { username },
    process.env.JWT_SECRET || 'pixadmin-jwt-secret',
    { expiresIn: '8h' }
  );

  res.setHeader('Set-Cookie', cookie.serialize('pix_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60,
    path: '/',
  }));

  await addLog('info', 'auth', `Login bem-sucedido: ${username}`);
  res.status(200).json({ ok: true, username });
};
