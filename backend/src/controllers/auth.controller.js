const service = require('../services/auth.service');
const { SESSION_COOKIE_NAME } = require('../config/session');
const { regenerateSession, saveSession, destroySession } = require('../utils/sessionHelpers');
const { disconnectUser } = require('../services/messages-events');

async function startSession(req, userId) {
  await regenerateSession(req);
  req.session.userId = Number(userId);
  await saveSession(req);
}
async function register(req, res) {
  const user = await service.register(req.body || {});
  await startSession(req, user.id);
  return res.status(201).json({ user });
}
async function login(req, res) {
  const user = await service.login(req.body || {});
  await startSession(req, user.id);
  return res.json({ user });
}
async function logout(req, res) {
  const userId = req.session?.userId;
  await destroySession(req);
  disconnectUser(userId);
  res.clearCookie(SESSION_COOKIE_NAME);
  return res.json({ ok: true });
}
module.exports = { register, login, logout };
