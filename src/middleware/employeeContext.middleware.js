const { pool } = require('../config/db');

async function resolveEmployeeContext(req, res, next) {
  if (req.auth.isPlatformOwner) return next();

  try {
    const { rows } = await pool.query(
      `select id from employees where user_id = $1 and company_id = $2`,
      [req.auth.userId, req.auth.companyId]
    );
    req.auth.employeeId = rows[0]?.id || null;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resolve employee context' });
  }
}

module.exports = { resolveEmployeeContext };
