const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { resolveEmployeeContext } = require('../middleware/employeeContext.middleware');
const { listTasks, createTask, updateTaskStatus } = require('../controllers/tasks.controller');

router.use(requireAuth, enforceTenantScope, resolveEmployeeContext);

// employee.view lets you see tasks; task.view_own is implicitly satisfied by
// filtering ?employeeId=<self> from the client for self-service views.
router.get('/', requirePermission('employee.view'), listTasks);
router.post('/', requirePermission('task.assign'), createTask);
router.patch('/:id/status', requirePermission('employee.view'), updateTaskStatus); // any assignee can update their own task's status

module.exports = router;