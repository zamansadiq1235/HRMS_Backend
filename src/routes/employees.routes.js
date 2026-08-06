const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
} = require('../controllers/employees.controller');

router.use(requireAuth, enforceTenantScope);

router.get('/', requirePermission('employee.view'), listEmployees);
router.post('/', requirePermission('employee.invite'), createEmployee);
router.patch('/:id', requirePermission('employee.invite'), updateEmployee);
router.delete('/:id', requirePermission('employee.invite'), deleteEmployee);

module.exports = router;
