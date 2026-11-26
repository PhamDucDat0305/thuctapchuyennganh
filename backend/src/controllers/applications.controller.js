const service = require('../services/applications.service');

function validId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

function invalidId(res, message) {
  return res.status(400).json({ error: message });
}

async function list(req, res) {
  return res.json(await service.list(req.user));
}

async function check(req, res) {
  if (!validId(req.params.jobId)) return invalidId(res, 'Mã công việc không hợp lệ');
  return res.json(await service.check(req.params.jobId, req.user.id));
}

async function listForJob(req, res) {
  if (!validId(req.params.jobId)) return invalidId(res, 'Mã công việc không hợp lệ');
  return res.json(await service.listForJob(req.params.jobId, req.user));
}

async function create(req, res) {
  const result = await service.create(req.user.id, req.body || {});
  return res.status(result.status).json(result.application);
}

async function get(req, res) {
  if (!validId(req.params.id)) return invalidId(res, 'Mã đơn ứng tuyển không hợp lệ');
  return res.json(await service.get(req.params.id, req.user));
}

async function updateStatus(req, res) {
  if (!validId(req.params.id)) return invalidId(res, 'Mã đơn ứng tuyển không hợp lệ');
  return res.json(await service.updateStatus(req.params.id, req.user, req.body?.status));
}

async function withdraw(req, res) {
  if (!validId(req.params.id)) return invalidId(res, 'Mã đơn ứng tuyển không hợp lệ');
  return res.json(await service.withdraw(req.params.id, req.user.id));
}

module.exports = { list, check, listForJob, create, get, updateStatus, withdraw };
