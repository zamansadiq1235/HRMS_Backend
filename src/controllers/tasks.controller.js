const { queryAsTenant } = require('../config/db');

async function listTasks(req, res) {
  const { employeeId, status, date } = req.query;
  const conditions = [];
  const params = [];
  if (employeeId) { params.push(employeeId); conditions.push(`assigned_to = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  if (date) { params.push(date); conditions.push(`due_date = $${params.length}`); }
  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';

  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select t.id, t.title, t.description, t.status, t.due_date,
              t.assigned_to, t.assigned_by, t.created_at,
              ua.full_name as assigned_to_name
       from tasks t
       left join employees ea on ea.id = t.assigned_to
       left join users ua on ua.id = ea.user_id
       ${whereClause}
       order by t.due_date nulls last, t.created_at desc`,
      params
    );
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

async function createTask(req, res) {
  const { title, description, assignedTo, dueDate } = req.body;
  if (!title || !assignedTo) {
    return res.status(400).json({ error: 'title and assignedTo are required' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into tasks (company_id, title, description, assigned_to, assigned_by, due_date)
       values ($1, $2, $3, $4, $5, $6)
       returning id, title, description, status, assigned_to, due_date, created_at`,
      [req.tenantContext.companyId, title, description || null, assignedTo, req.auth.employeeId || null, dueDate || null]
    );
    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
}

async function updateTaskStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['todo', 'in_progress', 'done'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update tasks set status = $1 where id = $2 returning id, status`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
}

module.exports = { listTasks, createTask, updateTaskStatus };
