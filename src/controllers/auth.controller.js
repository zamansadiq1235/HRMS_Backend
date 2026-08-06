const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws'); // 1. Import WebSocket library
const { pool } = require('../config/db');

// 2. Pass WebSocket inside the realtime transport config
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
    realtime: {
      transport: {
        websocket: WebSocket,
      },
    },
  }
);

async function getPermissionsForRole(roleName) {
  if (roleName === 'platform_owner') return ['*'];

  const { rows } = await pool.query(
    `select p.key
     from role_permissions rp
     join permissions p on p.id = rp.permission_id
     join roles r on r.id = rp.role_id
     where r.name = $1`,
    [roleName]
  );
  return rows.map((r) => r.key);
}

function issueTokens(user, permissions) {
  const payload = {
    sub: user.id,
    company_id: user.company_id,
    role: user.role_name,
    permissions,
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
  return { accessToken, refreshToken };
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError || !authData.user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const { rows } = await pool.query(
    `select u.id, u.company_id, u.status, r.name as role_name
     from users u
     join roles r on r.id = u.role_id
     where u.id = $1`,
    [authData.user.id]
  );

  const appUser = rows[0];
  if (!appUser || appUser.status !== 'active') {
    return res.status(403).json({ error: 'Account is not active' });
  }

  const permissions = await getPermissionsForRole(appUser.role_name);
  const { accessToken, refreshToken } = issueTokens(appUser, permissions);

  return res.json({
    accessToken,
    refreshToken,
    user: {
      id: appUser.id,
      companyId: appUser.company_id,
      role: appUser.role_name,
      permissions,
    },
  });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const permissions = await getPermissionsForRole(payload.role);
    const { accessToken, refreshToken: newRefresh } = issueTokens(
      { id: payload.sub, company_id: payload.company_id, role_name: payload.role },
      permissions
    );
    return res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

module.exports = { login, refresh };