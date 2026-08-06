const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { resolveEmployeeContext } = require('../middleware/employeeContext.middleware');
const { listMeetings, createMeeting } = require('../controllers/meetings.controller');

router.use(requireAuth, enforceTenantScope, resolveEmployeeContext);

router.get('/', requirePermission('meeting.view'), listMeetings);
router.post('/', requirePermission('meeting.manage'), createMeeting);

module.exports = router;
