const service = require('../services/candidate-content.service');

function validId(value) {
  return /^[1-9]\d*$/.test(String(value || ''));
}

function invalidCvId(res) {
  return res.status(400).json({ error: 'Mã CV không hợp lệ' });
}

function invalidCoverLetterId(res) {
  return res.status(400).json({ error: 'Mã cover letter không hợp lệ' });
}

async function listCvs(req, res) {
  return res.json(await service.listCvs(req.user.id));
}

async function uploadCv(req, res) {
  const file = Buffer.isBuffer(req.body) ? req.body : null;
  return res.status(201).json(await service.uploadCv(req.user.id, req.headers, file));
}

async function setDefaultCv(req, res) {
  if (!validId(req.params.id)) return invalidCvId(res);
  return res.json(await service.setDefaultCv(req.params.id, req.user.id));
}

async function deleteCv(req, res) {
  if (!validId(req.params.id)) return invalidCvId(res);
  return res.json(await service.deleteCv(req.params.id, req.user.id));
}

async function downloadCv(req, res) {
  if (!validId(req.params.id)) return invalidCvId(res);
  const file = await service.getCvDownload(req.params.id, req.user);
  if (req.query.download === '1') return res.download(file.filePath, file.downloadName);

  const asciiName = file.downloadName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'cv';
  const encodedName = encodeURIComponent(file.downloadName).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(file.filePath);
}

async function listCoverLetters(req, res) {
  return res.json(await service.listCoverLetters(req.user.id));
}

async function createCoverLetter(req, res) {
  return res.status(201).json(await service.createCoverLetter(req.user.id, req.body));
}

async function updateCoverLetter(req, res) {
  if (!validId(req.params.id)) return invalidCoverLetterId(res);
  return res.json(await service.updateCoverLetter(req.params.id, req.user.id, req.body));
}

async function deleteCoverLetter(req, res) {
  if (!validId(req.params.id)) return invalidCoverLetterId(res);
  return res.json(await service.deleteCoverLetter(req.params.id, req.user.id));
}

module.exports = {
  listCvs,
  uploadCv,
  setDefaultCv,
  deleteCv,
  downloadCv,
  listCoverLetters,
  createCoverLetter,
  updateCoverLetter,
  deleteCoverLetter,
};
