const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { pool } = require('../config/db');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateTempPassword() {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x').slice(0, 12);
}

/**
 * Every function here operates outside any single tenant's scope — the
 * platform owner sees/manages ALL companies, so these use pool.query
 * directly rather than queryAsTenant (which would scope to one company_id).
 */

async function listCompanies(req, res) {
  try {
    const result = await pool.query(
      `select c.id, c.name, c.industry, c.country, c.status, c.created_at,
              p.name as plan_name, s.status as subscription_status,
              (select count(*) from employees e where e.company_id = c.id and e.employment_status = 'active') as employee_count
       from companies c
       left join subscriptions s on s.company_id = c.id
       left join plans p on p.id = s.plan_id
       order by c.created_at desc`
    );
    res.json({ companies: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
}

async function getCompany(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `select c.*, p.name as plan_name, s.status as subscription_status
       from companies c
       left join subscriptions s on s.company_id = c.id
       left join plans p on p.id = s.plan_id
       where c.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Company not found' });
    res.json({ company: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
}

/**
 * Creates a new company AND its first company_admin in one call — a real
 * onboarding flow, not just an empty company shell nobody can log into.
 */
async function createCompany(req, res) {
  const { name, industry, country, timezone, planId, adminEmail, adminFullName } = req.body;
  if (!name || !adminEmail || !adminFullName) {
    return res.status(400).json({ error: 'name, adminEmail, and adminFullName are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("select set_config('app.is_platform_owner', 'true', true)");

    const { rows: companyRows } = await client.query(
      `insert into companies (name, industry, country, timezone, status)
       values ($1, $2, $3, $4, 'active')
       returning id, name, status, created_at`,
      [name, industry || null, country || null, timezone || 'UTC']
    );
    const company = companyRows[0];

    if (planId) {
      await client.query(
        `insert into subscriptions (company_id, plan_id, status) values ($1, $2, 'active')`,
        [company.id, planId]
      );
    }

    const { rows: roleRows } = await client.query(`select id from roles where name = 'company_admin'`);
    const roleId = roleRows[0].id;

    const tempPassword = generateTempPassword();
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: tempPassword,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      throw new Error(createError?.message || 'Failed to create admin login account');
    }

    await client.query(
      `insert into users (id, company_id, role_id, email, full_name, status)
       values ($1, $2, $3, $4, $5, 'active')`,
      [created.user.id, company.id, roleId, adminEmail, adminFullName]
    );

    await client.query('COMMIT');
    res.status(201).json({
      company,
      adminCredentials: { email: adminEmail, temporaryPassword: tempPassword },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    const isDuplicateEmail = /already been registered|already exists/i.test(err.message || '');
    res.status(isDuplicateEmail ? 409 : 500).json({
      error: isDuplicateEmail ? 'A user with this admin email already exists' : err.message || 'Failed to create company',
    });
  } finally {
    client.release();
  }
}

async function updateCompanyStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['active', 'suspended', 'deleted'].includes(status)) {
    return res.status(400).json({ error: "status must be 'active', 'suspended', or 'deleted'" });
  }
  try {
    const result = await pool.query(
      `update companies set status = $1, updated_at = now() where id = $2 returning id, name, status`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Company not found' });
    res.json({ company: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update company status' });
  }
}

module.exports = { listCompanies, getCompany, createCompany, updateCompanyStatus };
