const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
});

async function queryAsTenant({ companyId, isPlatformOwner }, text, params) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("select set_config('app.is_platform_owner', $1, true)", [
      isPlatformOwner ? 'true' : 'false',
    ]);
    await client.query("select set_config('app.current_company_id', $1, true)", [
      companyId || '',
    ]);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, queryAsTenant };
