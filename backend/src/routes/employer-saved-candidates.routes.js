const express = require('express');
const { sql, getPool } = require('../config/database');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('employer'));

function validId(value) { return /^[1-9]\d*$/.test(String(value || '')); }

router.get('/', asyncHandler(async (req, res) => {
  const result = await getPool().request()
    .input('employerId', sql.BigInt, req.user.id)
    .query(`SELECT s.candidate_id AS id, u.full_name AS fullName, u.email,
      p.title, p.location, p.experience, p.skills, s.saved_at AS savedAt
      FROM dbo.employer_saved_candidates s
      INNER JOIN dbo.users u ON u.id = s.candidate_id
      LEFT JOIN dbo.candidate_profiles p ON p.user_id = u.id
      WHERE s.employer_id = @employerId AND u.role = N'candidate' AND u.status = N'active' AND u.search_status = 1
      ORDER BY s.saved_at DESC, s.candidate_id DESC`);
  res.json(result.recordset.map((row) => ({ ...row, id: Number(row.id) })));
}));

router.post('/:candidateId', asyncHandler(async (req, res) => {
  if (!validId(req.params.candidateId)) return res.status(400).json({ error: 'Mã ứng viên không hợp lệ' });
  const pool = getPool();
  const candidate = await pool.request().input('id', sql.BigInt, req.params.candidateId)
    .query(`SELECT id FROM dbo.users WHERE id = @id AND role = N'candidate' AND status = N'active' AND search_status = 1`);
  if (!candidate.recordset.length) return res.status(404).json({ error: 'Không tìm thấy ứng viên đang hoạt động' });
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = new sql.Request(transaction)
      .input('employerId', sql.BigInt, req.user.id)
      .input('candidateId', sql.BigInt, req.params.candidateId);
    const existing = await request.query(`SELECT 1 AS found FROM dbo.employer_saved_candidates WITH (UPDLOCK, HOLDLOCK)
      WHERE employer_id = @employerId AND candidate_id = @candidateId`);
    if (existing.recordset.length) {
      await transaction.commit();
      return res.json({ saved: true });
    }
    await new sql.Request(transaction).input('employerId', sql.BigInt, req.user.id)
      .input('candidateId', sql.BigInt, req.params.candidateId)
      .query('INSERT INTO dbo.employer_saved_candidates(employer_id, candidate_id) VALUES(@employerId, @candidateId)');
    await transaction.commit();
    return res.status(201).json({ saved: true });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}));

router.delete('/:candidateId', asyncHandler(async (req, res) => {
  if (!validId(req.params.candidateId)) return res.status(400).json({ error: 'Mã ứng viên không hợp lệ' });
  await getPool().request()
    .input('employerId', sql.BigInt, req.user.id)
    .input('candidateId', sql.BigInt, req.params.candidateId)
    .query('DELETE dbo.employer_saved_candidates WHERE employer_id = @employerId AND candidate_id = @candidateId');
  res.json({ saved: false });
}));

module.exports = router;
