const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission, requirePlatformOwner } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const {
  createTicket, listMyCompanyTickets, listAllTickets, updateTicketStatus,
} = require('../controllers/supportTickets.controller');

// Company-side: raise + view own tickets (any company_admin/hr_manager can raise one)
router.post('/', requireAuth, enforceTenantScope, createTicket);
router.get('/mine', requireAuth, enforceTenantScope, listMyCompanyTickets);

// Platform owner: view all, update status
router.get('/', requireAuth, requirePlatformOwner, listAllTickets);
router.patch('/:id/status', requireAuth, requirePlatformOwner, updateTicketStatus);

module.exports = router;
