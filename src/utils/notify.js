const { pool } = require('../config/db');

async function notify({ companyId, userId, title, body }) {
  try {
    await pool.query(
      `insert into notifications (company_id, user_id, title, body)
       values ($1, $2, $3, $4)`,
      [companyId, userId, title, body || null]
    );
  } catch (err) {
    console.error('Failed to write notification:', err);
  }
}

module.exports = { notify };
