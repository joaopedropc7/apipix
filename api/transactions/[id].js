const { getSupabase, authenticate, addLog } = require('../_helpers');

module.exports = async (req, res) => {
  if (!authenticate(req, res)) return;

  const sb = getSupabase();
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await sb.from('transactions').select('*').eq('id', id).single();
    if (error || !data) return res.status(404).json({ error: 'Transação não encontrada' });
    return res.status(200).json(data);
  }

  if (req.method === 'PATCH') {
    const { action } = req.body;
    if (action === 'cancel') {
      await sb.from('transactions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
      await addLog(sb, 'info', 'transaction', `Transação cancelada: ${id}`);
      return res.status(200).json({ ok: true });
    }
  }

  res.status(405).end();
};
