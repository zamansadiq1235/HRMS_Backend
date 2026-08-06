const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { resolveEmployeeContext } = require('../middleware/employeeContext.middleware');
const { listTasks, createTask, updateTaskStatus } = require('../controllers/tasks.controller');
const { listTaskComments, addTaskComment } = require('../controllers/taskComments.controller');

router.use(requireAuth, enforceTenantScope, resolveEmployeeContext);

router.get('/', listTasks);
router.post('/', requirePermission('task.assign'), createTask);
router.patch('/:id/status', updateTaskStatus);
router.get('/:taskId/comments', listTaskComments);
router.post('/:taskId/comments', addTaskComment);

module.exports = router;
