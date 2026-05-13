const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { getSettings, addLog } = require('./_helpers');

module.exports = async (req, res) => {
  const action = req.query.action;

  // POST /api/auth?action=login
  if (action === 'login' && req.method === 'POST') {
    const { username, password } = req.body;
    let settings;
    try { settings = await getSettings(); } catch (err) {
      return res.status(503).json({ error: `Banco não configurado: ${err.message}` });
    }
    if (username !== settings.admin_user) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    const valid = await bcrypt.compare(password, settings.admin_password_hash || '');
    if (!valid) {
      await addLog('warn', 'auth', `Login falhou: ${username}`);
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    const token = jwt.sign({ username }, process.env.JWT_SECRET || 'pixadmin-jwt-secret', { expiresIn: '8h' });
    res.setHeader('Set-Cookie', cookie.serialize('pix_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60,
      path: '/',
    }));
    await addLog('info', 'auth', `Login bem-sucedido: ${username}`);
    return res.status(200).json({ ok: true, username });
  }

  // POST /api/auth?action=logout
  if (action === 'logout') {
    res.setHeader('Set-Cookie', cookie.serialize('pix_token', '', { httpOnly: true, path: '/', maxAge: 0 }));
    return res.status(200).json({ ok: true });
  }

  // GET /api/auth?action=me
  if (action === 'me') {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.pix_token;
    if (!token) return res.status(401).json({ error: 'Não autenticado' });
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET || 'pixadmin-jwt-secret');
      return res.status(200).json({ username: user.username });
    } catch {
      return res.status(401).json({ error: 'Sessão expirada' });
    }
  }

  res.status(400).json({ error: 'Action inválida' });
};
