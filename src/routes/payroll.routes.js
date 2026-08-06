const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { resolveEmployeeContext } = require('../middleware/employeeContext.middleware');
const { listPayroll, createPayroll, updatePayrollStatus } = require('../controllers/payroll.controller');

router.use(requireAuth, enforceTenantScope, resolveEmployeeContext);

router.get('/', listPayroll);
router.post('/', requirePermission('payroll.manage'), createPayroll);
router.patch('/:id/status', requirePermission('payroll.manage'), updatePayrollStatus);

module.exports = router;
