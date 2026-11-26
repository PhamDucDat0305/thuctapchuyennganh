const repository = require('../repositories/interviews.repository');

function fail(message, status) { const error = new Error(message); error.status = status; throw error; }
function validId(value) { return typeof value === 'string' && /^[1-9]\d*$/.test(value); }
function requireId(value, label) { if (!validId(String(value))) fail(`Mã ${label} không hợp lệ`, 400); }
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
async function list(user) { return repository.list(user); }
async function findForApplication(applicationId, user) {
  requireId(applicationId, 'đơn ứng tuyển');
  return repository.findForApplication(applicationId, user);
}
async function schedule(input) {
  requireId(input.applicationId, 'đơn ứng tuyển');
  if (!validDate(input.date)) fail('Ngày phỏng vấn không hợp lệ', 400);
  if (typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) fail('Giờ phỏng vấn không hợp lệ', 400);
  if (!['online', 'offline'].includes(input.type)) fail('Hình thức phỏng vấn không hợp lệ', 400);
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (notes.length > 2000) fail('Ghi chú tối đa 2.000 ký tự', 400);
  const result = await repository.schedule({ ...input, notes });
  if (!result) fail('Không tìm thấy đơn ứng tuyển trong tin của bạn', 404);
  return result;
}
async function decide(input) {
  requireId(input.id, 'lịch phỏng vấn');
  if (!['accepted', 'rejected'].includes(input.decision)) fail('Kết quả phỏng vấn không hợp lệ', 400);
  const result = await repository.decide(input);
  if (result.error === 'not_found') fail('Không tìm thấy lịch phỏng vấn trong tin của bạn', 404);
  if (result.error) fail('Lịch phỏng vấn này đã được xử lý', 409);
  return result;
}
async function updateStatus(input) {
  requireId(input.id, 'lịch phỏng vấn');
  const allowed = input.user.role === 'candidate' ? ['confirmed', 'declined'] : ['canceled', 'no_show'];
  if (!allowed.includes(input.status)) fail('Trạng thái lịch phỏng vấn không hợp lệ', 400);
  const result = await repository.updateStatus(input);
  if (result.error === 'not_found') fail('Không tìm thấy lịch phỏng vấn trong phạm vi của bạn', 404);
  if (result.error) fail('Không thể chuyển lịch từ trạng thái hiện tại', 409);
  return result;
}
module.exports = { list, findForApplication, schedule, decide, updateStatus };
