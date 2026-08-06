const { queryAsTenant } = require('../config/db');

async function listAssets(req, res) {
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select a.id, a.name, a.asset_type, a.serial_number, a.status,
              a.assigned_to, a.assigned_at, u.full_name as assigned_to_name
       from assets a
       left join employees e on e.id = a.assigned_to
       left join users u on u.id = e.user_id
       order by a.created_at desc`
    );
    res.json({ assets: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
}

async function createAsset(req, res) {
  const { name, assetType, serialNumber, purchaseDate } = req.body;
  if (!name || !assetType) {
    return res.status(400).json({ error: 'name and assetType are required' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into assets (company_id, name, asset_type, serial_number, purchase_date)
       values ($1, $2, $3, $4, $5)
       returning id, name, asset_type, serial_number, status`,
      [req.tenantContext.companyId, name, assetType, serialNumber || null, purchaseDate || null]
    );
    res.status(201).json({ asset: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create asset' });
  }
}

async function assignAsset(req, res) {
  const { id } = req.params;
  const { employeeId } = req.body;
  if (!employeeId) return res.status(400).json({ error: 'employeeId is required' });
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update assets
       set assigned_to = $1, assigned_at = now(), status = 'assigned'
       where id = $2
       returning id, name, status, assigned_to, assigned_at`,
      [employeeId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    res.json({ asset: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign asset' });
  }
}

async function unassignAsset(req, res) {
  const { id } = req.params;
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update assets
       set assigned_to = null, assigned_at = null, status = 'available'
       where id = $1
       returning id, name, status`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    res.json({ asset: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to unassign asset' });
  }
}

module.exports = { listAssets, createAsset, assignAsset, unassignAsset };
