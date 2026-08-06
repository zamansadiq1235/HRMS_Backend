const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { listServices, createService, updateServiceStatus } = require('../controllers/services.controller');

router.use(requireAuth, enforceTenantScope);

router.get('/', requirePermission('service.view'), listServices);
router.post('/', requirePermission('service.manage'), createService);
router.patch('/:id/status', requirePermission('service.manage'), updateServiceStatus);

module.exports = router;
