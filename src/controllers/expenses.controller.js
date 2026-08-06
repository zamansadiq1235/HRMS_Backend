const { queryAsTenant } = require('../config/db');

async function listExpenses(req, res) {
  const { employeeId, status } = req.query;
  const conditions = [];
  const params = [];
  if (employeeId) { params.push(employeeId); conditions.push(`ex.employee_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`ex.status = $${params.length}`); }
  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';

  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select ex.id, ex.amount, ex.currency, ex.status, ex.receipt_url, ex.created_at,
              u.full_name as employee_name, ec.name as category
       from expenses ex
       join employees e on e.id = ex.employee_id
       join users u on u.id = e.user_id
       left join expense_categories ec on ec.id = ex.category_id
       ${whereClause}
       order by ex.created_at desc`,
      params
    );
    res.json({ expenses: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
}

async function submitExpense(req, res) {
  const { amount, currency, categoryId, receiptUrl } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into expenses (company_id, employee_id, category_id, amount, currency, receipt_url)
       values ($1, $2, $3, $4, $5, $6)
       returning id, amount, currency, status, created_at`,
      [req.tenantContext.companyId, req.auth.employeeId, categoryId || null, amount, currency || 'USD', receiptUrl || null]
    );
    res.status(201).json({ expense: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit expense' });
  }
}

async function updateExpenseStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['approved', 'rejected', 'reimbursed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update expenses set status = $1 where id = $2 returning id, status`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    res.json({ expense: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
}

module.exports = { listExpenses, submitExpense, updateExpenseStatus };
