const { createClient } = require('@supabase/supabase-js');
const { queryAsTenant } = require('../config/db');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const RECEIPT_BUCKET = 'receipts';

async function listExpenseCategories(req, res) {
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select id, name from expense_categories order by name`
    );
    res.json({ categories: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch expense categories' });
  }
}

async function listExpenses(req, res) {
  let { employeeId } = req.query;
  const { status } = req.query;

  const canViewAll = req.auth.permissions.includes('*') || req.auth.permissions.includes('reports.view');
  if (!canViewAll) {
    employeeId = req.auth.employeeId;
  }

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
  const { amount, currency, categoryId, description, receiptBase64, receiptExt } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }

  try {
    let receiptUrl = null;
    if (receiptBase64 && receiptExt) {
      try {
        const buffer = Buffer.from(receiptBase64, 'base64');
        const filePath = `${req.auth.employeeId}/${Date.now()}.${receiptExt}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from(RECEIPT_BUCKET)
          .upload(filePath, buffer, { contentType: `image/${receiptExt}` });
        if (!uploadError) {
          receiptUrl = supabaseAdmin.storage.from(RECEIPT_BUCKET).getPublicUrl(filePath).data.publicUrl;
        }
      } catch (uploadErr) {
        console.error('Receipt upload failed:', uploadErr);
      }
    }

    const result = await queryAsTenant(
      req.tenantContext,
      `insert into expenses (company_id, employee_id, category_id, amount, currency, receipt_url)
       values ($1, $2, $3, $4, $5, $6)
       returning id, amount, currency, status, receipt_url, created_at`,
      [
        req.tenantContext.companyId,
        req.auth.employeeId,
        categoryId || null,
        amount,
        currency || 'USD',
        receiptUrl,
      ]
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

module.exports = { listExpenseCategories, listExpenses, submitExpense, updateExpenseStatus };
