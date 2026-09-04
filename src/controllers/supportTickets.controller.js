const { queryAsTenant } = require('../config/db');
const { pool } = require('../config/db');

/**
 * A company_admin raises a ticket — tenant-scoped, uses the normal
 * queryAsTenant pattern like everything else in the company's own app.
 */
async function createTicket(req, res) {
  const { subject, description } = req.body;
  if (!subject || !subject.trim()) {
    return res.status(400).json({ error: 'subject is required' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into support_tickets (company_id, raised_by, subject, description, status)
       values ($1, $2, $3, $4, 'open')
       returning id, subject, description, status, created_at`,
      [req.tenantContext.companyId, req.auth.userId, subject.trim(), description || null]
    );
    res.status(201).json({ ticket: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
}

/**
 * A company_admin views only their own company's tickets.
 */
async function listMyCompanyTickets(req, res) {
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select st.id, st.subject, st.description, st.status, st.created_at, u.full_name as raised_by_name
       from support_tickets st
       join users u on u.id = st.raised_by
       where st.company_id = $1
       order by st.created_at desc`,
      [req.tenantContext.companyId]
    );
    res.json({ tickets: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
}

/**
 * Platform owner sees EVERY company's tickets — not tenant-scoped,
 * uses pool.query directly like the other platform-level controllers.
 */
async function listAllTickets(req, res) {
  const { status } = req.query;
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`st.status = $${params.length}`); }
  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';

  try {
    const result = await pool.query(
      `select st.id, st.subject, st.description, st.status, st.created_at,
              c.name as company_name, u.full_name as raised_by_name
       from support_tickets st
       join companies c on c.id = st.company_id
       join users u on u.id = st.raised_by
       ${whereClause}
       order by st.created_at desc`,
      params
    );
    res.json({ tickets: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
}

async function updateTicketStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const result = await pool.query(
      `update support_tickets set status = $1 where id = $2 returning id, status`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ ticket: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
}

module.exports = { createTicket, listMyCompanyTickets, listAllTickets, updateTicketStatus };
