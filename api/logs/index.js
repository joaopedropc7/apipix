const { dbSelect, dbDelete, authenticate } = require('../_helpers');

module.exports = async (req, res) => {
  if (!authenticate(req, res)) return;

  if (req.method === 'GET') {
    const { level, type, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let filter = `?select=*&order=created_at.desc&limit=${limit}&offset=${offset}`;
    let countFilter = '?select=id';
    if (level) { filter += `&level=eq.${level}`; countFilter += `&level=eq.${level}`; }
    if (type)  { filter += `&type=eq.${type}`;   countFilter += `&type=eq.${type}`; }

    const [data, all] = await Promise.all([
      dbSelect('logs', filter),
      dbSelect('logs', countFilter),
    ]);

    return res.status(200).json({ logs: data, total: all.length, page: parseInt(page) });
  }

  if (req.method === 'DELETE') {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    await dbDelete('logs', `created_at=lt.${cutoff}`);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
};
