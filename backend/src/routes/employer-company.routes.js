const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('employer'));

const companySelect = `
  SELECT id, employer_id AS employerId, name, logo_url AS logoUrl, logo, industry, [size] AS size,
    location, website, description, created_at AS createdAt, updated_at AS updatedAt
  FROM dbo.companies`;

const fields = {
  name: { column: 'name', max: 200, required: true },
  logo: { column: 'logo', max: 500 }, logoUrl: { column: 'logo_url', max: 500 },
  industry: { column: 'industry', max: 100 }, size: { column: 'size', max: 50 }, location: { column: 'location', max: 200 },
  website: { column: 'website', max: 500 }, description: { column: 'description', max: 8000 },
};

function validate(body, partial) {
  const values = {};
  const errors = [];
  for (const [key, rule] of Object.entries(fields)) {
    if (partial && !Object.hasOwn(body, key)) continue;
    const value = typeof body[key] === 'string' ? body[key].trim() : '';
    if (rule.required && !value) errors.push(`${key} là bắt buộc`);
    else if (value.length > rule.max) errors.push(`${key} không được vượt quá ${rule.max} ký tự`);
    values[key] = value || null;
  }
  if (values.website && !/^https?:\/\//i.test(values.website)) errors.push('website phải bắt đầu bằng http:// hoặc https://');
  return { values, errors };
}

function bindFields(request, values) {
  for (const [key, value] of Object.entries(values)) {
    const max = fields[key].max;
    request.input(key, sql.NVarChar(max > 4000 ? sql.MAX : max), value);
  }
}

router.get('/', asyncHandler(async (req, res) => {
  const result = await getPool().request().input('employerId', sql.BigInt, req.user.id)
    .query(`${companySelect} WHERE employer_id = @employerId`);
  return res.json(result.recordset[0] || null);
}));

router.post('/logo', express.raw({
  type: ['image/png', 'image/jpeg', 'image/webp'],
  limit: '2mb',
}), asyncHandler(async (req, res) => {
  const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
  const image = Buffer.isBuffer(req.body) ? req.body : null;
  if (!image?.length || image.length > 2 * 1024 * 1024) {
    return res.status(400).json({ error: 'Ảnh logo trống hoặc vượt quá 2MB' });
  }

  const formats = {
    'image/png': { extension: 'png', matches: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    'image/jpeg': { extension: 'jpg', matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
    'image/webp': { extension: 'webp', matches: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
  };
  const format = formats[contentType];
  if (!format || !format.matches(image)) {
    return res.status(415).json({ error: 'Chỉ nhận ảnh PNG, JPG hoặc WEBP hợp lệ' });
  }

  const filename = `company-${req.user.id}-${crypto.randomUUID()}.${format.extension}`;
  const uploadDirectory = path.resolve(__dirname, '..', '..', '..', 'employer', 'uploads', 'companies');
  await fs.mkdir(uploadDirectory, { recursive: true });
  await fs.writeFile(path.join(uploadDirectory, filename), image, { flag: 'wx', mode: 0o644 });
  return res.status(201).json({ logo: `/employer/uploads/companies/${filename}` });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { values, errors } = validate(req.body || {}, false);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  const request = getPool().request().input('employerId', sql.BigInt, req.user.id);
  bindFields(request, values);
  const result = await request.query(`
    IF EXISTS (SELECT 1 FROM dbo.companies WHERE employer_id = @employerId)
    BEGIN
      UPDATE dbo.companies SET name = @name, logo = @logo, logo_url = @logoUrl, industry = @industry,
        [size] = @size, location = @location, website = @website, description = @description,
        updated_at = SYSUTCDATETIME()
      WHERE employer_id = @employerId;
    END
    ELSE
    BEGIN
      INSERT INTO dbo.companies (employer_id, name, logo, logo_url, industry, [size], location, website, description)
      VALUES (@employerId, @name, @logo, @logoUrl, @industry, @size, @location, @website, @description);
    END;
    ${companySelect} WHERE employer_id = @employerId;`);
  return res.status(201).json(result.recordset[0]);
}));

router.put('/', asyncHandler(async (req, res) => {
  const { values, errors } = validate(req.body || {}, true);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  const keys = Object.keys(values);
  if (!keys.length) return res.status(400).json({ error: 'Không có trường hợp lệ để cập nhật' });
  const request = getPool().request().input('employerId', sql.BigInt, req.user.id);
  bindFields(request, values);
  const updated = await request.query(`
    UPDATE dbo.companies SET ${keys.map((key) => `[${fields[key].column}] = @${key}`).join(', ')}, updated_at = SYSUTCDATETIME()
    WHERE employer_id = @employerId;
    SELECT @@ROWCOUNT AS affected;`);
  if (!updated.recordset[0]?.affected) return res.status(404).json({ error: 'Chưa tạo hồ sơ công ty' });
  const result = await getPool().request().input('employerId', sql.BigInt, req.user.id)
    .query(`${companySelect} WHERE employer_id = @employerId`);
  return res.json(result.recordset[0]);
}));

module.exports = router;
