const express = require('express');
const crypto = require('node:crypto');
const { sql, getPool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');
const { generateOTP, hashOTP, verifyOTP } = require('../utils/otp');
const { sendOTPEmail } = require('../services/emailService');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MINUTES = 5;
const TOKEN_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const GENERIC_SEND_RESPONSE = {
  ok: true,
  message: 'Nếu email có thể đăng ký, mã xác nhận sẽ được gửi đến hộp thư đó.',
};

const str = (value) => (typeof value === 'string' ? value.trim() : '');
const limitSend = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Bạn đã yêu cầu gửi mã quá nhiều lần. Vui lòng thử lại sau.',
});
const limitVerify = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Bạn đã xác minh quá nhiều lần. Vui lòng thử lại sau.',
});

function hashVerificationToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function rollbackQuietly(tx) {
  try { await tx.rollback(); } catch (_) { /* transaction may already be closed */ }
}

router.post('/send-code', limitSend, asyncHandler(async (req, res) => {
  const email = str(req.body?.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 255) {
    return res.status(400).json({ error: 'Email không hợp lệ' });
  }

  const pool = getPool();
  const registered = await pool.request()
    .input('email', sql.NVarChar(255), email)
    .query('SELECT 1 AS found FROM dbo.users WHERE email = @email');
  if (registered.recordset.length) return res.status(202).json(GENERIC_SEND_RESPONSE);

  const otp = generateOTP();
  const otpHash = hashOTP(email, otp);
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  let verificationId;
  try {
    const previous = await new sql.Request(tx)
      .input('email', sql.NVarChar(255), email)
      .query(`SELECT TOP (1) id, last_sent_at
              FROM dbo.email_verifications WITH (UPDLOCK, HOLDLOCK)
              WHERE email = @email
              ORDER BY id DESC`);
    const row = previous.recordset[0];

    if (row) {
      const cooldown = await new sql.Request(tx)
        .input('id', sql.Int, row.id)
        .query(`SELECT CASE WHEN last_sent_at > DATEADD(SECOND, -${RESEND_COOLDOWN_SECONDS}, SYSUTCDATETIME())
                            THEN 1 ELSE 0 END AS cooling_down
                FROM dbo.email_verifications WHERE id = @id`);
      if (cooldown.recordset[0].cooling_down) {
        await rollbackQuietly(tx);
        res.setHeader('Retry-After', String(RESEND_COOLDOWN_SECONDS));
        return res.status(429).json({ error: 'Đợi 60 giây trước khi yêu cầu gửi mã mới.' });
      }

      await new sql.Request(tx)
        .input('id', sql.Int, row.id)
        .input('otpHash', sql.VarChar(64), otpHash)
        .query(`UPDATE dbo.email_verifications
                SET otp_hash = @otpHash,
                    expires_at = DATEADD(MINUTE, ${OTP_TTL_MINUTES}, SYSUTCDATETIME()),
                    attempt_count = 0,
                    last_sent_at = SYSUTCDATETIME(),
                    created_at = SYSUTCDATETIME(),
                    verified_at = NULL,
                    verification_token_hash = NULL,
                    verification_expires_at = NULL,
                    consumed_at = NULL
                WHERE id = @id`);
      verificationId = row.id;
    } else {
      const inserted = await new sql.Request(tx)
        .input('email', sql.NVarChar(255), email)
        .input('otpHash', sql.VarChar(64), otpHash)
        .query(`INSERT INTO dbo.email_verifications
                  (email, otp_hash, expires_at, attempt_count, last_sent_at, created_at)
                VALUES
                  (@email, @otpHash, DATEADD(MINUTE, ${OTP_TTL_MINUTES}, SYSUTCDATETIME()),
                   0, SYSUTCDATETIME(), SYSUTCDATETIME());
                SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;`);
      verificationId = inserted.recordset[0].id;
    }

    await tx.commit();
  } catch (error) {
    await rollbackQuietly(tx);
    throw error;
  }

  try {
    await sendOTPEmail(email, otp);
  } catch (error) {
    // Expire only this challenge if delivery failed; do not leave an unusable valid code.
    await pool.request()
      .input('id', sql.Int, verificationId)
      .input('otpHash', sql.VarChar(64), otpHash)
      .query(`UPDATE dbo.email_verifications
              SET expires_at = SYSUTCDATETIME(),
                  last_sent_at = DATEADD(SECOND, -${RESEND_COOLDOWN_SECONDS}, SYSUTCDATETIME())
              WHERE id = @id AND otp_hash = @otpHash AND verified_at IS NULL`);
    throw error;
  }

  return res.status(202).json(GENERIC_SEND_RESPONSE);
}));

router.post('/verify-code', limitVerify, asyncHandler(async (req, res) => {
  const email = str(req.body?.email).toLowerCase();
  const otp = str(req.body?.code);
  if (!EMAIL_RE.test(email) || email.length > 255 || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Email hoặc mã xác nhận không hợp lệ' });
  }

  const pool = getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const result = await new sql.Request(tx)
      .input('email', sql.NVarChar(255), email)
      .query(`SELECT TOP (1) id, otp_hash, attempt_count, verified_at, consumed_at,
                     CASE WHEN expires_at > SYSUTCDATETIME() THEN 1 ELSE 0 END AS code_is_valid
              FROM dbo.email_verifications WITH (UPDLOCK, HOLDLOCK)
              WHERE email = @email
              ORDER BY id DESC`);
    const row = result.recordset[0];

    if (!row || row.consumed_at || row.verified_at || !row.code_is_valid || row.attempt_count >= MAX_ATTEMPTS) {
      await rollbackQuietly(tx);
      return res.status(400).json({ error: 'Mã xác nhận không hợp lệ hoặc đã hết hạn. Hãy yêu cầu mã mới.' });
    }

    if (!verifyOTP(email, otp, row.otp_hash)) {
      await new sql.Request(tx)
        .input('id', sql.Int, row.id)
        .query('UPDATE dbo.email_verifications SET attempt_count = attempt_count + 1 WHERE id = @id');
      await tx.commit();
      return res.status(400).json({ error: 'Mã xác nhận không đúng' });
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashVerificationToken(token);
    await new sql.Request(tx)
      .input('id', sql.Int, row.id)
      .input('tokenHash', sql.VarChar(64), tokenHash)
      .query(`UPDATE dbo.email_verifications
              SET verified_at = SYSUTCDATETIME(),
                  verification_token_hash = @tokenHash,
                  verification_expires_at = DATEADD(MINUTE, ${TOKEN_TTL_MINUTES}, SYSUTCDATETIME())
              WHERE id = @id`);
    await tx.commit();
    return res.json({ ok: true, verificationToken: token, expiresInSeconds: TOKEN_TTL_MINUTES * 60 });
  } catch (error) {
    await rollbackQuietly(tx);
    throw error;
  }
}));

module.exports = router;
