const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { getDashboardOverview } = require('../controllers/dashboard.controller');

router.use(requireAuth, enforceTenantScope);

router.get('/overview', requirePermission('analytics.view'), getDashboardOverview);

module.exports = router;
