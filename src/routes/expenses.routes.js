const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth.middleware');
const { enforceTenantScope } = require('../middleware/tenant.middleware');
const { resolveEmployeeContext } = require('../middleware/employeeContext.middleware');
const {
  listExpenseCategories, listExpenses, submitExpense, updateExpenseStatus,
} = require('../controllers/expenses.controller');

router.use(requireAuth, enforceTenantScope, resolveEmployeeContext);

router.get('/categories', listExpenseCategories);
router.get('/', listExpenses);
router.post('/', requirePermission('expense.submit'), submitExpense);
router.patch('/:id/status', requirePermission('expense.approve'), updateExpenseStatus);

module.exports = router;
