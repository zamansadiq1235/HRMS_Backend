const express = require('express');
const router = express.Router();
const { requireAuth, requirePlatformOwner } = require('../middleware/auth.middleware');
const { listPlans, createPlan, assignCompanyPlan, updateSubscriptionStatus } = require('../controllers/plans.controller');

router.use(requireAuth, requirePlatformOwner);

router.get('/', listPlans);
router.post('/', createPlan);
router.post('/companies/:id/subscription', assignCompanyPlan);
router.patch('/companies/:id/subscription/status', updateSubscriptionStatus);

module.exports = router;
