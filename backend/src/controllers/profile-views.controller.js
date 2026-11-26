const service = require('../services/profile-views.service');

function validId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

async function list(req, res) {
  return res.json(await service.list(req.user.id));
}

async function record(req, res) {
  const candidateId = String(req.body?.candidateId ?? '');
  if (!validId(candidateId)) return res.status(400).json({ error: 'Mã ứng viên không hợp lệ' });
  if (candidateId === String(req.user.id)) {
    return res.status(400).json({ error: 'Không thể xem hồ sơ của chính mình' });
  }
  return res.json(await service.record(req.user.id, candidateId));
}

module.exports = { list, record };
