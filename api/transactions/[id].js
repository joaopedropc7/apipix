const { dbSelect, dbUpdate, authenticate, addLog } = require('../_helpers');

module.exports = async (req, res) => {
  if (!authenticate(req, res)) return;

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const rows = await dbSelect('transactions', `?id=eq.${id}`);
      if (!rows.length) return res.status(404).json({ error: 'Transação não encontrada' });
      return res.status(200).json(rows[0]);
    }

    if (req.method === 'PATCH' && req.body?.action === 'cancel') {
      await dbUpdate('transactions', `id=eq.${id}`, {
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      });
      await addLog('info', 'transaction', `Transação cancelada: ${id}`);
      return res.status(200).json({ ok: true });
    }

    res.status(405).end();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
