const bynetHandler    = require('./_bynet');
const umbrellaHandler = require('./_umbrella');
const axxonHandler    = require('./_axxon');

const HANDLERS = {
  bynet:     (req, res) => bynetHandler(req, res,    'utmify_token'),
  bynet2:    (req, res) => bynetHandler(req, res,    'utmify_token_2'),
  umbrella:  (req, res) => umbrellaHandler(req, res, 'utmify_token'),
  umbrella2: (req, res) => umbrellaHandler(req, res, 'utmify_token_2'),
  axxon:     (req, res) => axxonHandler(req, res,    'utmify_token'),
  axxon2:    (req, res) => axxonHandler(req, res,    'utmify_token_2'),
};

module.exports = async (req, res) => {
  const gateway = req.query.gateway;
  const handler = HANDLERS[gateway];
  if (!handler) return res.status(404).json({ error: `Webhook gateway desconhecido: ${gateway}` });
  return handler(req, res);
};
