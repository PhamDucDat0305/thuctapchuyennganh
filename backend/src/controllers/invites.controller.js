const service = require('../services/invites.service');

function validId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

async function list(req, res) {
  return res.json(await service.list(req.user.id));
}

async function listSent(req, res) {
  return res.json(await service.listSent(req.user.id));
}

async function listConnections(req, res) {
  return res.json(await service.listConnections(req.user.id));
}

async function removeConnection(req, res) {
  if (!validId(req.params.candidateId)) return res.status(400).json({ error: 'Mã ứng viên không hợp lệ' });
  return res.json(await service.removeConnection(req.user.id, req.params.candidateId));
}

async function create(req, res) {
  const candidateId = String(req.body?.candidateId ?? '');
  const jobId = req.body?.jobId == null || req.body.jobId === '' ? null : String(req.body.jobId);
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!validId(candidateId)) return res.status(400).json({ error: 'Mã ứng viên không hợp lệ' });
  if (jobId !== null && !validId(jobId)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  if (message.length > 1000) return res.status(400).json({ error: 'Lời nhắn không được vượt quá 1.000 ký tự' });

  const invite = await service.create({
    employerId: req.user.id,
    candidateId,
    jobId,
    message,
  });
  return res.status(201).json(invite);
}

async function updateStatus(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Mã lời mời không hợp lệ' });
  const status = req.body?.status;
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái phải là accepted hoặc rejected' });
  }
  return res.json(await service.respond(req.params.id, req.user.id, status));
}

module.exports = { list, listSent, listConnections, removeConnection, create, updateStatus };
