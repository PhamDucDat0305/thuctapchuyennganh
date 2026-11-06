const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('employer'));

const jobSelect = `
  SELECT j.id, j.title, j.description, j.requirements, j.benefits,
    j.category, j.location, j.salary_display AS salary,
    j.salary_min AS salaryMin, j.salary_max AS salaryMax,
    j.job_type AS type, j.experience, j.status, j.views,
    j.created_at AS createdAt, j.expires_at AS expiresAt,
    j.recruiter_id AS createdBy, j.recruiter_id AS recruiterId,
    c.id AS companyId, c.name AS companyName
  FROM dbo.jobs AS j
  INNER JOIN dbo.companies AS c ON c.id = j.company_id`;

const fields = {
  title: { column: 'title', max: 200, required: true },
  description: { column: 'description', max: 8000, required: true },
  requirements: { column: 'requirements', max: 8000, required: true },
  benefits: { column: 'benefits', max: 8000 },
  category: { column: 'category', max: 100, required: true },
  location: { column: 'location', max: 200, required: true },
  salary: { column: 'salary_display', max: 100 },
  type: { column: 'job_type', max: 30, required: true },
  experience: { column: 'experience', max: 100, required: true },
  expiresAt: { column: 'expires_at' },
};

function validateJob(body, { partial = false } = {}) {
  const values = {};
  const errors = [];
  for (const [key, rule] of Object.entries(fields)) {
    if (key === 'expiresAt') continue;
    if (partial && !Object.hasOwn(body, key)) continue;
    const value = typeof body[key] === 'string' ? body[key].trim() : '';
    if (rule.required && !value) {
      errors.push(`${key} là bắt buộc`);
    } else if (value.length > rule.max) {
      errors.push(`${key} không được vượt quá ${rule.max} ký tự`);
    }
    values[key] = value || null;
  }
  if (Object.hasOwn(body, 'type') && !['full-time', 'part-time'].includes(values.type)) {
    errors.push('type phải là full-time hoặc part-time');
  }
  const hasSalaryMin = Object.hasOwn(body, 'salaryMin');
  const hasSalaryMax = Object.hasOwn(body, 'salaryMax');
  if (!partial || hasSalaryMin || hasSalaryMax) {
    if (!hasSalaryMin || !hasSalaryMax || body.salaryMin === '' || body.salaryMax === ''
      || body.salaryMin == null || body.salaryMax == null) {
      errors.push('salaryMin và salaryMax là bắt buộc và phải được nhập cùng nhau');
    } else {
      const salaryMin = Number(body.salaryMin);
      const salaryMax = Number(body.salaryMax);
      if (!Number.isSafeInteger(salaryMin) || !Number.isSafeInteger(salaryMax)
        || salaryMin <= 0 || salaryMax <= 0 || salaryMin > salaryMax) {
        errors.push('Khoảng lương không hợp lệ; lương tối thiểu phải nhỏ hơn hoặc bằng lương tối đa');
      } else {
        values.salaryMin = salaryMin;
        values.salaryMax = salaryMax;
        values.salary = `${(salaryMin / 1000000).toLocaleString('vi-VN')} - ${(salaryMax / 1000000).toLocaleString('vi-VN')} triệu VND/tháng`;
      }
    }
  }
  if (!partial || Object.hasOwn(body, 'expiresAt')) {
    const rawExpiresAt = body.expiresAt;
    if (rawExpiresAt == null || rawExpiresAt === '') {
      values.expiresAt = null;
      if (!partial) errors.push('Hạn ứng tuyển là bắt buộc');
    } else if (typeof rawExpiresAt !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(rawExpiresAt)
      || Number.isNaN(Date.parse(rawExpiresAt))
      || new Date(rawExpiresAt).toISOString() !== rawExpiresAt) {
      errors.push('Hạn ứng tuyển không hợp lệ');
    } else {
      const expiresAt = new Date(rawExpiresAt);
      if (!partial && expiresAt.getTime() <= Date.now()) errors.push('Hạn ứng tuyển phải ở tương lai');
      values.expiresAt = expiresAt;
    }
  }
  return { values, errors };
}

function bindJob(request, values) {
  for (const [key, rule] of Object.entries(fields)) {
    if (Object.hasOwn(values, key)) {
      if (key === 'expiresAt') {
        request.input(key, sql.DateTime2(0), values[key]);
        continue;
      }
      request.input(key, sql.NVarChar(rule.max > 4000 ? sql.MAX : rule.max), values[key]);
    }
  }
  if (Object.hasOwn(values, 'salaryMin')) request.input('salaryMin', sql.Decimal(18, 0), values.salaryMin);
  if (Object.hasOwn(values, 'salaryMax')) request.input('salaryMax', sql.Decimal(18, 0), values.salaryMax);
}

