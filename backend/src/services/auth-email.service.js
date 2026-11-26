const crypto = require('node:crypto');
const repository = require('../repositories/auth-email.repository');
const { generateOTP, hashOTP } = require('../utils/otp');
const { sendOTPEmail } = require('./emailService');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_SEND_RESPONSE = { ok: true, message: 'Nếu email có thể đăng ký, mã xác nhận sẽ được gửi đến hộp thư đó.' };
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function normalizeEmail(value) { const email = typeof value === 'string' ? value.trim().toLowerCase() : ''; if (!EMAIL_RE.test(email) || email.length > 255) fail('Email không hợp lệ'); return email; }
function hashVerificationToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
async function sendCode(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (await repository.isRegistered(email)) return { status: 202, body: GENERIC_SEND_RESPONSE };
  const otp = generateOTP(); const otpHash = hashOTP(email, otp);
  const challenge = await repository.createChallenge(email, otpHash);
  if (challenge.cooldown) { const error = new Error('Đợi 60 giây trước khi yêu cầu gửi mã mới.'); error.status = 429; error.retryAfter = 60; throw error; }
  try { await sendOTPEmail(email, otp); }
  catch (error) { await repository.invalidateUndelivered(challenge.id, otpHash); throw error; }
  return { status: 202, body: GENERIC_SEND_RESPONSE };
}
async function verifyCode(rawEmail, rawCode) {
  const email = normalizeEmail(rawEmail); const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (!/^\d{6}$/.test(code)) fail('Email hoặc mã xác nhận không hợp lệ');
  const token = crypto.randomBytes(32).toString('base64url');
  const result = await repository.verifyChallenge({ email, otpHash: hashOTP(email, code), tokenHash: hashVerificationToken(token) });
  if (result.error === 'wrong') fail('Mã xác nhận không đúng');
  if (result.error) fail('Mã xác nhận không hợp lệ hoặc đã hết hạn. Hãy yêu cầu mã mới.');
  return { ok: true, verificationToken: token, expiresInSeconds: 600 };
}
module.exports = { sendCode, verifyCode };
