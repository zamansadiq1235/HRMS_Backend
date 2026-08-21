const { pool } = require('../config/db');

async function getPlatformOverview(req, res) {
  try {
    const [companies, employees, activeSubscriptions, openTickets, recentCompanies] = await Promise.all([
      pool.query(`select count(*)::int as count from companies where status != 'deleted'`),
      pool.query(`select count(*)::int as count from employees where employment_status = 'active'`),
      pool.query(`select count(*)::int as count from subscriptions where status = 'active'`),
      pool.query(`select count(*)::int as count from support_tickets where status in ('open', 'in_progress')`),
      pool.query(
        `select id, name, status, created_at from companies order by created_at desc limit 10`
      ),
    ]);

    res.json({
      stats: {
        totalCompanies: companies.rows[0].count,
        totalEmployees: employees.rows[0].count,
        activeSubscriptions: activeSubscriptions.rows[0].count,
        openSupportTickets: openTickets.rows[0].count,
      },
      recentCompanies: recentCompanies.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch platform overview' });
  }
}

module.exports = { getPlatformOverview };
