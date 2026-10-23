const express = require('express');
const argon2 = require('argon2');
const { sql, getPool } = require('../config/database');
const { SESSION_COOKIE_NAME } = require('../config/session');
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');
const { regenerateSession, saveSession, destroySession } = require('../utils/sessionHelpers');

const router = express.Router();
const limitRegister = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau.' });
const limitLogin = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.' });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_ROLES = ['candidate', 'employer']; // không bao giờ nhận 'admin' từ người dùng

const str = (v) => (typeof v === 'string' ? v.trim() : '');

// Băm giả để thời gian phản hồi giống nhau khi email không tồn tại.
let dummyHashPromise = null;
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash('dummy-password-for-timing', { type: argon2.argon2id });
  }
  return dummyHashPromise;
}

function publicUser(row) {
  return {
    id: Number(row.id),
    email: row.email,
    fullName: row.full_name,
    role: row.role,
  };
}

async function startSession(req, userId) {
  await regenerateSession(req); // chống session fixation
  req.session.userId = Number(userId);
  await saveSession(req);
}

/* ---------------------------- Đăng ký ---------------------------- */
router.post('/register', limitRegister, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const fullName = str(body.fullName);
  const role = str(body.role);
  const phone = str(body.phone);
  const companyName = str(body.companyName);

  if (!EMAIL_RE.test(email) || email.length > 255) {
    return res.status(400).json({ error: 'Email không hợp lệ' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Mật khẩu phải từ 8 đến 128 ký tự' });
  }
  if (!fullName || fullName.length > 150) {
    return res.status(400).json({ error: 'Họ tên là bắt buộc (tối đa 150 ký tự)' });
  }
  if (!PUBLIC_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Vai trò phải là candidate hoặc employer' });
  }
  if (phone.length > 20) {
    return res.status(400).json({ error: 'Số điện thoại quá dài (tối đa 20 ký tự)' });
  }
  if (role === 'employer' && (!companyName || companyName.length > 200)) {
    return res.status(400).json({ error: 'Nhà tuyển dụng cần nhập tên công ty (tối đa 200 ký tự)' });
  }

  const pool = getPool();
  const existing = await pool.request()
    .input('email', sql.NVarChar(255), email)
    .query('SELECT 1 AS found FROM dbo.users WHERE email = @email');
  if (existing.recordset.length > 0) {
    return res.status(409).json({ error: 'Email đã được đăng ký' });
  }

  const hash = await argon2.hash(password, { type: argon2.argon2id });

  const tx = new sql.Transaction(pool);
  await tx.begin();
  let userId;
  try {
    const inserted = await new sql.Request(tx)
      .input('email', sql.NVarChar(255), email)
      .input('hash', sql.NVarChar(255), hash)
      .input('fullName', sql.NVarChar(150), fullName)
      .input('phone', sql.NVarChar(20), phone || null)
      .input('role', sql.NVarChar(20), role)
      .query(`INSERT INTO dbo.users (email, password_hash, full_name, phone, role)
              VALUES (@email, @hash, @fullName, @phone, @role);
              SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS id;`);
    userId = inserted.recordset[0].id;

    if (role === 'candidate') {
      await new sql.Request(tx)
        .input('id', sql.BigInt, userId)
        .query('INSERT INTO dbo.candidate_profiles (user_id) VALUES (@id)');
    } else {
      await new sql.Request(tx)
        .input('id', sql.BigInt, userId)
        .input('name', sql.NVarChar(200), companyName)
        .query('INSERT INTO dbo.companies (employer_id, name) VALUES (@id, @name)');
    }
    await tx.commit();
  } catch (err) {
    try { await tx.rollback(); } catch (_) { /* giao dịch đã đóng */ }
    // 2627/2601: vi phạm UNIQUE (hai request đăng ký cùng email gần như đồng thời)
    if (err.number === 2627 || err.number === 2601) {
      return res.status(409).json({ error: 'Email đã được đăng ký' });
    }
    throw err;
  }

  await startSession(req, userId);
  res.status(201).json({ user: { id: Number(userId), email, fullName, role } });
}));

/* ---------------------------- Đăng nhập ---------------------------- */
router.post('/login', limitLogin, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password || password.length > 128) {
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
  }

  const result = await getPool().request()
    .input('email', sql.NVarChar(255), email)
    .query(`SELECT id, email, password_hash, full_name, role, status
            FROM dbo.users WHERE email = @email`);
  const user = result.recordset[0];

  const hashToCheck = user && user.password_hash ? user.password_hash : await getDummyHash();
  let passwordOk = false;
  try {
    passwordOk = await argon2.verify(hashToCheck, password);
  } catch (_) {
    passwordOk = false;
  }

  if (!user || !user.password_hash || !passwordOk) {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
  }

  await startSession(req, user.id);
  res.json({ user: publicUser(user) });
}));

/* ---------------------------- Đăng xuất ---------------------------- */
router.post('/logout', asyncHandler(async (req, res) => {
  await destroySession(req);
  res.clearCookie(SESSION_COOKIE_NAME);
  res.json({ ok: true });
}));

module.exports = router;
