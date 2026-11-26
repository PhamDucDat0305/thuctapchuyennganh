const service = require('../services/jobs.service');

function validPositiveId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

async function list(_req, res) {
  return res.json(await service.listPublicJobs());
}

async function getById(req, res) {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  return res.json(await service.getPublicJob(req.params.id));
}

async function countView(req, res) {
  if (!validPositiveId(req.params.id)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  return res.json(await service.countPublicView(req.params.id, req.session?.userId || null));
}

module.exports = { list, getById, countView };
