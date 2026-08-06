const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { resolveEmployeeContext } = require('../middleware/employeeContext.middleware');
const { checkIn, checkOut, listAttendance } = require('../controllers/attendance.controller');

router.use(requireAuth, enforceTenantScope, resolveEmployeeContext);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/', requirePermission('attendance.view'), listAttendance);

module.exports = router;
