const { queryAsTenant } = require('../config/db');

async function listBranches(req, res) {
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select id, name, address, created_at from branches order by name`
    );
    res.json({ branches: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
}

async function createBranch(req, res) {
  const { name, address } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into branches (company_id, name, address)
       values ($1, $2, $3)
       returning id, name, address, created_at`,
      [req.tenantContext.companyId, name.trim(), address || null]
    );
    res.status(201).json({ branch: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create branch' });
  }
}

async function updateBranch(req, res) {
  const { id } = req.params;
  const { name, address } = req.body;
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update branches set name = coalesce($1, name), address = coalesce($2, address)
       where id = $3
       returning id, name, address, created_at`,
      [name?.trim() || null, address || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Branch not found' });
    res.json({ branch: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update branch' });
  }
}

async function deleteBranch(req, res) {
  const { id } = req.params;
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `delete from branches where id = $1 returning id`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Branch not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete branch' });
  }
}

module.exports = { listBranches, createBranch, updateBranch, deleteBranch };
