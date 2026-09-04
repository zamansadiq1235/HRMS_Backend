const { queryAsTenant } = require('../config/db');
const { pool } = require('../config/db');

/**
 * Company-side: an admin views their own company's audit trail.
 */
async function listCompanyAuditLogs(req, res) {
  const { action, from, to } = req.query;
  const conditions = ['al.company_id = $1'];
  const params = [req.tenantContext.companyId];
  if (action) { params.push(`%${action}%`); conditions.push(`al.action ilike $${params.length}`); }
  if (from) { params.push(from); conditions.push(`al.created_at::date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`al.created_at::date <= $${params.length}`); }

  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select al.id, al.action, al.entity, al.entity_id, al.metadata, al.created_at, u.full_name as actor_name
       from activity_logs al
       left join users u on u.id = al.user_id
       where ${conditions.join(' and ')}
       order by al.created_at desc
       limit 200`,
      params
    );
    res.json({ logs: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
}

/**
 * Platform owner: sees audit logs across EVERY company, with the company
 * name attached — not tenant-scoped, uses pool.query directly.
 */
async function listAllAuditLogs(req, res) {
  const { action, companyId } = req.query;
  const conditions = [];
  const params = [];
  if (action) { params.push(`%${action}%`); conditions.push(`al.action ilike $${params.length}`); }
  if (companyId) { params.push(companyId); conditions.push(`al.company_id = $${params.length}`); }
  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';

  try {
    const result = await pool.query(
      `select al.id, al.action, al.entity, al.entity_id, al.metadata, al.created_at,
              u.full_name as actor_name, c.name as company_name
       from activity_logs al
       left join users u on u.id = al.user_id
       left join companies c on c.id = al.company_id
       ${whereClause}
       order by al.created_at desc
       limit 300`,
      params
    );
    res.json({ logs: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
}

module.exports = { listCompanyAuditLogs, listAllAuditLogs };