router.get('/', asyncHandler(async (req, res) => {
  const result = await getPool().request()
    .input('recruiterId', sql.BigInt, req.user.id)
    .query(`${jobSelect} WHERE j.recruiter_id = @recruiterId ORDER BY j.created_at DESC, j.id DESC`);
  res.json(result.recordset);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  const result = await getPool().request()
    .input('id', sql.BigInt, req.params.id)
    .input('recruiterId', sql.BigInt, req.user.id)
    .query(`${jobSelect} WHERE j.id = @id AND j.recruiter_id = @recruiterId`);
  if (!result.recordset.length) return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });
  return res.json(result.recordset[0]);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { values, errors } = validateJob(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const pool = getPool();
  const companyResult = await pool.request()
    .input('employerId', sql.BigInt, req.user.id)
    .query('SELECT id, name FROM dbo.companies WHERE employer_id = @employerId');
  const company = companyResult.recordset[0];
  if (!company) return res.status(409).json({ error: 'Tài khoản chưa có thông tin công ty' });

  const request = pool.request()
    .input('companyId', sql.BigInt, company.id)
    .input('recruiterId', sql.BigInt, req.user.id)
    .input('currency', sql.NVarChar(3), 'VND');
  bindJob(request, values);
  const result = await request.query(`
    DECLARE @insertedJob TABLE (id BIGINT NOT NULL);
    INSERT INTO dbo.jobs
      (company_id, recruiter_id, title, description, requirements, benefits,
       category, location, salary_display, salary_min, salary_max, currency, job_type, experience, expires_at, status, views)
    OUTPUT INSERTED.id INTO @insertedJob(id)
    VALUES
      (@companyId, @recruiterId, @title, @description, @requirements, @benefits,
       @category, @location, @salary, @salaryMin, @salaryMax, @currency, @type, @experience, @expiresAt, N'active', 0);
    SELECT id FROM @insertedJob;`);

  const id = result.recordset[0].id;
  const created = await pool.request()
    .input('id', sql.BigInt, id)
    .input('recruiterId', sql.BigInt, req.user.id)
    .query(`${jobSelect} WHERE j.id = @id AND j.recruiter_id = @recruiterId`);
  return res.status(201).json(created.recordset[0]);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  const body = req.body || {};
  const { values, errors } = validateJob(body, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  const keys = Object.keys(values);
  if (!keys.length) return res.status(400).json({ error: 'Không có trường hợp lệ để cập nhật' });

  const request = getPool().request()
    .input('id', sql.BigInt, req.params.id)
    .input('recruiterId', sql.BigInt, req.user.id);
  bindJob(request, values);
  const assignments = keys.map((key) => {
    if (key === 'salaryMin') return 'salary_min = @salaryMin';
    if (key === 'salaryMax') return 'salary_max = @salaryMax';
    return `${fields[key].column} = @${key}`;
  });
  const result = await request.query(`
    UPDATE dbo.jobs SET ${assignments.join(', ')}, updated_at = SYSUTCDATETIME()
    WHERE id = @id AND recruiter_id = @recruiterId;
    SELECT @@ROWCOUNT AS affected;`);
  if (!result.recordset[0]?.affected) return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });

  const updated = await getPool().request()
    .input('id', sql.BigInt, req.params.id)
    .input('recruiterId', sql.BigInt, req.user.id)
    .query(`${jobSelect} WHERE j.id = @id AND j.recruiter_id = @recruiterId`);
  return res.json(updated.recordset[0]);
}));

router.patch('/:id/close', asyncHandler(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Mã công việc không hợp lệ' });
  const result = await getPool().request()
    .input('id', sql.BigInt, req.params.id)
    .input('recruiterId', sql.BigInt, req.user.id)
    .query(`
      UPDATE dbo.jobs SET status = N'closed', updated_at = SYSUTCDATETIME()
      WHERE id = @id AND recruiter_id = @recruiterId AND status <> N'closed';
      SELECT @@ROWCOUNT AS affected;`);
  if (!result.recordset[0]?.affected) return res.status(404).json({ error: 'Không tìm thấy tin đang mở của bạn' });
  return res.json({ ok: true });
}));

module.exports = router;
