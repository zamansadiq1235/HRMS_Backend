const { pool } = require('../config/db');

async function getPlatformAnalytics(req, res) {
  try {
    const [mrr, planDistribution, companyGrowth, employeeGrowth, statusBreakdown] = await Promise.all([
      // Monthly recurring revenue: sum of active subscriptions' plan prices
      pool.query(
        `select coalesce(sum(p.price_monthly), 0) as mrr
         from subscriptions s
         join plans p on p.id = s.plan_id
         where s.status = 'active'`
      ),

      // How many companies are on each plan
      pool.query(
        `select p.name as plan_name, count(s.id)::int as company_count
         from plans p
         left join subscriptions s on s.plan_id = p.id and s.status = 'active'
         group by p.name
         order by p.price_monthly asc`
      ),

      // New companies per month, last 6 months
      pool.query(
        `select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*)::int as count
         from companies
         where created_at >= now() - interval '6 months'
         group by 1
         order by 1 asc`
      ),

      // New employees per month, last 6 months (platform-wide adoption signal)
      pool.query(
        `select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*)::int as count
         from employees
         where created_at >= now() - interval '6 months'
         group by 1
         order by 1 asc`
      ),

      // Company status breakdown (active/suspended/deleted)
      pool.query(
        `select status, count(*)::int as count from companies group by status`
      ),
    ]);

    res.json({
      mrr: Number(mrr.rows[0].mrr),
      planDistribution: planDistribution.rows,
      companyGrowth: companyGrowth.rows,
      employeeGrowth: employeeGrowth.rows,
      statusBreakdown: statusBreakdown.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch platform analytics' });
  }
}

module.exports = { getPlatformAnalytics };
