const service = require('../services/employer-saved-candidates.service');

function validId(value) {
  return /^[1-9]\d*$/.test(String(value || ''));
}

function invalidId(res) {
  return res.status(400).json({ error: 'Mã ứng viên không hợp lệ' });
}

async function list(req, res) {
  return res.json(await service.list(req.user.id));
}

async function save(req, res) {
  if (!validId(req.params.candidateId)) return invalidId(res);
  const result = await service.save(req.user.id, req.params.candidateId);
  return res.status(result.created ? 201 : 200).json({ saved: true });
}

async function remove(req, res) {
  if (!validId(req.params.candidateId)) return invalidId(res);
  return res.json(await service.remove(req.user.id, req.params.candidateId));
}

module.exports = { list, save, remove };
