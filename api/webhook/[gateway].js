const payfortHandler  = require('./_payfort');
const suitpayHandler  = require('./_suitpay');
const bynetHandler    = require('./_bynet');
const umbrellaHandler = require('./_umbrella');

const HANDLERS = {
  payfort:   (req, res) => payfortHandler(req, res,  'utmify_token'),
  payfort2:  (req, res) => payfortHandler(req, res,  'utmify_token_2'),
  suitpay:   (req, res) => suitpayHandler(req, res,  'utmify_token'),
  suitpay2:  (req, res) => suitpayHandler(req, res,  'utmify_token_2'),
  bynet:     (req, res) => bynetHandler(req, res,    'utmify_token'),
  bynet2:    (req, res) => bynetHandler(req, res,    'utmify_token_2'),
  umbrella:  (req, res) => umbrellaHandler(req, res, 'utmify_token'),
  umbrella2: (req, res) => umbrellaHandler(req, res, 'utmify_token_2'),
};

module.exports = async (req, res) => {
  const gateway = req.query.gateway;
  const handler = HANDLERS[gateway];
  if (!handler) return res.status(404).json({ error: `Webhook gateway desconhecido: ${gateway}` });
  return handler(req, res);
};
