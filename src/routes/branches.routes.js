const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const {
  listBranches, createBranch, updateBranch, deleteBranch,
} = require('../controllers/branches.controller');

router.use(requireAuth, enforceTenantScope);

router.get('/', requirePermission('employee.view'), listBranches);
router.post('/', requirePermission('branch.manage'), createBranch);
router.patch('/:id', requirePermission('branch.manage'), updateBranch);
router.delete('/:id', requirePermission('branch.manage'), deleteBranch);

module.exports = router;
