const express = require('express');
const router = express.Router();
const { getSupabase } = require('../db/supabase');
const { requireLogin } = require('../middleware/auth');

router.get('/', requireLogin, (req, res) => res.redirect('/dashboard'));

router.get('/dashboard', requireLogin, async (req, res) => {
  const sb = getSupabase();

  const empty = {
    title: 'Dashboard - PIX Admin', active: 'dashboard', user: req.session.user,
    stats: { total: 0, pending: 0, paid: 0, cancelled: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 },
    recent: [], last7days: '[]', supabaseWarning: !sb,
  };

  if (!sb) return res.render('dashboard', empty);

  try {
    const [allRes, recentRes, chartRes] = await Promise.all([
      sb.from('transactions').select('status, amount'),
      sb.from('transactions').select('*').order('created_at', { ascending: false }).limit(10),
      sb.from('transactions')
        .select('created_at, amount')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    ]);

    const all = allRes.data || [];
    const stats = {
      total: all.length,
      pending: all.filter(t => t.status === 'pending').length,
      paid: all.filter(t => t.status === 'paid').length,
      cancelled: all.filter(t => ['cancelled', 'expired'].includes(t.status)).length,
      totalAmount: all.reduce((s, t) => s + (t.amount || 0), 0),
      paidAmount: all.filter(t => t.status === 'paid').reduce((s, t) => s + (t.amount || 0), 0),
      pendingAmount: all.filter(t => t.status === 'pending').reduce((s, t) => s + (t.amount || 0), 0),
    };

    const dayMap = {};
    (chartRes.data || []).forEach(t => {
      const day = t.created_at.slice(0, 10);
      if (!dayMap[day]) dayMap[day] = { day, count: 0, total: 0 };
      dayMap[day].count++;
      dayMap[day].total += t.amount || 0;
    });
    const last7days = Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day));

    res.render('dashboard', {
      title: 'Dashboard - PIX Admin',
      active: 'dashboard',
      user: req.session.user,
      stats,
      recent: recentRes.data || [],
      last7days: JSON.stringify(last7days),
      supabaseWarning: false,
    });
  } catch (err) {
    res.render('dashboard', empty);
  }
});

module.exports = router;
