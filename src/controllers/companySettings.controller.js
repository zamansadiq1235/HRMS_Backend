const { queryAsTenant } = require('../config/db');

async function getCompanySettings(req, res) {
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select name, industry, country, timezone, office_lat, office_lng, geofence_radius_meters,
              default_clock_in, default_clock_out
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
      defaultClockIn: row.default_clock_in,
      defaultClockOut: row.default_clock_out,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch company settings' });
  }
}

async function updateCompanySettings(req, res) {
  const { officeLat, officeLng, geofenceRadiusMeters, defaultClockIn, defaultClockOut } = req.body;
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update companies set
         office_lat = coalesce($1, office_lat),
         office_lng = coalesce($2, office_lng),
         geofence_radius_meters = coalesce($3, geofence_radius_meters),
         default_clock_in = coalesce($4, default_clock_in),
         default_clock_out = coalesce($5, default_clock_out)
       where id = $6
       returning office_lat, office_lng, geofence_radius_meters, default_clock_in, default_clock_out`,
      [officeLat ?? null, officeLng ?? null, geofenceRadiusMeters ?? null, defaultClockIn ?? null, defaultClockOut ?? null, req.tenantContext.companyId]
    );
    const row = result.rows[0];
    res.json({
      officeLat: row.office_lat ? Number(row.office_lat) : null,
      officeLng: row.office_lng ? Number(row.office_lng) : null,
      geofenceRadiusMeters: row.geofence_radius_meters,
      defaultClockIn: row.default_clock_in,
      defaultClockOut: row.default_clock_out,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update company settings' });
  }
}

module.exports = { getCompanySettings, updateCompanySettings };
