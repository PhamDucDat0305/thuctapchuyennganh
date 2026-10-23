const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer', 'admin'));

function validId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const interviewSelect = `
  SELECT i.id, i.application_id AS applicationId,
    CONVERT(char(10), i.interview_date, 23) AS date,
    CONVERT(char(5), i.interview_time, 108) AS time,
    i.interview_type AS type, i.notes,
    i.created_at AS createdAt, i.updated_at AS updatedAt,
    a.candidate_id AS candidateId, j.recruiter_id AS createdBy,
    j.title AS jobTitle, c.name AS companyName
  FROM dbo.interviews AS i
  INNER JOIN dbo.applications AS a ON a.id = i.application_id
  INNER JOIN dbo.jobs AS j ON j.id = a.job_id
  INNER JOIN dbo.companies AS c ON c.id = j.company_id`;

function applyAccess(request, user) {
  if (user.role === 'candidate') {
    request.input('candidateId', sql.BigInt, user.id);
    return ' AND a.candidate_id = @candidateId';
  }
  if (user.role === 'employer') {
    request.input('recruiterId', sql.BigInt, user.id);
    return ' AND j.recruiter_id = @recruiterId';
  }
  return '';
}

router.get('/', asyncHandler(async (req, res) => {
  const request = getPool().request();
  const access = applyAccess(request, req.user);
  const result = await request.query(`${interviewSelect} WHERE 1 = 1${access} ORDER BY i.interview_date, i.interview_time`);
  return res.json(result.recordset);
}));

router.get('/application/:applicationId', asyncHandler(async (req, res) => {
  if (!validId(req.params.applicationId)) return res.status(400).json({ error: 'Mã đơn ứng tuyển không hợp lệ' });
  const request = getPool().request().input('applicationId', sql.BigInt, req.params.applicationId);
  const access = applyAccess(request, req.user);
  const result = await request.query(`${interviewSelect} WHERE i.application_id = @applicationId${access}`);
  return res.json(result.recordset[0] || null);
}));

router.post('/', requireRole('employer'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const applicationId = String(body.applicationId || '');
  const date = body.date;
  const time = body.time;
  const type = body.type;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  if (!validId(applicationId)) return res.status(400).json({ error: 'Mã đơn ứng tuyển không hợp lệ' });
  if (!validDate(date)) return res.status(400).json({ error: 'Ngày phỏng vấn không hợp lệ' });
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return res.status(400).json({ error: 'Giờ phỏng vấn không hợp lệ' });
  if (!['online', 'offline'].includes(type)) return res.status(400).json({ error: 'Hình thức phỏng vấn không hợp lệ' });
  if (notes.length > 2000) return res.status(400).json({ error: 'Ghi chú tối đa 2.000 ký tự' });

  const pool = getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const request = new sql.Request(transaction)
      .input('applicationId', sql.BigInt, applicationId)
      .input('recruiterId', sql.BigInt, req.user.id)
      .input('date', sql.Date, date)
      // tedious expects a JavaScript Date for sql.Time. Bind the validated
      // HH:mm text and let SQL Server convert it explicitly instead.
      .input('time', sql.NVarChar(5), time)
      .input('type', sql.NVarChar(20), type)
      .input('notes', sql.NVarChar(2000), notes || null);

    const owned = await request.query(`
      SELECT a.id
      FROM dbo.applications AS a
      INNER JOIN dbo.jobs AS j ON j.id = a.job_id
      WHERE a.id = @applicationId AND j.recruiter_id = @recruiterId
        AND a.status IN (N'applied', N'interview_scheduled')`);
    if (!owned.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Không tìm thấy đơn ứng tuyển trong tin của bạn' });
    }

    await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.interviews WITH (UPDLOCK, HOLDLOCK) WHERE application_id = @applicationId)
        UPDATE dbo.interviews
        SET interview_date = @date, interview_time = CONVERT(time(0), @time, 108),
            scheduled_at = DATEADD(MINUTE,
              DATEDIFF(MINUTE, CONVERT(time(0), '00:00'), CONVERT(time(0), @time, 108)),
              CONVERT(datetime2(0), @date)),
            interview_type = @type, notes = @notes, updated_at = SYSUTCDATETIME()
        WHERE application_id = @applicationId;
      ELSE
        INSERT INTO dbo.interviews
          (application_id, interview_date, interview_time, scheduled_at, interview_type, notes)
        VALUES (@applicationId, @date, CONVERT(time(0), @time, 108),
          DATEADD(MINUTE,
            DATEDIFF(MINUTE, CONVERT(time(0), '00:00'), CONVERT(time(0), @time, 108)),
            CONVERT(datetime2(0), @date)),
          @type, @notes);

      UPDATE dbo.applications
      SET status = N'interview_scheduled', updated_at = SYSUTCDATETIME()
      WHERE id = @applicationId;`);
    await transaction.commit();

    const result = await pool.request()
      .input('applicationId', sql.BigInt, applicationId)
      .input('recruiterId', sql.BigInt, req.user.id)
      .query(`${interviewSelect} WHERE i.application_id = @applicationId AND j.recruiter_id = @recruiterId`);
    return res.status(201).json(result.recordset[0]);
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}));

module.exports = router;
