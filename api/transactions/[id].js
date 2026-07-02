const { dbSelect, dbUpdate, getSettings, authenticate, addLog } = require('../_helpers');

module.exports = async (req, res) => {
  // Aceita autenticação por cookie JWT (painel admin) OU por api-key header (API externa)
  const apiKey = req.headers['api-key'] || req.headers['x-api-key'];
  if (apiKey) {
    const settings = await getSettings();
    if (!settings.api_key || apiKey !== settings.api_key) {
      return res.status(401).json({ error: 'API Key inválida' });
    }
  } else {
    if (!authenticate(req, res)) return;
  }

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const rows = await dbSelect('transactions', `?id=eq.${id}&select=*`);
      if (!rows.length) return res.status(404).json({ error: 'Transação não encontrada' });
      const tx = rows[0];

      // Garante que raw_request é objeto (não string)
      if (typeof tx.raw_request === 'string') {
        try { tx.raw_request = JSON.parse(tx.raw_request); } catch (_) {}
      }

      return res.status(200).json(tx);
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
