const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const repository = require('../repositories/candidate-content.repository');

const cvDirectory = path.resolve(__dirname, '..', '..', '..', 'private_uploads', 'cvs');
const MAX_CV_BYTES = 10 * 1024 * 1024;

function makeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function decodeHeader(value) {
  try { return decodeURIComponent(String(value || '')); } catch (_) { return ''; }
}

function validateCv(file, headers) {
  const suppliedName = decodeHeader(headers['x-file-name']).trim();
  const originalName = path.posix.basename(suppliedName.replace(/\\/g, '/')).slice(0, 255);
  const suppliedTitle = decodeHeader(headers['x-cv-title']).trim();
  const title = (suppliedTitle || path.parse(originalName).name || 'CV').slice(0, 150);
  const extension = path.extname(originalName).toLowerCase();
  const mimeType = String(headers['content-type'] || '').split(';')[0].toLowerCase();
  const signatures = {
    '.pdf': (buf) => buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-',
    '.doc': (buf) => buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
    '.docx': (buf) => buf.length >= 4 && buf.subarray(0, 2).toString('ascii') === 'PK',
    '.jpg': (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
    '.jpeg': (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
    '.png': (buf) => buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    '.webp': (buf) => buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP',
  };
  const mimeByExtension = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  if (!file?.length || file.length > MAX_CV_BYTES) throw makeError('CV trống hoặc vượt quá 10MB', 400);
  if (!originalName || !signatures[extension]?.(file)
    || (mimeType !== 'application/octet-stream' && mimeType !== mimeByExtension[extension])) {
    throw makeError('Chỉ nhận PDF, DOC, DOCX, JPG, PNG hoặc WEBP hợp lệ', 415);
  }
  if (!title) throw makeError('Tên CV không được để trống', 400);
  return { originalName, title, extension, mimeType: mimeByExtension[extension] };
}

async function listCvs(candidateId) {
  const rows = await repository.listCvs(candidateId);
  return rows.map((row) => {
    const available = Number(row.sizeBytes) > 0 && !String(row.storedName || '').startsWith('legacy-missing-');
    return {
      ...row,
      id: Number(row.id),
      candidateId: Number(row.candidateId),
      sizeBytes: Number(row.sizeBytes),
      isDefault: Boolean(row.isDefault),
      isAvailable: available,
      downloadUrl: available ? `/api/candidate-content/cvs/${row.id}/file` : null,
    };
  });
}

async function uploadCv(candidateId, headers, file) {
  const metadata = validateCv(file, headers);
  await fs.mkdir(cvDirectory, { recursive: true });
  const storedName = `${crypto.randomUUID()}${metadata.extension}`;
  const fullPath = path.join(cvDirectory, storedName);
  await fs.writeFile(fullPath, file, { flag: 'wx', mode: 0o600 });
  try {
    const id = await repository.insertCv({
      candidateId,
      title: metadata.title,
      originalName: metadata.originalName,
      storedName,
      fileUrl: `private_uploads/cvs/${storedName}`,
      mimeType: metadata.mimeType,
      sizeBytes: file.length,
    });
    return {
      id: Number(id),
      title: metadata.title,
      originalName: metadata.originalName,
      mimeType: metadata.mimeType,
      sizeBytes: file.length,
      isDefault: false,
      downloadUrl: `/api/candidate-content/cvs/${id}/file`,
    };
  } catch (error) {
    await fs.unlink(fullPath).catch(() => {});
    throw error;
  }
}

async function setDefaultCv(id, candidateId) {
  if (!await repository.setDefaultCv(id, candidateId)) throw makeError('Không tìm thấy CV', 404);
  return { ok: true };
}

async function deleteCv(id, candidateId) {
  const cv = await repository.findOwnedCv(id, candidateId);
  if (!cv) throw makeError('Không tìm thấy CV', 404);
  if (await repository.isCvInUse(id)) throw makeError('CV đang được đính kèm hồ sơ ứng tuyển nên không thể xóa', 409);
  await repository.deleteCv(id, candidateId);
  await fs.unlink(path.join(cvDirectory, cv.storedName)).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  return { ok: true };
}

async function getCvDownload(id, user) {
  const cv = await repository.findCv(id);
  if (!cv) throw makeError('Không tìm thấy CV', 404);
  if (Number(cv.sizeBytes) <= 0 || String(cv.storedName || '').startsWith('legacy-missing-')) {
    throw makeError('Bản ghi CV cũ không có tệp để tải xuống. Hãy tải lại CV.', 404);
  }

  let allowed = user.role === 'admin' || (user.role === 'candidate' && Number(cv.candidateId) === user.id);
  if (user.role === 'employer') {
    allowed = await repository.employerCanDownloadCv(id, cv.candidateId, user.id);
  }
  if (!allowed) throw makeError('Không tìm thấy CV trong phạm vi được phép', 404);
  return {
    filePath: path.join(cvDirectory, cv.storedName),
    downloadName: path.basename(cv.originalName),
    mimeType: cv.mimeType,
  };
}

async function listCoverLetters(candidateId) {
  return repository.listCoverLetters(candidateId);
}

async function createCoverLetter(candidateId, body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!title || title.length > 150) throw makeError('Tiêu đề bắt buộc, tối đa 150 ký tự', 400);
  if (!content || content.length > 10000) throw makeError('Nội dung bắt buộc, tối đa 10.000 ký tự', 400);
  const id = await repository.insertCoverLetter(candidateId, title, content);
  return { id: Number(id), title, content };
}

async function updateCoverLetter(id, candidateId, body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!title || title.length > 150 || !content || content.length > 10000) {
    throw makeError('Tiêu đề và nội dung hợp lệ là bắt buộc (nội dung tối đa 10.000 ký tự)', 400);
  }
  if (!await repository.updateCoverLetter(id, candidateId, title, content)) {
    throw makeError('Không tìm thấy cover letter', 404);
  }
  return { id: Number(id), title, content };
}

async function deleteCoverLetter(id, candidateId) {
  if (!await repository.deleteCoverLetter(id, candidateId)) throw makeError('Không tìm thấy cover letter', 404);
  return { ok: true };
}

module.exports = {
  listCvs,
  uploadCv,
  setDefaultCv,
  deleteCv,
  getCvDownload,
  listCoverLetters,
  createCoverLetter,
  updateCoverLetter,
  deleteCoverLetter,
};
