require('dotenv').config({ override: true });
const axios = require('axios');

module.exports = async (req, res) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  const result = {
    env: {
      SUPABASE_URL: url ? `✅ ${url}` : '❌ ausente',
      SUPABASE_ANON_KEY: key ? '✅ definida' : '❌ ausente',
      JWT_SECRET: process.env.JWT_SECRET ? '✅ definida' : '❌ ausente',
    },
    connectivity: null,
    settings_count: null,
    error: null,
  };

  if (!url || !key) {
    result.error = 'Variáveis ausentes';
    return res.status(200).json(result);
  }

  try {
    const response = await axios.get(`${url}/rest/v1/settings?select=key`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      timeout: 10000,
    });
    result.connectivity = '✅ conectado via axios';
    result.settings_count = response.data?.length ?? 0;
  } catch (err) {
    result.connectivity = '❌ falhou';
    result.error = err.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;
  }

  res.status(200).json(result);
};
