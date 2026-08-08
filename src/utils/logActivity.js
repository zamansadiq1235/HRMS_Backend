const { pool } = require('../config/db');

async function logActivity({ companyId, userId, action, entity, entityId, metadata }) {
  try {
    await pool.query(
      `insert into activity_logs (company_id, user_id, action, entity, entity_id, metadata)
       values ($1, $2, $3, $4, $5, $6)`,
      [companyId, userId || null, action, entity || null, entityId || null, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}

module.exports = { logActivity };
