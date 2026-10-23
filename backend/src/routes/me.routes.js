const express = require('express');
const argon2 = require('argon2');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Người dùng hiện tại, lấy từ session đã xác minh (không tin dữ liệu từ frontend).
router.get('/', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.patch('/profile', authenticate, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const assignments = [];
  const profileAssignments = [];
  const request = getPool().request().input('id', sql.BigInt, req.user.id);
  const profileRequest = getPool().request().input('userId', sql.BigInt, req.user.id);

  if (Object.hasOwn(body, 'fullName')) {
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    if (!fullName || fullName.length > 150) return res.status(400).json({ error: 'Họ tên là bắt buộc (tối đa 150 ký tự)' });
    request.input('fullName', sql.NVarChar(150), fullName);
    assignments.push('full_name = @fullName');
  }
  if (Object.hasOwn(body, 'email')) {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return res.status(400).json({ error: 'Email không hợp lệ' });
    request.input('email', sql.NVarChar(255), email);
    assignments.push('email = @email');
  }
  if (Object.hasOwn(body, 'phone')) {
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (phone.length > 20) return res.status(400).json({ error: 'Số điện thoại tối đa 20 ký tự' });
    request.input('phone', sql.NVarChar(20), phone || null);
    assignments.push('phone = @phone');
  }
  if (Object.hasOwn(body, 'searchStatus')) {
    if (typeof body.searchStatus !== 'boolean') return res.status(400).json({ error: 'searchStatus phải là true hoặc false' });
    request.input('searchStatus', sql.Bit, body.searchStatus);
    assignments.push('search_status = @searchStatus');
  }
  if (Object.hasOwn(body, 'twoFactorEnabled')) {
    if (typeof body.twoFactorEnabled !== 'boolean') return res.status(400).json({ error: 'twoFactorEnabled phải là true hoặc false' });
    request.input('twoFactorEnabled', sql.Bit, body.twoFactorEnabled);
    assignments.push('two_factor_enabled = @twoFactorEnabled');
  }
  if (['title', 'location', 'experience', 'skills'].some((key) => Object.hasOwn(body, key))) {
    if (req.user.role !== 'candidate') return res.status(403).json({ error: 'Chỉ ứng viên mới được cập nhật hồ sơ nghề nghiệp' });
    for (const [key, column, max] of [['title', 'title', 200], ['location', 'location', 200], ['experience', 'experience', 100]]) {
      if (!Object.hasOwn(body, key)) continue;
      const value = typeof body[key] === 'string' ? body[key].trim() : '';
      if (value.length > max) return res.status(400).json({ error: `${key} tối đa ${max} ký tự` });
      profileRequest.input(key, sql.NVarChar(max), value || null);
      profileAssignments.push(`${column} = @${key}`);
    }
    if (Object.hasOwn(body, 'skills')) {
      const rawSkills = Array.isArray(body.skills)
        ? body.skills
        : (typeof body.skills === 'string' ? body.skills.split(',') : null);
      if (!rawSkills || rawSkills.some((skill) => typeof skill !== 'string')) {
        return res.status(400).json({ error: 'skills phải là danh sách kỹ năng hợp lệ' });
      }
      const skills = [...new Set(rawSkills.map((skill) => skill.trim()).filter(Boolean))];
      if (skills.length > 30 || skills.some((skill) => skill.length > 80)) {
        return res.status(400).json({ error: 'Tối đa 30 kỹ năng, mỗi kỹ năng không quá 80 ký tự' });
      }
      profileRequest.input('skills', sql.NVarChar(sql.MAX), JSON.stringify(skills));
      profileAssignments.push('skills = @skills');
    }
  }
  if (!assignments.length && !profileAssignments.length) return res.status(400).json({ error: 'Không có trường hợp hợp lệ để cập nhật' });

  try {
    if (assignments.length) await request.query(`UPDATE dbo.users SET ${assignments.join(', ')} WHERE id = @id`);
    if (profileAssignments.length) {
      await profileRequest.query(`
        IF EXISTS (SELECT 1 FROM dbo.candidate_profiles WHERE user_id = @userId)
          UPDATE dbo.candidate_profiles SET ${profileAssignments.join(', ')} WHERE user_id = @userId;
        ELSE
          INSERT INTO dbo.candidate_profiles (user_id, ${profileAssignments.map((item) => item.split(' = ')[0]).join(', ')})
          VALUES (@userId, ${profileAssignments.map((item) => item.split(' = ')[1]).join(', ')});`);
    }
    const result = await getPool().request().input('id', sql.BigInt, req.user.id).query(`
      SELECT u.id, u.email, u.full_name AS fullName, u.role, u.phone,
        u.search_status AS searchStatus, u.two_factor_enabled AS twoFactorEnabled,
        p.title, p.location, p.experience, p.skills
      FROM dbo.users AS u LEFT JOIN dbo.candidate_profiles AS p ON p.user_id = u.id
      WHERE u.id = @id`);
    const user = result.recordset[0];
    if (user && user.skills) {
      try { user.skills = JSON.parse(user.skills); } catch (_) { user.skills = []; }
    } else if (user) user.skills = [];
    return res.json({ user });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) return res.status(409).json({ error: 'Email đã được sử dụng' });
    throw error;
  }
}));

router.post('/password', authenticate, asyncHandler(async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (!currentPassword || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ error: 'Mật khẩu mới phải từ 8 đến 128 ký tự' });
  }
  const result = await getPool().request().input('id', sql.BigInt, req.user.id)
    .query('SELECT password_hash FROM dbo.users WHERE id = @id');
  const hash = result.recordset[0]?.password_hash;
  let matches = false;
  if (hash) {
    try { matches = await argon2.verify(hash, currentPassword); } catch (_) { matches = false; }
  }
  if (!matches) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
  const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await getPool().request().input('id', sql.BigInt, req.user.id).input('hash', sql.NVarChar(255), newHash)
    .query('UPDATE dbo.users SET password_hash = @hash WHERE id = @id');
  return res.json({ ok: true });
}));

module.exports = router;
