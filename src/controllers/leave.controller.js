const { queryAsTenant } = require('../config/db');

async function listLeaveTypes(req, res) {
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select id, name, days_per_year from leave_types order by name`
    );
    res.json({ leaveTypes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch leave types' });
  }
}

async function listLeaveRequests(req, res) {
  let { employeeId } = req.query;
  const { status } = req.query;

  const canViewAll = req.auth.permissions.includes('*') || req.auth.permissions.includes('leave.approve');
  if (!canViewAll) {
    employeeId = req.auth.employeeId; // self-service: force-scoped, same pattern as tasks
  }

  const conditions = [];
  const params = [];
  if (employeeId) { params.push(employeeId); conditions.push(`lr.employee_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`lr.status = $${params.length}`); }
  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';

  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select lr.id, lr.start_date, lr.end_date, lr.reason, lr.status, lr.created_at,
              lt.name as leave_type, u.full_name as employee_name
       from leave_requests lr
       join leave_types lt on lt.id = lr.leave_type_id
       join employees e on e.id = lr.employee_id
       join users u on u.id = e.user_id
       ${whereClause}
       order by lr.created_at desc`,
      params
    );
    res.json({ leaveRequests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
}

async function submitLeaveRequest(req, res) {
  const { leaveTypeId, startDate, endDate, reason } = req.body;
  if (!leaveTypeId || !startDate || !endDate) {
    return res.status(400).json({ error: 'leaveTypeId, startDate, and endDate are required' });
  }
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into leave_requests (company_id, employee_id, leave_type_id, start_date, end_date, reason)
       values ($1, $2, $3, $4, $5, $6)
       returning id, start_date, end_date, reason, status, created_at`,
      [req.tenantContext.companyId, req.auth.employeeId, leaveTypeId, startDate, endDate, reason || null]
    );
    res.status(201).json({ leaveRequest: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit leave request' });
  }
}

async function updateLeaveStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['approved', 'rejected', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update leave_requests set status = $1, approved_by = $2 where id = $3 returning id, status`,
      [status, req.auth.employeeId || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Leave request not found' });
    res.json({ leaveRequest: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update leave request' });
  }
}

module.exports = { listLeaveTypes, listLeaveRequests, submitLeaveRequest, updateLeaveStatus };