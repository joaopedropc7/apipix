require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });
const axios = require('axios');

module.exports = async (req, res) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  const result = {
    env: {
      SUPABASE_URL: url || '❌ ausente',
      SUPABASE_ANON_KEY: key ? '✅ definida' : '❌ ausente',
      JWT_SECRET: process.env.JWT_SECRET ? '✅ definida' : '❌ ausente',
    },
    connectivity: null,
    settings_count: null,
    error: null,
  };

  try {
    const { data } = await axios.get(`${url}/rest/v1/settings?select=key`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      timeout: 10000,
    });
    result.connectivity = '✅ conectado';
    result.settings_count = data?.length ?? 0;
  } catch (err) {
    result.connectivity = '❌ falhou';
    result.error = err.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;
  }

  res.status(200).json(result);
};
