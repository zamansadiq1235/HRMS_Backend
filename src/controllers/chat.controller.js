const { queryAsTenant } = require('../config/db');
const { notify } = require('../utils/notify');

async function listConversations(req, res) {
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select c.id, c.title, c.is_group,
              lm.body as last_message, lm.created_at as last_message_at,
              coalesce(unread.count, 0)::int as unread_count,
              array_agg(distinct u2.full_name) filter (where p2.employee_id != $1) as other_participant_names
       from conversations c
       join conversation_participants p on p.conversation_id = c.id and p.employee_id = $1
       left join conversation_participants p2 on p2.conversation_id = c.id
       left join employees e2 on e2.id = p2.employee_id
       left join users u2 on u2.id = e2.user_id
       left join lateral (
         select body, created_at from messages
         where conversation_id = c.id order by created_at desc limit 1
       ) lm on true
       left join lateral (
         select count(*) as count from messages m
         where m.conversation_id = c.id
           and m.created_at > coalesce(p.last_read_at, 'epoch')
           and m.sender_id != $1
       ) unread on true
       group by c.id, c.title, c.is_group, lm.body, lm.created_at, unread.count
       order by lm.created_at desc nulls last`,
      [req.auth.employeeId]
    );
    res.json({ conversations: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
}

async function createConversation(req, res) {
  const { participantIds, title } = req.body;
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ error: 'participantIds is required' });
  }

  const isGroup = participantIds.length > 1;

  try {
    if (!isGroup) {
      const existing = await queryAsTenant(
        req.tenantContext,
        `select c.id from conversations c
         where c.is_group = false
           and exists (select 1 from conversation_participants where conversation_id = c.id and employee_id = $1)
           and exists (select 1 from conversation_participants where conversation_id = c.id and employee_id = $2)
         limit 1`,
        [req.auth.employeeId, participantIds[0]]
      );
      if (existing.rows.length > 0) {
        return res.json({ conversation: { id: existing.rows[0].id }, existed: true });
      }
    }

    const convResult = await queryAsTenant(
      req.tenantContext,
      `insert into conversations (company_id, title, is_group, created_by)
       values ($1, $2, $3, $4)
       returning id, title, is_group, created_at`,
      [req.tenantContext.companyId, title || null, isGroup, req.auth.employeeId]
    );
    const conversation = convResult.rows[0];

    const allParticipants = [req.auth.employeeId, ...participantIds];
    const values = allParticipants.map((_, i) => `($1, $${i + 2})`).join(',');
    await queryAsTenant(
      req.tenantContext,
      `insert into conversation_participants (conversation_id, employee_id) values ${values}`,
      [conversation.id, ...allParticipants]
    );

    res.status(201).json({ conversation, existed: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
}

async function listMessages(req, res) {
  const { conversationId } = req.params;
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select m.id, m.body, m.created_at, m.sender_id, u.full_name as sender_name
       from messages m
       join employees e on e.id = m.sender_id
       join users u on u.id = e.user_id
       where m.conversation_id = $1
       order by m.created_at asc`,
      [conversationId]
    );

    await queryAsTenant(
      req.tenantContext,
      `update conversation_participants set last_read_at = now()
       where conversation_id = $1 and employee_id = $2`,
      [conversationId, req.auth.employeeId]
    );

    res.json({ messages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

async function sendMessage(req, res) {
  const { conversationId } = req.params;
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'body is required' });
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }

  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `insert into messages (company_id, conversation_id, sender_id, body)
       values ($1, $2, $3, $4)
       returning id, body, created_at, sender_id`,
      [req.tenantContext.companyId, conversationId, req.auth.employeeId, body.trim()]
    );

    const others = await queryAsTenant(
      req.tenantContext,
      `select u.id as user_id, u.full_name as sender_name
       from conversation_participants p
       join employees e on e.id = p.employee_id
       join users u on u.id = e.user_id
       where p.conversation_id = $1 and p.employee_id != $2`,
      [conversationId, req.auth.employeeId]
    );
    for (const row of others.rows) {
      await notify({
        companyId: req.tenantContext.companyId,
        userId: row.user_id,
        title: 'New message',
        body: body.trim().slice(0, 100),
      });
    }

    res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
}

module.exports = { listConversations, createConversation, listMessages, sendMessage };
