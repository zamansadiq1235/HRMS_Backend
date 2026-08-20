const { queryAsTenant } = require('../config/db');

async function getCompanySettings(req, res) {
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select name, industry, country, timezone, office_lat, office_lng, geofence_radius_meters
       from companies where id = $1`,
      [req.tenantContext.companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Company not found' });
    const row = result.rows[0];
    res.json({
      name: row.name,
      industry: row.industry,
      country: row.country,
      timezone: row.timezone,
      officeLat: row.office_lat ? Number(row.office_lat) : null,
      officeLng: row.office_lng ? Number(row.office_lng) : null,
      geofenceRadiusMeters: row.geofence_radius_meters,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch company settings' });
  }
}

async function updateCompanySettings(req, res) {
  const { officeLat, officeLng, geofenceRadiusMeters } = req.body;
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update companies set
         office_lat = coalesce($1, office_lat),
         office_lng = coalesce($2, office_lng),
         geofence_radius_meters = coalesce($3, geofence_radius_meters)
       where id = $4
       returning office_lat, office_lng, geofence_radius_meters`,
      [officeLat ?? null, officeLng ?? null, geofenceRadiusMeters ?? null, req.tenantContext.companyId]
    );
    res.json({
      officeLat: result.rows[0].office_lat ? Number(result.rows[0].office_lat) : null,
      officeLng: result.rows[0].office_lng ? Number(result.rows[0].office_lng) : null,
      geofenceRadiusMeters: result.rows[0].geofence_radius_meters,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update company settings' });
  }
}

module.exports = { getCompanySettings, updateCompanySettings };
