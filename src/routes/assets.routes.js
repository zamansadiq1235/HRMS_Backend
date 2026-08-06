const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { listAssets, createAsset, assignAsset, unassignAsset } = require('../controllers/assets.controller');

router.use(requireAuth, enforceTenantScope);

router.get('/', requirePermission('asset.view'), listAssets);
router.post('/', requirePermission('asset.manage'), createAsset);
router.post('/:id/assign', requirePermission('asset.manage'), assignAsset);
router.post('/:id/unassign', requirePermission('asset.manage'), unassignAsset);

module.exports = router;
