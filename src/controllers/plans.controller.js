const { pool } = require('../config/db');

/**
 * The plan catalog — what subscription tiers exist and what each includes.
 * Not tenant-scoped: platform owner manages this globally, every company
 * picks from the same set of plans.
 */
async function listPlans(req, res) {
  try {
    const result = await pool.query(
      `select id, name, price_monthly, employee_limit, storage_limit_mb, admin_limit,
              has_advanced_reports, has_analytics, has_payroll, has_recruitment,
              has_api_access, has_custom_branding
       from plans
       order by price_monthly asc`
    );
    res.json({ plans: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
}

async function createPlan(req, res) {
  const {
    name, priceMonthly, employeeLimit, storageLimitMb, adminLimit,
    hasAdvancedReports, hasAnalytics, hasPayroll, hasRecruitment, hasApiAccess, hasCustomBranding,
  } = req.body;
  if (!name || employeeLimit == null || storageLimitMb == null || adminLimit == null) {
    return res.status(400).json({ error: 'name, employeeLimit, storageLimitMb, and adminLimit are required' });
  }
  try {
    const result = await pool.query(
      `insert into plans
         (name, price_monthly, employee_limit, storage_limit_mb, admin_limit,
          has_advanced_reports, has_analytics, has_payroll, has_recruitment, has_api_access, has_custom_branding)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning *`,
      [
        name, priceMonthly || 0, employeeLimit, storageLimitMb, adminLimit,
        !!hasAdvancedReports, !!hasAnalytics, !!hasPayroll, !!hasRecruitment, !!hasApiAccess, !!hasCustomBranding,
      ]
    );
    res.status(201).json({ plan: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create plan' });
  }
}

/**
 * Assigns (or changes) a company's subscription plan. If the company
 * already has a subscription row, updates it in place rather than creating
 * a second one — a company has exactly one active subscription at a time.
 */
async function assignCompanyPlan(req, res) {
  const { id: companyId } = req.params;
  const { planId } = req.body;
  if (!planId) return res.status(400).json({ error: 'planId is required' });

  try {
    const existing = await pool.query(`select id from subscriptions where company_id = $1`, [companyId]);

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `update subscriptions
         set plan_id = $1, status = 'active', current_period_start = now(), current_period_end = now() + interval '30 days'
         where company_id = $2
         returning *`,
        [planId, companyId]
      );
    } else {
      result = await pool.query(
        `insert into subscriptions (company_id, plan_id, status, current_period_end)
         values ($1, $2, 'active', now() + interval '30 days')
         returning *`,
        [companyId, planId]
      );
    }
    res.json({ subscription: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign plan' });
  }
}

async function updateSubscriptionStatus(req, res) {
  const { id: companyId } = req.params;
  const { status } = req.body;
  if (!['active', 'trialing', 'past_due', 'canceled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const result = await pool.query(
      `update subscriptions set status = $1 where company_id = $2 returning *`,
      [status, companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No subscription found for this company' });
    res.json({ subscription: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update subscription status' });
  }
}

module.exports = { listPlans, createPlan, assignCompanyPlan, updateSubscriptionStatus };
