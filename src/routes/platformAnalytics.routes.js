const express = require('express');
const router = express.Router();
const { requireAuth, requirePlatformOwner } = require('../middleware/auth.middleware');
const { getPlatformAnalytics } = require('../controllers/platformAnalytics.controller');

router.use(requireAuth, requirePlatformOwner);

router.get('/', getPlatformAnalytics);

module.exports = router;
