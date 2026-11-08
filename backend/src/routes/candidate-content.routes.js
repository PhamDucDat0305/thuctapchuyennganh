const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer', 'admin'));
const cvDirectory = path.resolve(__dirname, '..', '..', '..', 'private_uploads', 'cvs');
const MAX_CV_BYTES = 10 * 1024 * 1024;
const validId = (value) => /^[1-9]\d*$/.test(String(value || ''));

const cvSelect = `SELECT id, candidate_id AS candidateId, title, original_name AS originalName,
  stored_name AS storedName, mime_type AS mimeType, size_bytes AS sizeBytes, is_default AS isDefault,
  created_at AS createdAt, updated_at AS updatedAt FROM dbo.candidate_cvs`;

router.get('/cvs', requireRole('candidate'), asyncHandler(async (req, res) => {
  const result = await getPool().request().input('candidateId', sql.BigInt, req.user.id)
    .query(`${cvSelect} WHERE candidate_id = @candidateId ORDER BY is_default DESC, updated_at DESC, id DESC`);
  res.json(result.recordset.map((row) => {
    const available = Number(row.sizeBytes) > 0 && !String(row.storedName || '').startsWith('legacy-missing-');
    return { ...row, id: Number(row.id), candidateId: Number(row.candidateId), sizeBytes: Number(row.sizeBytes), isDefault: Boolean(row.isDefault), isAvailable: available, downloadUrl: available ? `/api/candidate-content/cvs/${row.id}/file` : null };
  }));
}));

router.post('/cvs', requireRole('candidate'), express.raw({ type: () => true, limit: '10mb' }), asyncHandler(async (req, res) => {
  const file = Buffer.isBuffer(req.body) ? req.body : null;
  const decodeHeader = (value) => { try { return decodeURIComponent(String(value || '')); } catch (_) { return ''; } };
  const suppliedName = decodeHeader(req.headers['x-file-name']).trim();
  const originalName = path.posix.basename(suppliedName.replace(/\\/g, '/')).slice(0, 255);
  const suppliedTitle = decodeHeader(req.headers['x-cv-title']).trim();
  const title = (suppliedTitle || path.parse(originalName).name || 'CV').slice(0, 150);
  const extension = path.extname(originalName).toLowerCase();
  const mimeType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
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
  if (!file?.length || file.length > MAX_CV_BYTES) return res.status(400).json({ error: 'CV trống hoặc vượt quá 10MB' });
  if (!originalName || !signatures[extension]?.(file) || (mimeType !== 'application/octet-stream' && mimeType !== mimeByExtension[extension])) {
    return res.status(415).json({ error: 'Chỉ nhận PDF, DOC, DOCX, JPG, PNG hoặc WEBP hợp lệ' });
  }
  if (!title) return res.status(400).json({ error: 'Tên CV không được để trống' });

  await fs.mkdir(cvDirectory, { recursive: true });
  const storedName = `${crypto.randomUUID()}${extension}`;
  const fullPath = path.join(cvDirectory, storedName);
  await fs.writeFile(fullPath, file, { flag: 'wx', mode: 0o600 });
  try {
    const result = await getPool().request()
      .input('candidateId', sql.BigInt, req.user.id)
      .input('title', sql.NVarChar(150), title)
      .input('originalName', sql.NVarChar(255), originalName)
      .input('storedName', sql.NVarChar(100), storedName)
      .input('fileUrl', sql.NVarChar(500), `private_uploads/cvs/${storedName}`)
      .input('mimeType', sql.NVarChar(100), mimeByExtension[extension])
      .input('sizeBytes', sql.Int, file.length)
      .query(`DECLARE @newId BIGINT;
        INSERT INTO dbo.candidate_cvs(candidate_id, title, original_name, stored_name, file_url, mime_type, size_bytes)
        VALUES(@candidateId, @title, @originalName, @storedName, @fileUrl, @mimeType, @sizeBytes);
        SET @newId = CONVERT(BIGINT, SCOPE_IDENTITY());
        SELECT @newId AS id;`);
    res.status(201).json({ id: Number(result.recordset[0].id), title, originalName, mimeType: mimeByExtension[extension], sizeBytes: file.length, isDefault: false, downloadUrl: `/api/candidate-content/cvs/${result.recordset[0].id}/file` });
  } catch (error) {
    await fs.unlink(fullPath).catch(() => {});
    throw error;
  }
}));

router.patch('/cvs/:id/default', requireRole('candidate'), asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Mã CV không hợp lệ' });
  const transaction = new sql.Transaction(getPool());
  await transaction.begin();
  try {
    const found = await new sql.Request(transaction).input('id', sql.BigInt, req.params.id)
      .input('candidateId', sql.BigInt, req.user.id)
      .query('SELECT id FROM dbo.candidate_cvs WITH (UPDLOCK, ROWLOCK) WHERE id = @id AND candidate_id = @candidateId');
    if (!found.recordset.length) { await transaction.rollback(); return res.status(404).json({ error: 'Không tìm thấy CV' }); }
    await new sql.Request(transaction).input('candidateId', sql.BigInt, req.user.id)
      .query('UPDATE dbo.candidate_cvs SET is_default = 0, updated_at = SYSUTCDATETIME() WHERE candidate_id = @candidateId AND is_default = 1');
    await new sql.Request(transaction).input('id', sql.BigInt, req.params.id)
      .query('UPDATE dbo.candidate_cvs SET is_default = 1, updated_at = SYSUTCDATETIME() WHERE id = @id');
    await transaction.commit();
    res.json({ ok: true });
  } catch (error) { await transaction.rollback().catch(() => {}); throw error; }
}));

