const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { listMyNotifications, markAsRead, markAllAsRead } = require('../controllers/notifications.controller');

router.use(requireAuth, enforceTenantScope);

router.get('/', listMyNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);

module.exports = router;
