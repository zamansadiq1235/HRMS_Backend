const { queryAsTenant } = require('../config/db');

async function checkIn(req, res) {
  const { lat, lng } = req.body;
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  try {
    const existing = await queryAsTenant(
      req.tenantContext,
      `select id from attendance
       where employee_id = $1 and check_in::date = current_date and check_out is null`,
      [req.auth.employeeId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already checked in today' });
    }
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into attendance (company_id, employee_id, check_in, check_in_lat, check_in_lng, status)
       values ($1, $2, now(), $3, $4, 'present')
       returning id, check_in, status`,
      [req.tenantContext.companyId, req.auth.employeeId, lat || null, lng || null]
    );
    res.status(201).json({ attendance: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check in' });
  }
}

async function checkOut(req, res) {
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update attendance
       set check_out = now()
       where employee_id = $1 and check_in::date = current_date and check_out is null
       returning id, check_in, check_out,
                 round(extract(epoch from (now() - check_in)) / 3600.0, 2) as hours_worked`,
      [req.auth.employeeId]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active check-in found for today' });
    }
    res.json({ attendance: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check out' });
  }
}

async function listAttendance(req, res) {
  const { employeeId, from, to } = req.query;
  const conditions = [];
  const params = [];
  if (employeeId) { params.push(employeeId); conditions.push(`a.employee_id = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`a.check_in::date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`a.check_in::date <= $${params.length}`); }
  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';

  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select a.id, a.employee_id, u.full_name, a.check_in, a.check_out, a.status,
              round(extract(epoch from (coalesce(a.check_out, now()) - a.check_in)) / 3600.0, 2) as hours_worked
       from attendance a
       join employees e on e.id = a.employee_id
       join users u on u.id = e.user_id
       ${whereClause}
       order by a.check_in desc`,
      params
    );
    res.json({ attendance: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
}

module.exports = { checkIn, checkOut, listAttendance };
