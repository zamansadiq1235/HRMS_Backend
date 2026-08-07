const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { resolveEmployeeContext } = require('../middleware/employeeContext.middleware');
const { getMyProfile, updateMyProfile, uploadMyAvatar } = require('../controllers/profile.controller');

router.use(requireAuth, enforceTenantScope, resolveEmployeeContext);

router.get('/', getMyProfile);
router.patch('/', updateMyProfile);
router.post('/avatar', uploadMyAvatar);

module.exports = router;
