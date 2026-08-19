const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { resolveEmployeeContext } = require('../middleware/employeeContext.middleware');
const {
  getSummary, getOfficeLocation, checkIn, startBreak, endBreak, checkOut, listAttendance,
} = require('../controllers/attendance.controller');

router.use(requireAuth, enforceTenantScope, resolveEmployeeContext);

router.get('/summary', getSummary);
router.get('/office-location', getOfficeLocation);
router.post('/check-in', checkIn);
router.post('/break/start', startBreak);
router.post('/break/end', endBreak);
router.post('/check-out', checkOut);
router.get('/', requirePermission('attendance.view'), listAttendance);

module.exports = router;
