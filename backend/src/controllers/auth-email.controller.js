const service = require('../services/auth-email.service');
async function sendCode(req, res) {
  try { const result = await service.sendCode(req.body?.email); return res.status(result.status).json(result.body); }
  catch (error) { if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter)); throw error; }
}
async function verifyCode(req, res) { return res.json(await service.verifyCode(req.body?.email, req.body?.code)); }
module.exports = { sendCode, verifyCode };
