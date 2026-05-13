require('dotenv').config({ override: true });
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).json({
      message: 'Envie POST para este endpoint para criar/resetar o admin.',
      warning: 'REMOVA este arquivo após o setup inicial.',
    });
  }

  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const hash = await bcrypt.hash('password', 10);

    const rows = [
      { key: 'admin_user',          value: 'admin' },
      { key: 'admin_password_hash', value: hash },
      { key: 'suitpay_ci',          value: '' },
      { key: 'suitpay_cs',          value: '' },
      { key: 'suitpay_environment', value: 'sandbox' },
      { key: 'api_key',             value: '' },
      { key: 'server_base_url',     value: '' },
    ];

    for (const row of rows) {
      await sb.from('settings').upsert(row);
    }

    return res.status(200).json({
      ok: true,
      message: 'Setup concluído. Login: admin / password',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
