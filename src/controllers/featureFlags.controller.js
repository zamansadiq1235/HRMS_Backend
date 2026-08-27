const { pool } = require('../config/db');

async function listFeatureFlags(req, res) {
  try {
    const result = await pool.query(
      `select id, key, description, is_enabled_globally, created_at from feature_flags order by key`
    );
    res.json({ featureFlags: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
}

async function createFeatureFlag(req, res) {
  const { key, description } = req.body;
  if (!key || !key.trim()) return res.status(400).json({ error: 'key is required' });
  try {
    const result = await pool.query(
      `insert into feature_flags (key, description, is_enabled_globally)
       values ($1, $2, false)
       returning id, key, description, is_enabled_globally`,
      [key.trim(), description || null]
    );
    res.status(201).json({ featureFlag: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (/duplicate key/i.test(err.message || '')) {
      return res.status(409).json({ error: 'A feature flag with this key already exists' });
    }
    res.status(500).json({ error: 'Failed to create feature flag' });
  }
}

async function toggleFeatureFlag(req, res) {
  const { id } = req.params;
  const { isEnabled } = req.body;
  if (typeof isEnabled !== 'boolean') {
    return res.status(400).json({ error: 'isEnabled must be a boolean' });
  }
  try {
    const result = await pool.query(
      `update feature_flags set is_enabled_globally = $1 where id = $2 returning id, key, is_enabled_globally`,
      [isEnabled, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Feature flag not found' });
    res.json({ featureFlag: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
}

async function deleteFeatureFlag(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(`delete from feature_flags where id = $1 returning id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Feature flag not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete feature flag' });
  }
}

module.exports = { listFeatureFlags, createFeatureFlag, toggleFeatureFlag, deleteFeatureFlag };
