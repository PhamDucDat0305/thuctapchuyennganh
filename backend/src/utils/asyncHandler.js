// Bọc handler async để lỗi được chuyển tới errorHandler (an toàn cho cả Express 4 và 5).
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
