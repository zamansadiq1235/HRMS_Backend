const express = require('express');
const router = express.Router();
const { requireAuth, requirePlatformOwner } = require('../middleware/auth.middleware');
const {
  listFeatureFlags, createFeatureFlag, toggleFeatureFlag, deleteFeatureFlag,
} = require('../controllers/featureFlags.controller');

router.use(requireAuth, requirePlatformOwner);

router.get('/', listFeatureFlags);
router.post('/', createFeatureFlag);
router.patch('/:id/toggle', toggleFeatureFlag);
router.delete('/:id', deleteFeatureFlag);

module.exports = router;
