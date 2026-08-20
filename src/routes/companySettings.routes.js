const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { getCompanySettings, updateCompanySettings } = require('../controllers/companySettings.controller');

router.use(requireAuth, enforceTenantScope);

router.get('/', requirePermission('company.manage_settings'), getCompanySettings);
router.patch('/', requirePermission('company.manage_settings'), updateCompanySettings);

module.exports = router;