router.delete('/cvs/:id', requireRole('candidate'), asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Mã CV không hợp lệ' });
  const pool = getPool();
  const check = await pool.request().input('id', sql.BigInt, req.params.id).input('candidateId', sql.BigInt, req.user.id).query(`
    SELECT cv.stored_name AS storedName, CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.applications WHERE cv_id = cv.id) THEN 1 ELSE 0 END AS bit) AS inUse
    FROM dbo.candidate_cvs cv WHERE cv.id = @id AND cv.candidate_id = @candidateId`);
  if (!check.recordset.length) return res.status(404).json({ error: 'Không tìm thấy CV' });
  if (check.recordset[0].inUse) return res.status(409).json({ error: 'CV đang được đính kèm hồ sơ ứng tuyển nên không thể xóa' });
  await pool.request().input('id', sql.BigInt, req.params.id).input('candidateId', sql.BigInt, req.user.id)
    .query('DELETE dbo.candidate_cvs WHERE id = @id AND candidate_id = @candidateId');
  await fs.unlink(path.join(cvDirectory, check.recordset[0].storedName)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  res.json({ ok: true });
}));

router.get('/cvs/:id/file', asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Mã CV không hợp lệ' });
  const row = (await getPool().request().input('id', sql.BigInt, req.params.id)
    .query(`${cvSelect} WHERE id = @id`)).recordset[0];
  if (!row) return res.status(404).json({ error: 'Không tìm thấy CV' });
  if (Number(row.sizeBytes) <= 0 || String(row.storedName || '').startsWith('legacy-missing-')) {
    return res.status(404).json({ error: 'Bản ghi CV cũ không có tệp để tải xuống. Hãy tải lại CV.' });
  }
  let allowed = req.user.role === 'admin' || (req.user.role === 'candidate' && Number(row.candidateId) === req.user.id);
  if (req.user.role === 'employer') {
    const access = await getPool().request().input('cvId', sql.BigInt, req.params.id).input('candidateId', sql.BigInt, row.candidateId).input('recruiterId', sql.BigInt, req.user.id)
      .query(`SELECT 1 AS allowed FROM dbo.applications a INNER JOIN dbo.jobs j ON j.id = a.job_id WHERE a.cv_id = @cvId AND a.candidate_id = @candidateId AND a.status <> N'withdrawn' AND j.recruiter_id = @recruiterId`);
    allowed = access.recordset.length > 0;
  }
  if (!allowed) return res.status(404).json({ error: 'Không tìm thấy CV trong phạm vi được phép' });
  const storedName = (await getPool().request().input('id', sql.BigInt, req.params.id).query('SELECT stored_name AS storedName FROM dbo.candidate_cvs WHERE id = @id')).recordset[0]?.storedName;
  return res.download(path.join(cvDirectory, storedName), path.basename(row.originalName));
}));

router.get('/cover-letters', requireRole('candidate'), asyncHandler(async (req, res) => {
  const result = await getPool().request().input('candidateId', sql.BigInt, req.user.id).query(`
    SELECT id, title, content, created_at AS createdAt, updated_at AS updatedAt
    FROM dbo.cover_letters WHERE candidate_id = @candidateId ORDER BY updated_at DESC, id DESC`);
  res.json(result.recordset.map((row) => ({ ...row, id: Number(row.id) })));
}));

router.post('/cover-letters', requireRole('candidate'), asyncHandler(async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!title || title.length > 150) return res.status(400).json({ error: 'Tiêu đề bắt buộc, tối đa 150 ký tự' });
  if (!content || content.length > 10000) return res.status(400).json({ error: 'Nội dung bắt buộc, tối đa 10.000 ký tự' });
  const result = await getPool().request().input('candidateId', sql.BigInt, req.user.id).input('title', sql.NVarChar(150), title).input('content', sql.NVarChar(sql.MAX), content).query(`
    INSERT INTO dbo.cover_letters(candidate_id, title, content) VALUES(@candidateId, @title, @content);
    SELECT CONVERT(BIGINT, SCOPE_IDENTITY()) AS id`);
  res.status(201).json({ id: Number(result.recordset[0].id), title, content });
}));

router.put('/cover-letters/:id', requireRole('candidate'), asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Mã cover letter không hợp lệ' });
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!title || title.length > 150 || !content || content.length > 10000) return res.status(400).json({ error: 'Tiêu đề và nội dung hợp lệ là bắt buộc (nội dung tối đa 10.000 ký tự)' });
  const result = await getPool().request().input('id', sql.BigInt, req.params.id).input('candidateId', sql.BigInt, req.user.id).input('title', sql.NVarChar(150), title).input('content', sql.NVarChar(sql.MAX), content).query(`
    UPDATE dbo.cover_letters SET title = @title, content = @content, updated_at = SYSUTCDATETIME()
    WHERE id = @id AND candidate_id = @candidateId;
    SELECT @@ROWCOUNT AS affected`);
  if (!result.recordset[0]?.affected) return res.status(404).json({ error: 'Không tìm thấy cover letter' });
  res.json({ id: Number(req.params.id), title, content });
}));

router.delete('/cover-letters/:id', requireRole('candidate'), asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Mã cover letter không hợp lệ' });
  const result = await getPool().request().input('id', sql.BigInt, req.params.id).input('candidateId', sql.BigInt, req.user.id)
    .query('DELETE dbo.cover_letters WHERE id = @id AND candidate_id = @candidateId; SELECT @@ROWCOUNT AS affected');
  if (!result.recordset[0]?.affected) return res.status(404).json({ error: 'Không tìm thấy cover letter' });
  res.json({ ok: true });
}));

module.exports = router;
