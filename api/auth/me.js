const { authenticate } = require('../_helpers');

module.exports = (req, res) => {
  const user = authenticate(req, res);
  if (!user) return;
  res.status(200).json({ username: user.username });
};
