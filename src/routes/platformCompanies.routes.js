const express = require('express');
const router = express.Router();
const { requireAuth, requirePlatformOwner } = require('../middleware/auth.middleware');
const {
  listCompanies, getCompany, createCompany, updateCompanyStatus,
} = require('../controllers/platformCompanies.controller');

router.use(requireAuth, requirePlatformOwner);

router.get('/', listCompanies);
router.get('/:id', getCompany);
router.post('/', createCompany);
router.patch('/:id/status', updateCompanyStatus);

module.exports = router;
