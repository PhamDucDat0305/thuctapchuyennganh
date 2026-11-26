const service = require('../services/users.service');

function validId(value) {
  return /^[1-9]\d*$/.test(value);
}

function invalidId(res) {
  return res.status(400).json({ error: 'Mã người dùng không hợp lệ' });
}

async function getPublicCandidate(req, res) {
  if (!validId(req.params.id)) return invalidId(res);
  return res.json(await service.getPublicCandidate(req.params.id));
}

async function listCandidates(_req, res) {
  return res.json(await service.listDiscoverableCandidates());
}

async function getById(req, res) {
  if (!validId(req.params.id)) return invalidId(res);
  return res.json(await service.getUser(req.params.id, req.user));
}

module.exports = { getPublicCandidate, listCandidates, getById };
