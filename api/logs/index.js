const { getSB, authenticate } = require('../_helpers');

module.exports = async (req, res) => {
  if (!authenticate(req, res)) return;

  const sb = getSB();

  if (req.method === 'GET') {
    const { level, type, page = 1, limit = 50 } = req.query;
    const from = (parseInt(page) - 1) * parseInt(limit);
    const to = from + parseInt(limit) - 1;

    let q = sb.from('logs').select('*', { count: 'exact' });
    if (level) q = q.eq('level', level);
    if (type)  q = q.eq('type', type);

    const { data, count } = await q.order('created_at', { ascending: false }).range(from, to);
    return res.status(200).json({ logs: data || [], total: count || 0, page: parseInt(page) });
  }

  if (req.method === 'DELETE') {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    await sb.from('logs').delete().lt('created_at', cutoff);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
};
