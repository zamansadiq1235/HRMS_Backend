require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const employeesRoutes = require('./routes/employees.routes');
const departmentsRoutes = require('./routes/departments.routes');
const branchesRoutes = require('./routes/branches.routes');
const tasksRoutes = require('./routes/tasks.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const assetsRoutes = require('./routes/assets.routes');
const servicesRoutes = require('./routes/services.routes');
const expensesRoutes = require('./routes/expenses.routes');
const meetingsRoutes = require('./routes/meetings.routes');
const leaveRoutes = require('./routes/leave.routes');
const payrollRoutes = require('./routes/payroll.routes');
const profileRoutes = require('./routes/profile.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const chatRoutes = require('./routes/chat.routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/branches', branchesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/employees/me', profileRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => console.log(`HR SaaS API running on port ${PORT}`));
