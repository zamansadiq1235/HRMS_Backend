const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { resolveEmployeeContext } = require('../middleware/employeeContext.middleware');
const {
  listLeaveTypes, listLeaveRequests, submitLeaveRequest, updateLeaveStatus,
} = require('../controllers/leave.controller');

router.use(requireAuth, enforceTenantScope, resolveEmployeeContext);

router.get('/types', listLeaveTypes); // any authenticated employee can see available leave types
router.get('/', listLeaveRequests); // self-scoped unless leave.approve held — see controller
router.post('/', requirePermission('leave.request'), submitLeaveRequest);
router.patch('/:id/status', requirePermission('leave.approve'), updateLeaveStatus);

module.exports = router;