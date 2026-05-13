const { dbSelect, authenticate } = require('../_helpers');

module.exports = async (req, res) => {
  if (!authenticate(req, res)) return;

  const { status, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let filter = `?select=id,request_number,id_transaction,client_name,client_document,amount,status,due_date,created_at,payment_date&order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (status) filter += `&status=eq.${status}`;
  if (search) filter += `&or=(client_name.ilike.*${search}*,client_document.ilike.*${search}*,request_number.ilike.*${search}*)`;

  let countFilter = '?select=id';
  if (status) countFilter += `&status=eq.${status}`;
  if (search) countFilter += `&or=(client_name.ilike.*${search}*,client_document.ilike.*${search}*,request_number.ilike.*${search}*)`;

  const [data, all] = await Promise.all([
    dbSelect('transactions', filter),
    dbSelect('transactions', countFilter),
  ]);

  res.status(200).json({ transactions: data, total: all.length, page: parseInt(page) });
};
