const service = require('../services/saved-jobs.service');

function validId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

function invalidId(res) {
  return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
}

async function list(req, res) {
  return res.json(await service.list(req.user.id));
}

async function check(req, res) {
  if (!validId(req.params.jobId)) return invalidId(res);
  return res.json({ saved: await service.check(req.user.id, req.params.jobId) });
}

async function toggle(req, res) {
  if (!validId(req.params.jobId)) return invalidId(res);
  return res.json({ saved: await service.toggle(req.user.id, req.params.jobId) });
}

async function remove(req, res) {
  if (!validId(req.params.jobId)) return invalidId(res);
  return res.json({ saved: await service.remove(req.user.id, req.params.jobId) });
}

module.exports = { list, check, toggle, remove };
