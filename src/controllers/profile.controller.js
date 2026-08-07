const { createClient } = require('@supabase/supabase-js');
const { queryAsTenant } = require('../config/db');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AVATAR_BUCKET = 'avatars';

async function getMyProfile(req, res) {
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  try {
    const result = await queryAsTenant(
      req.tenantContext,
      `select e.id, e.employee_code, e.designation, e.employment_status,
              e.phone, e.address, e.education, e.tech_skills, e.experience_years,
              e.department_id, e.branch_id, e.date_of_joining,
              u.full_name, u.email, u.avatar_url, u.status as account_status
       from employees e
       join users u on u.id = e.user_id
       where e.id = $1`,
      [req.auth.employeeId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

async function updateMyProfile(req, res) {
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  const { fullName, phone, address, education, techSkills, experienceYears } = req.body;

  try {
    if (fullName) {
      await queryAsTenant(
        req.tenantContext,
        `update users set full_name = $1
         where id = (select user_id from employees where id = $2)`,
        [fullName, req.auth.employeeId]
      );
    }

    const result = await queryAsTenant(
      req.tenantContext,
      `update employees set
         phone = coalesce($1, phone),
         address = coalesce($2, address),
         education = coalesce($3, education),
         tech_skills = coalesce($4, tech_skills),
         experience_years = coalesce($5, experience_years)
       where id = $6
       returning id, phone, address, education, tech_skills, experience_years`,
      [
        phone || null,
        address || null,
        education ? JSON.stringify(education) : null,
        techSkills || null,
        experienceYears ?? null,
        req.auth.employeeId,
      ]
    );
    res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

async function uploadMyAvatar(req, res) {
  if (!req.auth.employeeId) {
    return res.status(400).json({ error: 'No employee record linked to this account' });
  }
  const { imageBase64, fileExt } = req.body;
  if (!imageBase64 || !fileExt) {
    return res.status(400).json({ error: 'imageBase64 and fileExt are required' });
  }

  try {
    const buffer = Buffer.from(imageBase64, 'base64');
    const filePath = `${req.auth.userId}/avatar.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, buffer, {
        contentType: `image/${fileExt}`,
        upsert: true,
      });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrlData } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
    const avatarUrl = publicUrlData.publicUrl;

    await queryAsTenant(
      req.tenantContext,
      `update users set avatar_url = $1 where id = $2`,
      [avatarUrl, req.auth.userId]
    );

    res.json({ avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to upload avatar' });
  }
}

module.exports = { getMyProfile, updateMyProfile, uploadMyAvatar };
