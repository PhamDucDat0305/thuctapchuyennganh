function notFound(req, res) {
  res.status(404).json({ error: 'Không tìm thấy đường dẫn' });
}

// Log server-side details; return a safe message to the browser.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON không hợp lệ' });
  }

  // SQL Server 208/207 indicate the database schema has not been created or
  // does not match the API migration. Give a safe, actionable message.
  if (err.number === 208 || err.number === 207) {
    return res.status(503).json({ error: 'Schema SQL Server chưa khớp API. Hãy chạy migration tương ứng trong backend/sql và kiểm tra log backend.' });
  }

  const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
  return res.status(status).json({
    error: status === 500 ? 'Lỗi máy chủ' : err.message,
  });
}

module.exports = { notFound, errorHandler };
