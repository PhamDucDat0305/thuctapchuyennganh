const service = require('../services/employer-jobs.service');

function validId(value) {
  return /^\d+$/.test(value);
}

function invalidId(res) {
  return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
}

async function list(req, res) {
  return res.json(await service.list(req.user.id));
}

async function get(req, res) {
  if (!validId(req.params.id)) return invalidId(res);
  return res.json(await service.get(req.user.id, req.params.id));
}

async function create(req, res) {
  return res.status(201).json(await service.create(req.user.id, req.body || {}));
}

async function update(req, res) {
  if (!validId(req.params.id)) return invalidId(res);
  return res.json(await service.update(req.user.id, req.params.id, req.body || {}));
}

async function close(req, res) {
  if (!validId(req.params.id)) return invalidId(res);
  return res.json(await service.close(req.user.id, req.params.id));
}

module.exports = { list, get, create, update, close };
