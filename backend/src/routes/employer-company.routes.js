const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('employer'));

const companySelect = `
  SELECT id, employer_id AS employerId, name, logo, industry, [size] AS size,
    location, website, description
  FROM dbo.companies`;

const fields = {
  name: { max: 200, required: true }, logo: { max: 500 },
  industry: { max: 100 }, size: { max: 50 }, location: { max: 200 },
  website: { max: 500 }, description: { max: 8000 },
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

router.post('/', asyncHandler(async (req, res) => {
  const { values, errors } = validate(req.body || {}, false);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  const request = getPool().request().input('employerId', sql.BigInt, req.user.id);
  bindFields(request, values);
  const result = await request.query(`
    IF EXISTS (SELECT 1 FROM dbo.companies WHERE employer_id = @employerId)
    BEGIN
      UPDATE dbo.companies SET name = @name, logo = @logo, industry = @industry,
        [size] = @size, location = @location, website = @website, description = @description
      WHERE employer_id = @employerId;
    END
    ELSE
    BEGIN
      INSERT INTO dbo.companies (employer_id, name, logo, industry, [size], location, website, description)
      VALUES (@employerId, @name, @logo, @industry, @size, @location, @website, @description);
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
    UPDATE dbo.companies SET ${keys.map((key) => `[${key}] = @${key}`).join(', ')}
    WHERE employer_id = @employerId;
    SELECT @@ROWCOUNT AS affected;`);
  if (!updated.recordset[0]?.affected) return res.status(404).json({ error: 'Chưa tạo hồ sơ công ty' });
  const result = await getPool().request().input('employerId', sql.BigInt, req.user.id)
    .query(`${companySelect} WHERE employer_id = @employerId`);
  return res.json(result.recordset[0]);
}));

module.exports = router;
