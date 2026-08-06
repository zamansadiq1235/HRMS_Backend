const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { queryAsTenant, pool } = require('../config/db');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateTempPassword() {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x').slice(0, 12);
}

async function nextEmployeeCode(companyId) {
  const { rows } = await pool.query(
    `select count(*)::int as count from employees where company_id = $1`,
    [companyId]
  );
  const seq = rows[0].count + 1;
  return `EMP-${String(seq).padStart(4, '0')}`;
}

async function listEmployees(req, res) {
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select e.id, e.employee_code, e.designation, e.employment_status,
              e.phone, e.address, e.education, e.tech_skills, e.experience_years,
              e.department_id, e.branch_id, e.date_of_joining,
              u.full_name, u.email, u.status as account_status
       from employees e
       join users u on u.id = e.user_id
       order by u.full_name`
    );
    res.json({ employees: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
}

async function createEmployee(req, res) {
  const {
    email, fullName, phone, address, education, techSkills, experienceYears,
    designation, departmentId, branchId, dateOfJoining, roleName,
  } = req.body;

  if (!email || !fullName) {
    return res.status(400).json({ error: 'email and fullName are required' });
  }

  const allowedRoles = ['employee', 'hr_manager'];
  const targetRole = allowedRoles.includes(roleName) ? roleName : 'employee';
  if (targetRole === 'hr_manager' && req.auth.role !== 'company_admin') {
    return res.status(403).json({ error: 'Only a company admin can create an HR manager' });
  }

  const tempPassword = generateTempPassword();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("select set_config('app.is_platform_owner', 'false', true)");
    await client.query("select set_config('app.current_company_id', $1, true)", [
      req.tenantContext.companyId,
    ]);

    const { rows: roleRows } = await client.query('select id from roles where name = $1', [targetRole]);
    if (roleRows.length === 0) throw new Error(`Role '${targetRole}' not found`);
    const roleId = roleRows[0].id;

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      throw new Error(createError?.message || 'Failed to create login account');
    }

    await client.query(
      `insert into users (id, company_id, role_id, email, full_name, status)
       values ($1, $2, $3, $4, $5, 'active')`,
      [created.user.id, req.tenantContext.companyId, roleId, email, fullName]
    );

    const employeeCode = await nextEmployeeCode(req.tenantContext.companyId);

    const { rows: employeeRows } = await client.query(
      `insert into employees
         (company_id, user_id, employee_code, designation, department_id, branch_id,
          date_of_joining, phone, address, education, tech_skills, experience_years)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning id, employee_code, designation, department_id, branch_id,
                 date_of_joining, phone, address, education, tech_skills, experience_years`,
      [
        req.tenantContext.companyId, created.user.id, employeeCode, designation || null,
        departmentId || null, branchId || null, dateOfJoining || null, phone || null,
        address || null, JSON.stringify(education || []), techSkills || [], experienceYears || null,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({
      employee: { ...employeeRows[0], email, fullName, role: targetRole },
      loginCredentials: {
        employeeId: employeeRows[0].employee_code,
        email,
        temporaryPassword: tempPassword,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    const isDuplicateEmail = /already been registered|already exists/i.test(err.message || '');
    if (isDuplicateEmail) {
      return res.status(409).json({ error: 'An employee with this email already exists' });
    }
    res.status(500).json({ error: err.message || 'Failed to create employee' });
  } finally {
    client.release();
  }
}

async function updateEmployee(req, res) {
  const { id } = req.params;
  const {
    email, fullName, phone, address, education, techSkills, experienceYears,
    designation, departmentId, branchId, dateOfJoining, roleName, accountStatus, employmentStatus,
  } = req.body;

  if (email !== undefined && (!email || !email.trim())) {
    return res.status(400).json({ error: 'email cannot be empty' });
  }
  if (fullName !== undefined && (!fullName || !fullName.trim())) {
    return res.status(400).json({ error: 'fullName cannot be empty' });
  }
  if (education !== undefined && !Array.isArray(education)) {
    return res.status(400).json({ error: 'education must be an array' });
  }
  if (techSkills !== undefined && !Array.isArray(techSkills)) {
    return res.status(400).json({ error: 'techSkills must be an array' });
  }

  const allowedRoles = ['employee', 'hr_manager'];
  if (roleName !== undefined && !allowedRoles.includes(roleName)) {
    return res.status(400).json({ error: 'roleName must be employee or hr_manager' });
  }
  if (roleName === 'hr_manager' && req.auth.role !== 'company_admin') {
    return res.status(403).json({ error: 'Only a company admin can assign an HR manager role' });
  }
  if (accountStatus !== undefined && !['active', 'inactive'].includes(accountStatus)) {
    return res.status(400).json({ error: 'accountStatus must be active or inactive' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("select set_config('app.is_platform_owner', $1, true)", [
      req.tenantContext.isPlatformOwner ? 'true' : 'false',
    ]);
    await client.query("select set_config('app.current_company_id', $1, true)", [
      req.tenantContext.companyId || '',
    ]);

    const { rows: existingRows } = await client.query(
      `select e.id, e.user_id
       from employees e
       where e.id = $1`,
      [id]
    );
    if (existingRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Employee not found' });
    }
    const userId = existingRows[0].user_id;

    if (email !== undefined) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: email.trim().toLowerCase(),
      });
      if (error) throw new Error(error.message || 'Failed to update login email');
    }

    const userAssignments = [];
    const userValues = [];
    const addUserValue = (column, value) => {
      userValues.push(value);
      userAssignments.push(`${column} = $${userValues.length}`);
    };
    if (email !== undefined) addUserValue('email', email.trim().toLowerCase());
    if (fullName !== undefined) addUserValue('full_name', fullName.trim());
    if (accountStatus !== undefined) addUserValue('status', accountStatus);
    if (roleName !== undefined) {
      const { rows: roleRows } = await client.query('select id from roles where name = $1', [roleName]);
      if (roleRows.length === 0) throw new Error(`Role '${roleName}' not found`);
      addUserValue('role_id', roleRows[0].id);
    }
    if (userAssignments.length) {
      userValues.push(userId);
      await client.query(
        `update users set ${userAssignments.join(', ')} where id = $${userValues.length}`,
        userValues
      );
    }

    const employeeAssignments = [];
    const employeeValues = [];
    const addEmployeeValue = (column, value) => {
      employeeValues.push(value);
      employeeAssignments.push(`${column} = $${employeeValues.length}`);
    };
    if (phone !== undefined) addEmployeeValue('phone', phone || null);
    if (address !== undefined) addEmployeeValue('address', address || null);
    if (education !== undefined) addEmployeeValue('education', JSON.stringify(education));
    if (techSkills !== undefined) addEmployeeValue('tech_skills', techSkills);
    if (experienceYears !== undefined) addEmployeeValue('experience_years', experienceYears || null);
    if (designation !== undefined) addEmployeeValue('designation', designation || null);
    if (employmentStatus !== undefined) addEmployeeValue('employment_status', employmentStatus || null);
    if (departmentId !== undefined) addEmployeeValue('department_id', departmentId || null);
    if (branchId !== undefined) addEmployeeValue('branch_id', branchId || null);
    if (dateOfJoining !== undefined) addEmployeeValue('date_of_joining', dateOfJoining || null);
    if (employeeAssignments.length) {
      employeeValues.push(id);
      await client.query(
        `update employees set ${employeeAssignments.join(', ')} where id = $${employeeValues.length}`,
        employeeValues
      );
    }

    const { rows } = await client.query(
      `select e.id, e.employee_code, e.designation, e.employment_status,
              e.phone, e.address, e.education, e.tech_skills, e.experience_years,
              e.department_id, e.branch_id, e.date_of_joining,
              u.full_name, u.email, u.status as account_status, r.name as role
       from employees e
       join users u on u.id = e.user_id
       join roles r on r.id = u.role_id
       where e.id = $1`,
      [id]
    );
    await client.query('COMMIT');
    return res.json({ employee: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    const isDuplicateEmail = /already been registered|already exists|duplicate key/i.test(err.message || '');
    return res.status(isDuplicateEmail ? 409 : 500).json({
      error: isDuplicateEmail ? 'An employee with this email already exists' : err.message || 'Failed to update employee',
    });
  } finally {
    client.release();
  }
}

async function deleteEmployee(req, res) {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("select set_config('app.is_platform_owner', $1, true)", [
      req.tenantContext.isPlatformOwner ? 'true' : 'false',
    ]);
    await client.query("select set_config('app.current_company_id', $1, true)", [
      req.tenantContext.companyId || '',
    ]);
    const { rows } = await client.query(
      'delete from employees where id = $1 returning user_id',
      [id]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (rows[0].user_id === req.auth.userId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot delete your own employee record' });
    }
    await client.query('delete from users where id = $1', [rows[0].user_id]);
    await client.query('COMMIT');

    const { error } = await supabaseAdmin.auth.admin.deleteUser(rows[0].user_id);
    if (error) console.error('Employee database record deleted, but login removal failed:', error);
    return res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(/foreign key/i.test(err.message || '') ? 409 : 500).json({
      error: /foreign key/i.test(err.message || '')
        ? 'This employee cannot be deleted because related records exist'
        : 'Failed to delete employee',
    });
  } finally {
    client.release();
  }
}

module.exports = { listEmployees, createEmployee, updateEmployee, deleteEmployee };
