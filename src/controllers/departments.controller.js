const { queryAsTenant } = require('../config/db');

async function listDepartments(req, res) {
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select id, name, parent_department_id, created_at
       from departments order by name`
    );
    res.json({ departments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
}

async function createDepartment(req, res) {
  const { name, parentDepartmentId } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into departments (company_id, name, parent_department_id)
       values ($1, $2, $3)
       returning id, name, parent_department_id, created_at`,
      [req.tenantContext.companyId, name.trim(), parentDepartmentId || null]
    );
    res.status(201).json({ department: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create department' });
  }
}

async function updateDepartment(req, res) {
  const { id } = req.params;
  const { name, parentDepartmentId } = req.body;
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update departments set name = coalesce($1, name), parent_department_id = $2
       where id = $3
       returning id, name, parent_department_id, created_at`,
      [name?.trim() || null, parentDepartmentId ?? null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Department not found' });
    res.json({ department: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update department' });
  }
}

async function deleteDepartment(req, res) {
  const { id } = req.params;
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `delete from departments where id = $1 returning id`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Department not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
}

module.exports = { listDepartments, createDepartment, updateDepartment, deleteDepartment };
