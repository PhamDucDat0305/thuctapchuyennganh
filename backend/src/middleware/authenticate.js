const asyncHandler = require('../utils/asyncHandler');
const { destroySession } = require('../utils/sessionHelpers');
const { User } = require('../models');

// Chặn request chưa đăng nhập. Danh tính lấy từ session đã xác minh ở server,
// và được đối chiếu lại với database để tài khoản bị khóa mất hiệu lực ngay.
module.exports = asyncHandler(async (req, res, next) => {
  const userId = req.session && req.session.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  const row = await User.findByPk(userId, {
    attributes: ['id', 'email', 'fullName', 'role', 'status', 'phone', 'searchStatus', 'adminLocked'],
  });
  if (!row || row.status !== 'active' || row.adminLocked) {
    await destroySession(req);
    return res.status(401).json({ error: 'Phiên đăng nhập không còn hiệu lực' });
  }

  req.user = {
    id: Number(row.id),
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    phone: row.phone || '',
    searchStatus: Boolean(row.searchStatus),
  };
  next();
});
