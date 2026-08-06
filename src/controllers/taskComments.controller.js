const { queryAsTenant } = require('../config/db');

async function listTaskComments(req, res) {
  const { taskId } = req.params;
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select tc.id, tc.comment, tc.created_at, u.full_name as employee_name
       from task_comments tc
       join employees e on e.id = tc.employee_id
       join users u on u.id = e.user_id
       where tc.task_id = $1
       order by tc.created_at asc`,
      [taskId]
    );
    res.json({ comments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
}

async function addTaskComment(req, res) {
  const { taskId } = req.params;
  const { comment } = req.body;
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'comment is required' });
  }
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into task_comments (company_id, task_id, employee_id, comment)
       values ($1, $2, $3, $4)
       returning id, comment, created_at`,
      [req.tenantContext.companyId, taskId, req.auth.employeeId, comment.trim()]
    );
    res.status(201).json({ comment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
}

module.exports = { listTaskComments, addTaskComment };
