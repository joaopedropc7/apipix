const { getSupabase, authenticate } = require('../_helpers');

module.exports = async (req, res) => {
  if (!authenticate(req, res)) return;

  const sb = getSupabase();
  const { status, search, page = 1, limit = 20 } = req.query;
  const from = (parseInt(page) - 1) * parseInt(limit);
  const to = from + parseInt(limit) - 1;

  let query = sb.from('transactions')
    .select('id, request_number, id_transaction, client_name, client_document, amount, status, due_date, created_at, payment_date', { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (search) query = query.or(`client_name.ilike.%${search}%,client_document.ilike.%${search}%,request_number.ilike.%${search}%`);

  const { data, count } = await query.order('created_at', { ascending: false }).range(from, to);

  res.status(200).json({ transactions: data || [], total: count || 0, page: parseInt(page) });
};
