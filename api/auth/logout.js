const cookie = require('cookie');

module.exports = (req, res) => {
  res.setHeader('Set-Cookie', cookie.serialize('pix_token', '', {
    httpOnly: true, path: '/', maxAge: 0,
  }));
  res.status(200).json({ ok: true });
};
