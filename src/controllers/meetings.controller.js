const { queryAsTenant } = require('../config/db');

async function listMeetings(req, res) {
  try {
    if (req.auth.role === 'company_admin') {
      const result = await queryAsTenant(
        req.tenantContext,
        `select m.id, m.title, m.description, m.google_meet_link, m.scheduled_at,
                m.duration_minutes, m.department_id, d.name as department_name,
                m.created_by, u.full_name as created_by_name
         from meetings m
         left join departments d on d.id = m.department_id
         join employees e on e.id = m.created_by
         join users u on u.id = e.user_id
         order by m.scheduled_at desc`
      );
      return res.json({ meetings: result.rows });
    }

    const result = await queryAsTenant(
      req.tenantContext,
      `select distinct m.id, m.title, m.description, m.google_meet_link, m.scheduled_at,
              m.duration_minutes, m.department_id, d.name as department_name,
              m.created_by, u.full_name as created_by_name
       from meetings m
       left join departments d on d.id = m.department_id
       join employees e on e.id = m.created_by
       join users u on u.id = e.user_id
       left join meeting_participants mp on mp.meeting_id = m.id
       left join employees self on self.user_id = $1
       where m.created_by = self.id
          or m.department_id = self.department_id
          or mp.employee_id = self.id
       order by m.scheduled_at desc`,
      [req.auth.userId]
    );
    res.json({ meetings: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
}

async function createMeeting(req, res) {
  const {
    title, description, googleMeetLink, scheduledAt, durationMinutes,
    departmentId, participantEmployeeIds,
  } = req.body;

  if (!title || !googleMeetLink || !scheduledAt) {
    return res.status(400).json({ error: 'title, googleMeetLink, and scheduledAt are required' });
  }
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }

  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into meetings
         (company_id, title, description, google_meet_link, scheduled_at, duration_minutes, department_id, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, title, google_meet_link, scheduled_at, department_id`,
      [
        req.tenantContext.companyId, title, description || null, googleMeetLink,
        scheduledAt, durationMinutes || 30, departmentId || null, req.auth.employeeId,
      ]
    );
    const meeting = result.rows[0];

    if (Array.isArray(participantEmployeeIds) && participantEmployeeIds.length > 0) {
      const values = participantEmployeeIds.map((_, i) => `($1, $${i + 2})`).join(',');
      await queryAsTenant(
        req.tenantContext,
        `insert into meeting_participants (meeting_id, employee_id) values ${values} on conflict do nothing`,
        [meeting.id, ...participantEmployeeIds]
      );
    }

    res.status(201).json({ meeting });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
}

module.exports = { listMeetings, createMeeting };
