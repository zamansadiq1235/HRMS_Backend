const { queryAsTenant } = require('../config/db');

async function listPayroll(req, res) {
  let { employeeId } = req.query;

  const canViewAll = req.auth.permissions.includes('*') || req.auth.permissions.includes('payroll.manage');
  if (!canViewAll) {
    employeeId = req.auth.employeeId;
  }

  const conditions = [];
  const params = [];
  if (employeeId) { params.push(employeeId); conditions.push(`p.employee_id = $${params.length}`); }
  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';

  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select p.id, p.employee_id, p.period_month, p.period_year, p.gross_pay, p.net_pay, p.status,
              u.full_name as employee_name
       from payroll p
       join employees e on e.id = p.employee_id
       join users u on u.id = e.user_id
       ${whereClause}
       order by p.period_year desc, p.period_month desc`,
      params
    );
    res.json({ payroll: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payroll' });
  }
}

async function createPayroll(req, res) {
  const { employeeId, periodMonth, periodYear, grossPay, netPay } = req.body;
  if (!employeeId || !periodMonth || !periodYear || grossPay == null || netPay == null) {
    return res.status(400).json({
      error: 'employeeId, periodMonth, periodYear, grossPay, and netPay are required',
    });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into payroll (company_id, employee_id, period_month, period_year, gross_pay, net_pay, status)
       values ($1, $2, $3, $4, $5, $6, 'processed')
       returning id, period_month, period_year, gross_pay, net_pay, status`,
      [req.tenantContext.companyId, employeeId, periodMonth, periodYear, grossPay, netPay]
    );
    res.status(201).json({ payroll: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payroll record' });
  }
}

async function updatePayrollStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['draft', 'processed', 'paid'].includes(status)) {
    return res.status(400).json({ error: "status must be 'draft', 'processed', or 'paid'" });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update payroll set status = $1 where id = $2 returning id, status`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payroll record not found' });
    res.json({ payroll: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update payroll status' });
  }
}

module.exports = { listPayroll, createPayroll, updatePayrollStatus };
