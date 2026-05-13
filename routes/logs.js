const express = require('express');
const router = express.Router();
const { getSupabase } = require('../db/supabase');
const { requireLogin } = require('../middleware/auth');

router.get('/logs', requireLogin, async (req, res) => {
  const { level, type, page = 1 } = req.query;
  const limit = 50;
  const from = (parseInt(page) - 1) * limit;
  const to = from + limit - 1;

  const sb = getSupabase();
  if (!sb) {
    return res.render('logs', {
      title: 'Logs - PIX Admin', active: 'logs', user: req.session.user,
      logs: [], total: 0, page: 1, pages: 1, level: '', type: '', supabaseWarning: true,
    });
  }

  let query = sb.from('logs').select('*', { count: 'exact' });
  if (level) query = query.eq('level', level);
  if (type) query = query.eq('type', type);

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  res.render('logs', {
    title: 'Logs - PIX Admin',
    active: 'logs',
    user: req.session.user,
    logs: data || [],
    total: count || 0,
    page: parseInt(page),
    pages: Math.ceil((count || 0) / limit),
    level: level || '',
    type: type || '',
    supabaseWarning: false,
  });
});

router.post('/logs/clear', requireLogin, async (req, res) => {
  const sb = getSupabase();
  if (sb) {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    await sb.from('logs').delete().lt('created_at', cutoff);
  }
  res.redirect('/logs');
});

module.exports = router;
