function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

function redirectIfLoggedIn(req, res, next) {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  next();
}

module.exports = { requireLogin, redirectIfLoggedIn };
