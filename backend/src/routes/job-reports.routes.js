const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();
router.use(authenticate, requireRole('candidate'));
const limitReports = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  key: (req) => `user:${req.user.id}`,
  message: 'Bạn đã gửi quá nhiều phản ánh. Vui lòng thử lại sau.',
});

router.post('/', limitReports, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const jobId = String(body.jobId || '');
  const fields = {
    fullName: { max: 150, label: 'họ và tên' },
    phone: { max: 30, label: 'số điện thoại' },
    address: { max: 300, label: 'địa chỉ' },
    email: { max: 255, label: 'địa chỉ email' },
    content: { max: 4000, label: 'nội dung phản ánh' },
  };
  const values = {};
  for (const [key, rule] of Object.entries(fields)) {
    values[key] = typeof body[key] === 'string' ? body[key].trim() : '';
    if (!values[key]) return res.status(400).json({ error: `Vui lòng nhập ${rule.label}` });
    if (values[key].length > rule.max) return res.status(400).json({ error: `Trường ${rule.label} vượt quá ${rule.max} ký tự` });
  }
  if (!/^[1-9]\d*$/.test(jobId)) return res.status(400).json({ error: 'Mã tin tuyển dụng không hợp lệ' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return res.status(400).json({ error: 'Địa chỉ email không hợp lệ' });

  const pool = getPool();
  const job = await pool.request().input('jobId', sql.BigInt, jobId).query(`
    SELECT j.id FROM dbo.jobs j
    INNER JOIN dbo.companies c ON c.id = j.company_id
    INNER JOIN dbo.users owner ON owner.id = j.recruiter_id
    WHERE j.id = @jobId AND j.status = N'active'
      AND (j.expires_at IS NULL OR j.expires_at > SYSUTCDATETIME())
      AND j.admin_visibility = N'visible'
      AND c.admin_status = N'active' AND owner.admin_locked = 0`);
  if (!job.recordset.length) return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng để phản ánh' });

  const result = await pool.request()
    .input('jobId', sql.BigInt, jobId)
    .input('reporterId', sql.BigInt, req.user.id)
    .input('fullName', sql.NVarChar(150), values.fullName)
    .input('phone', sql.NVarChar(30), values.phone)
    .input('address', sql.NVarChar(300), values.address)
    .input('email', sql.NVarChar(255), values.email)
    .input('content', sql.NVarChar(4000), values.content)
    .query(`
      INSERT INTO dbo.job_reports(job_id, reporter_id, full_name, phone, address, email, content)
      VALUES(@jobId, @reporterId, @fullName, @phone, @address, @email, @content);
      SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS id`);
  res.status(201).json({ ok: true, id: Number(result.recordset[0].id), message: 'Đã gửi phản ánh đến quản trị viên' });
}));

module.exports = router;
