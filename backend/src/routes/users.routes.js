const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer', 'admin'));

function parseSkills(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((skill) => typeof skill === 'string') : [];
  } catch (_) {
    return value.split(',').map((skill) => skill.trim()).filter(Boolean);
  }
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id), email: row.email, fullName: row.fullName,
    role: row.role, phone: row.phone || '',
    searchStatus: row.searchStatus === undefined ? undefined : Boolean(row.searchStatus),
    twoFactorEnabled: row.twoFactorEnabled === undefined ? undefined : Boolean(row.twoFactorEnabled),
    title: row.title || '', location: row.location || '', experience: row.experience || '',
    skills: parseSkills(row.skills),
  };
}

router.get('/candidates', requireRole('employer', 'admin'), asyncHandler(async (_req, res) => {
  const result = await getPool().request().query(`
    SELECT u.id, u.full_name AS fullName, u.role,
      u.search_status AS searchStatus, p.title, p.location, p.experience, p.skills
    FROM dbo.users AS u
    LEFT JOIN dbo.candidate_profiles AS p ON p.user_id = u.id
    WHERE u.role = N'candidate' AND u.status = N'active' AND u.search_status = 1
    ORDER BY u.full_name, u.id`);
  return res.json(result.recordset.map(mapUser));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Mã người dùng không hợp lệ' });
  const result = await getPool().request()
    .input('id', sql.BigInt, req.params.id)
    .input('requesterId', sql.BigInt, req.user.id).query(`
    SELECT u.id,
      CASE WHEN u.id = @requesterId OR EXISTS (
        SELECT 1 FROM dbo.applications AS a
        INNER JOIN dbo.jobs AS j ON j.id = a.job_id
        WHERE a.candidate_id = u.id AND j.recruiter_id = @requesterId
      ) THEN u.email ELSE NULL END AS email,
      u.full_name AS fullName, u.role,
      CASE WHEN u.id = @requesterId OR EXISTS (
        SELECT 1 FROM dbo.applications AS a
        INNER JOIN dbo.jobs AS j ON j.id = a.job_id
        WHERE a.candidate_id = u.id AND j.recruiter_id = @requesterId
      ) THEN u.phone ELSE NULL END AS phone,
      u.search_status AS searchStatus, u.two_factor_enabled AS twoFactorEnabled,
      p.title, p.location, p.experience, p.skills
    FROM dbo.users AS u
    LEFT JOIN dbo.candidate_profiles AS p ON p.user_id = u.id
    WHERE u.id = @id AND u.status = N'active'`);
  if (!result.recordset.length) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  return res.json(mapUser(result.recordset[0]));
}));

module.exports = router;
