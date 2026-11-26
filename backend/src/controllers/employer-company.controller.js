const service = require('../services/employer-company.service');

async function getMine(req, res) {
  return res.json(await service.getMine(req.user.id));
}

async function uploadLogo(req, res) {
  const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  const image = Buffer.isBuffer(req.body) ? req.body : null;
  const result = await service.uploadLogo(req.user.id, contentType, image);
  return res.status(201).json(result);
}

async function createOrUpdate(req, res) {
  const result = await service.createOrUpdate(req.user.id, req.body || {});
  return res.status(201).json(result);
}

async function update(req, res) {
  return res.json(await service.update(req.user.id, req.body || {}));
}

module.exports = { getMine, uploadLogo, createOrUpdate, update };
