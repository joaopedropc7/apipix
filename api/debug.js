require('dotenv').config({ override: true });
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const result = {
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ? '✅ definida' : '❌ ausente',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? '✅ definida' : '❌ ausente',
      JWT_SECRET: process.env.JWT_SECRET ? '✅ definida' : '❌ ausente',
    },
    supabase: null,
    settings_count: null,
    error: null,
  };

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    result.error = 'Variáveis de ambiente ausentes';
    return res.status(200).json(result);
  }

  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { fetch },
    });
    const { data, error } = await sb.from('settings').select('key');

    if (error) {
      result.supabase = '❌ erro na query';
      result.error = error.message;
    } else {
      result.supabase = '✅ conectado';
      result.settings_count = data?.length ?? 0;
    }
  } catch (err) {
    result.supabase = '❌ falhou';
    result.error = err.message;
  }

  res.status(200).json(result);
};
