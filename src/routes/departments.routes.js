const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const {
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
} = require('../controllers/departments.controller');

router.use(requireAuth, enforceTenantScope);

router.get('/', requirePermission('employee.view'), listDepartments);
router.post('/', requirePermission('department.manage'), createDepartment);
router.patch('/:id', requirePermission('department.manage'), updateDepartment);
router.delete('/:id', requirePermission('department.manage'), deleteDepartment);

module.exports = router;
