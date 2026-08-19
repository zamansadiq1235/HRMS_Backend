const { createClient } = require('@supabase/supabase-js');
const { queryAsTenant } = require('../config/db');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const SELFIE_BUCKET = 'selfies';

async function getSummary(req, res) {
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  try {
    const todayResult = await queryAsTenant(
      req.tenantContext,
      `select id, check_in, check_out, break_start, break_end
       from attendance
       where employee_id = $1 and check_in::date = current_date
       order by check_in desc
       limit 1`,
      [req.auth.employeeId]
    );

    let today = null;
    let status = 'not_clocked_in';
    let todayHours = 0;
    if (todayResult.rows.length > 0) {
      const row = todayResult.rows[0];
      const checkIn = new Date(row.check_in);
      const checkOut = row.check_out ? new Date(row.check_out) : null;
      const breakStart = row.break_start ? new Date(row.break_start) : null;
      const breakEnd = row.break_end ? new Date(row.break_end) : null;
      const now = new Date();

      const endPoint = checkOut || now;
      let elapsedMs = endPoint - checkIn;
      if (breakStart) {
        const breakEndPoint = breakEnd || (checkOut ? checkOut : now);
        elapsedMs -= (breakEndPoint - breakStart);
      }
      todayHours = Math.max(0, Math.round((elapsedMs / 3600000) * 100) / 100);

      if (checkOut) status = 'clocked_out';
      else if (breakStart && !breakEnd) status = 'on_break';
      else status = 'clocked_in';

      today = { id: row.id, checkIn: row.check_in, checkOut: row.check_out, breakStart: row.break_start, breakEnd: row.break_end };
    }

    const payPeriodResult = await queryAsTenant(
      req.tenantContext,
      `select coalesce(sum(
         round(extract(epoch from (
           coalesce(check_out, now()) - check_in
         )) / 3600.0, 2)
         - coalesce(round(extract(epoch from (coalesce(break_end, now()) - break_start)) / 3600.0, 2), 0)
       ), 0) as total
       from attendance
       where employee_id = $1
         and check_in >= date_trunc('month', current_date)`,
      [req.auth.employeeId]
    );

    const historyResult = await queryAsTenant(
      req.tenantContext,
      `select id, check_in, check_out,
              round(extract(epoch from (coalesce(check_out, now()) - check_in)) / 3600.0, 2)
                - coalesce(round(extract(epoch from (coalesce(break_end, now()) - break_start)) / 3600.0, 2), 0) as hours_worked
       from attendance
       where employee_id = $1 and check_out is not null
       order by check_in desc
       limit 14`,
      [req.auth.employeeId]
    );

    res.json({
      status,
      today,
      todayHours,
      thisPayPeriodHours: Number(payPeriodResult.rows[0].total) || 0,
      history: historyResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
}

async function getOfficeLocation(req, res) {
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select office_lat, office_lng, geofence_radius_meters from companies where id = $1`,
      [req.tenantContext.companyId]
    );
    const row = result.rows[0] || {};
    res.json({
      lat: row.office_lat ? Number(row.office_lat) : null,
      lng: row.office_lng ? Number(row.office_lng) : null,
      radiusMeters: row.geofence_radius_meters || 200,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch office location' });
  }
}

async function checkIn(req, res) {
  const { lat, lng, notes, selfieBase64, selfieExt } = req.body;
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  try {
    const existing = await queryAsTenant(
      req.tenantContext,
      `select id from attendance where employee_id = $1 and check_in::date = current_date and check_out is null`,
      [req.auth.employeeId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already checked in today' });
    }

    let selfieUrl = null;
    if (selfieBase64 && selfieExt) {
      try {
        const buffer = Buffer.from(selfieBase64, 'base64');
        const filePath = `${req.auth.employeeId}/${Date.now()}.${selfieExt}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from(SELFIE_BUCKET)
          .upload(filePath, buffer, { contentType: `image/${selfieExt}` });
        if (!uploadError) {
          selfieUrl = supabaseAdmin.storage.from(SELFIE_BUCKET).getPublicUrl(filePath).data.publicUrl;
        }
      } catch (uploadErr) {
        console.error('Selfie upload failed:', uploadErr);
      }
    }

    const result = await queryAsTenant(
      req.tenantContext,
      `insert into attendance (company_id, employee_id, check_in, check_in_lat, check_in_lng, status, notes, selfie_url)
       values ($1, $2, now(), $3, $4, 'present', $5, $6)
       returning id, check_in, status`,
      [req.tenantContext.companyId, req.auth.employeeId, lat || null, lng || null, notes || null, selfieUrl]
    );
    res.status(201).json({ attendance: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check in' });
  }
}

async function startBreak(req, res) {
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update attendance set break_start = now()
       where employee_id = $1 and check_in::date = current_date and check_out is null and break_start is null
       returning id, break_start`,
      [req.auth.employeeId]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active clock-in found to start a break on' });
    }
    res.json({ attendance: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start break' });
  }
}

async function endBreak(req, res) {
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update attendance set break_end = now()
       where employee_id = $1 and check_in::date = current_date and break_start is not null and break_end is null
       returning id, break_end`,
      [req.auth.employeeId]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active break found to end' });
    }
    res.json({ attendance: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to end break' });
  }
}

async function checkOut(req, res) {
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `update attendance
       set check_out = now()
       where employee_id = $1 and check_in::date = current_date and check_out is null
       returning id, check_in, check_out, break_start, break_end`,
      [req.auth.employeeId]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active check-in found for today' });
    }
    const row = result.rows[0];
    const checkIn = new Date(row.check_in);
    const checkOut = new Date(row.check_out);
    let elapsedMs = checkOut - checkIn;
    if (row.break_start) {
      const breakEnd = row.break_end ? new Date(row.break_end) : checkOut;
      elapsedMs -= (breakEnd - new Date(row.break_start));
    }
    const hoursWorked = Math.max(0, Math.round((elapsedMs / 3600000) * 100) / 100);
    res.json({ attendance: { ...row, hoursWorked } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check out' });
  }
}

async function listAttendance(req, res) {
  const { employeeId, from, to } = req.query;
  const conditions = [];
  const params = [];
  if (employeeId) { params.push(employeeId); conditions.push(`a.employee_id = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`a.check_in::date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`a.check_in::date <= $${params.length}`); }
  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';

  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select a.id, a.employee_id, u.full_name, a.check_in, a.check_out, a.status,
              round(extract(epoch from (coalesce(a.check_out, now()) - a.check_in)) / 3600.0, 2) as hours_worked
       from attendance a
       join employees e on e.id = a.employee_id
       join users u on u.id = e.user_id
       ${whereClause}
       order by a.check_in desc`,
      params
    );
    res.json({ attendance: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
}

module.exports = { getSummary, getOfficeLocation, checkIn, startBreak, endBreak, checkOut, listAttendance };
