const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission, requirePlatformOwner } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { listCompanyAuditLogs, listAllAuditLogs } = require('../controllers/auditLogs.controller');

router.get('/mine', requireAuth, enforceTenantScope, requirePermission('reports.advanced'), listCompanyAuditLogs);
router.get('/', requireAuth, requirePlatformOwner, listAllAuditLogs);

module.exports = router;
