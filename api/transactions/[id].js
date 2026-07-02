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
      // Busca por id (UUID), id_transaction ou request_number — o que vier na URL
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const queries = [
        dbSelect('transactions', `?id_transaction=eq.${id}&limit=1`),
        dbSelect('transactions', `?request_number=eq.${id}&limit=1`),
      ];
      if (isUuid) queries.unshift(dbSelect('transactions', `?id=eq.${id}&limit=1`));

      const results = await Promise.all(queries);
      const tx = results.find(r => r.length > 0)?.[0];
      if (!tx) return res.status(404).json({ error: 'Transação não encontrada' });

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
