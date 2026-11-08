const express = require('express');
const { sql, getPool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/:id', asyncHandler(async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    return res.status(400).json({ error: 'Mã công ty không hợp lệ' });
  }

  const result = await getPool().request()
    .input('id', sql.BigInt, req.params.id)
    .query(`
      SELECT id, employer_id AS employerId, name, logo_url AS logoUrl, logo, industry, [size] AS size,
        location, website, description, created_at AS createdAt, updated_at AS updatedAt
      FROM dbo.companies
      WHERE id = @id AND admin_status = N'active'`);
  if (!result.recordset.length) return res.status(404).json({ error: 'Không tìm thấy công ty' });
  return res.json(result.recordset[0]);
}));

module.exports = router;
