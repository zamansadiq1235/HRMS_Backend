const { queryAsTenant } = require('../config/db');

async function getDashboardOverview(req, res) {
  try {
    const [employeeCount, presentToday, pendingLeave, pendingExpense, openTasks, recentActivity] = await Promise.all([
      queryAsTenant(req.tenantContext, `select count(*)::int as count from employees where employment_status = 'active'`),
      queryAsTenant(req.tenantContext, `select count(distinct employee_id)::int as count from attendance where check_in::date = current_date`),
      queryAsTenant(req.tenantContext, `select count(*)::int as count from leave_requests where status = 'pending'`),
      queryAsTenant(req.tenantContext, `select count(*)::int as count from expenses where status = 'pending'`),
      queryAsTenant(req.tenantContext, `select count(*)::int as count from tasks where status != 'done'`),
      queryAsTenant(req.tenantContext, `select al.action, al.entity, al.created_at, u.full_name as actor_name
         from activity_logs al left join users u on u.id = al.user_id order by al.created_at desc limit 20`),
    ]);
    res.json({
      stats: {
        activeEmployees: employeeCount.rows[0].count,
        presentToday: presentToday.rows[0].count,
        pendingLeaveRequests: pendingLeave.rows[0].count,
        pendingExpenses: pendingExpense.rows[0].count,
        openTasks: openTasks.rows[0].count,
      },
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
}

module.exports = { getDashboardOverview };
