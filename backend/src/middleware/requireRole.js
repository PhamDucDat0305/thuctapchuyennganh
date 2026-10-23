// Dùng SAU authenticate: requireRole('employer') hoặc requireRole('candidate', 'admin').
module.exports = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này' });
  }
  next();
};
