require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });
const bcrypt = require('bcryptjs');
const { dbUpsert } = require('./_helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).json({ message: 'Envie POST para resetar o admin. Login: admin / password' });
  }
  try {
    const hash = await bcrypt.hash('password', 10);
    const rows = [
      { key: 'admin_user', value: 'admin' },
      { key: 'admin_password_hash', value: hash },
      { key: 'suitpay_ci', value: '' },
      { key: 'suitpay_cs', value: '' },
      { key: 'suitpay_environment', value: 'sandbox' },
      { key: 'api_key', value: '' },
      { key: 'server_base_url', value: '' },
    ];
    for (const row of rows) await dbUpsert('settings', row);
    return res.status(200).json({ ok: true, message: 'Setup concluído. Login: admin / password' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
