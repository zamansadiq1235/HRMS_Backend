const { queryAsTenant } = require('../config/db');

async function listServices(req, res) {
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select id, name, description, status, created_at from company_services order by name`
    );
    res.json({ services: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
}

async function createService(req, res) {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into company_services (company_id, name, description)
       values ($1, $2, $3)
       returning id, name, description, status`,
      [req.tenantContext.companyId, name, description || null]
    );
    res.status(201).json({ service: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create service' });
  }
}

async function updateServiceStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: "status must be 'active' or 'inactive'" });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update company_services set status = $1 where id = $2 returning id, status`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json({ service: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update service' });
  }
}

module.exports = { listServices, createService, updateServiceStatus };
