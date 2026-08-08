const { queryAsTenant } = require('../config/db');

async function listMyNotifications(req, res) {
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select id, title, body, is_read, created_at
       from notifications where user_id = $1 order by created_at desc limit 100`,
      [req.auth.userId]
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

async function markAsRead(req, res) {
  const { id } = req.params;
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update notifications set is_read = true where id = $1 and user_id = $2 returning id`,
      [id, req.auth.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
}

async function markAllAsRead(req, res) {
  try {
    await queryAsTenant(
      req.tenantContext,
      `update notifications set is_read = true where user_id = $1 and is_read = false`,
      [req.auth.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
}

module.exports = { listMyNotifications, markAsRead, markAllAsRead };
