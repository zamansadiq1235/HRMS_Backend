const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { resolveEmployeeContext } = require('../middleware/employeeContext.middleware');
const { listConversations, createConversation, listMessages, sendMessage } = require('../controllers/chat.controller');

router.use(requireAuth, enforceTenantScope, resolveEmployeeContext);

router.get('/conversations', listConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:conversationId/messages', listMessages);
router.post('/conversations/:conversationId/messages', sendMessage);

module.exports = router;
