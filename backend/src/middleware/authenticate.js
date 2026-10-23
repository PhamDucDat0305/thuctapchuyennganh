const { sql, getPool } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const { destroySession } = require('../utils/sessionHelpers');

// Chặn request chưa đăng nhập. Danh tính lấy từ session đã xác minh ở server,
// và được đối chiếu lại với database để tài khoản bị khóa mất hiệu lực ngay.
module.exports = asyncHandler(async (req, res, next) => {
  const userId = req.session && req.session.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  const result = await getPool()
    .request()
    .input('id', sql.BigInt, userId)
    .query('SELECT id, email, full_name, role, status, phone, search_status FROM dbo.users WHERE id = @id');

  const row = result.recordset[0];
  if (!row || row.status !== 'active') {
    await destroySession(req);
    return res.status(401).json({ error: 'Phiên đăng nhập không còn hiệu lực' });
  }

  req.user = {
    id: Number(row.id),
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone || '',
    searchStatus: Boolean(row.search_status),
  };
  next();
});
