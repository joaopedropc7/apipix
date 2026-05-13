const { getSB, authenticate } = require('./_helpers');

module.exports = async (req, res) => {
  if (!authenticate(req, res)) return;

  const sb = getSB();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [allRes, recentRes, chartRes] = await Promise.all([
    sb.from('transactions').select('status, amount'),
    sb.from('transactions').select('id, request_number, client_name, amount, status, created_at').order('created_at', { ascending: false }).limit(10),
    sb.from('transactions').select('created_at, amount').gte('created_at', sevenDaysAgo),
  ]);

  const all = allRes.data || [];
  const stats = {
    total: all.length,
    pending: all.filter(t => t.status === 'pending').length,
    paid: all.filter(t => t.status === 'paid').length,
    cancelled: all.filter(t => ['cancelled', 'expired'].includes(t.status)).length,
    totalAmount: all.reduce((s, t) => s + parseFloat(t.amount || 0), 0),
    paidAmount: all.filter(t => t.status === 'paid').reduce((s, t) => s + parseFloat(t.amount || 0), 0),
    pendingAmount: all.filter(t => t.status === 'pending').reduce((s, t) => s + parseFloat(t.amount || 0), 0),
  };

  const dayMap = {};
  (chartRes.data || []).forEach(t => {
    const day = t.created_at.slice(0, 10);
    if (!dayMap[day]) dayMap[day] = { day, count: 0, total: 0 };
    dayMap[day].count++;
    dayMap[day].total += parseFloat(t.amount || 0);
  });

  res.status(200).json({
    stats,
    recent: recentRes.data || [],
    chart: Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day)),
  });
};
