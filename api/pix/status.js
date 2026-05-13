const { dbSelect, getSettings, setCors } = require('../_helpers');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const settings = await getSettings();
  const apiKey = req.headers['api-key'] || req.headers['x-api-key'];
  if (!settings.api_key || apiKey !== settings.api_key) {
    return res.status(401).json({ error: 'API Key inválida ou ausente' });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Informe o id no parâmetro: /api/pix/status?id=...' });

  // Busca por ID interno, idTransaction da SuitPay ou requestNumber
  const [byId, byIdTransaction, byRequestNumber] = await Promise.all([
    dbSelect('transactions', `?id=eq.${id}&limit=1`),
    dbSelect('transactions', `?id_transaction=eq.${id}&limit=1`),
    dbSelect('transactions', `?request_number=eq.${id}&limit=1`),
  ]);

  const tx = byId[0] || byIdTransaction[0] || byRequestNumber[0];

  if (!tx) return res.status(404).json({ error: 'Transação não encontrada' });

  return res.status(200).json({
    id:            tx.id,
    requestNumber: tx.request_number,
    idTransaction: tx.id_transaction,
    status:        tx.status,
    amount:        tx.amount,
    dueDate:       tx.due_date,
    paymentCode:   tx.payment_code,
    paymentDate:   tx.payment_date,
    paidValue:     tx.paid_value,
    payerName:     tx.payer_name,
    payerTaxId:    tx.payer_tax_id,
    createdAt:     tx.created_at,
    updatedAt:     tx.updated_at,
  });
};
