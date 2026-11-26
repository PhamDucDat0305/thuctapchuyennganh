const crypto = require('node:crypto');
const { QueryTypes, Transaction } = require('sequelize');
const { sequelize, User, EmailVerification } = require('../models');
const OTP_TTL_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const TOKEN_TTL_MINUTES = 10;

async function isRegistered(email) {
  return (await User.count({ where: { email } })) > 0;
}
async function createChallenge(email, otpHash) {
  const tx = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE });
  try {
    const previous = await sequelize.query(`
      SELECT TOP (1) id,last_sent_at AS lastSentAt,
        CASE WHEN last_sent_at>DATEADD(SECOND,-${RESEND_COOLDOWN_SECONDS},SYSUTCDATETIME()) THEN 1 ELSE 0 END AS coolingDown
      FROM dbo.email_verifications WITH (UPDLOCK,HOLDLOCK)
      WHERE email=:email ORDER BY id DESC`, {
      replacements: { email }, transaction: tx, type: QueryTypes.SELECT,
    });
    const row = previous[0];
    if (row) {
      if (Number(row.coolingDown) === 1) { await tx.commit(); return { cooldown: true }; }
      const [affected] = await EmailVerification.update({
        otpHash,
        expiresAt: sequelize.literal(`DATEADD(MINUTE,${OTP_TTL_MINUTES},SYSUTCDATETIME())`),
        attemptCount: 0,
        lastSentAt: sequelize.literal('SYSUTCDATETIME()'),
        createdAt: sequelize.literal('SYSUTCDATETIME()'),
        verifiedAt: null,
        verificationTokenHash: null,
        verificationExpiresAt: null,
        consumedAt: null,
      }, { where: { id: row.id }, transaction: tx });
      if (affected !== 1) throw new Error('Không thể cập nhật mã xác minh email');
      await tx.commit(); return { id: row.id };
    }
    const inserted = await EmailVerification.create({
      email,
      otpHash,
      expiresAt: sequelize.literal(`DATEADD(MINUTE,${OTP_TTL_MINUTES},SYSUTCDATETIME())`),
      attemptCount: 0,
      lastSentAt: sequelize.literal('SYSUTCDATETIME()'),
      createdAt: sequelize.literal('SYSUTCDATETIME()'),
    }, { transaction: tx, fields: ['email', 'otpHash', 'expiresAt', 'attemptCount', 'lastSentAt', 'createdAt'] });
    await tx.commit(); return { id: inserted.id };
  } catch (error) { await tx.rollback().catch(() => {}); throw error; }
}
async function invalidateUndelivered(id, otpHash) {
  await EmailVerification.update({
    expiresAt: sequelize.literal('SYSUTCDATETIME()'),
    lastSentAt: sequelize.literal(`DATEADD(SECOND,-${RESEND_COOLDOWN_SECONDS},SYSUTCDATETIME())`),
  }, { where: { id, otpHash, verifiedAt: null } });
}
async function verifyChallenge({ email, otpHash, tokenHash }) {
  const tx = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE });
  try {
    const result = await sequelize.query(`
      SELECT TOP (1) id,otp_hash,attempt_count,verified_at,consumed_at,
        CASE WHEN expires_at>SYSUTCDATETIME() THEN 1 ELSE 0 END AS code_is_valid
      FROM dbo.email_verifications WITH (UPDLOCK,HOLDLOCK) WHERE email=:email ORDER BY id DESC`, {
      replacements: { email }, transaction: tx, type: QueryTypes.SELECT,
    });
    const row = result[0];
    if (!row || row.consumed_at || row.verified_at || !row.code_is_valid || row.attempt_count >= MAX_ATTEMPTS) {
      await tx.rollback(); return { error: 'invalid' };
    }
    const storedHash = Buffer.from(row.otp_hash || '', 'hex');
    const submittedHash = Buffer.from(otpHash, 'hex');
    const matches = storedHash.length === submittedHash.length && crypto.timingSafeEqual(storedHash, submittedHash);
    if (!matches) {
      await EmailVerification.increment('attemptCount', { by: 1, where: { id: row.id }, transaction: tx });
      await tx.commit(); return { error: 'wrong' };
    }
    const [affected] = await EmailVerification.update({
      verifiedAt: sequelize.literal('SYSUTCDATETIME()'),
      verificationTokenHash: tokenHash,
      verificationExpiresAt: sequelize.literal(`DATEADD(MINUTE,${TOKEN_TTL_MINUTES},SYSUTCDATETIME())`),
    }, { where: { id: row.id }, transaction: tx });
    if (affected !== 1) throw new Error('Không thể xác nhận mã email');
    await tx.commit(); return { ok: true };
  } catch (error) { await tx.rollback().catch(() => {}); throw error; }
}
module.exports = { isRegistered, createChallenge, invalidateUndelivered, verifyChallenge };
