const express = require('express');
const router = express.Router();
const { requireAuth, requirePlatformOwner } = require('../middleware/auth.middleware');
const { getPlatformOverview } = require('../controllers/platformDashboard.controller');

router.use(requireAuth, requirePlatformOwner);

router.get('/overview', getPlatformOverview);

module.exports = router;
