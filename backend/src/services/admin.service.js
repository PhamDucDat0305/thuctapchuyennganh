const repository = require('../repositories/admin.repository');
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function id(value, label) { if (!/^[1-9]\d*$/.test(String(value))) fail(`Mã ${label} không hợp lệ`); return String(value); }
function reason(value) { const result = typeof value === 'string' ? value.trim() : ''; if (!result || result.length > 500) fail('Lý do bắt buộc, tối đa 500 ký tự'); return result; }
function page(query) { const current = Math.max(1, Math.min(100000, Number.parseInt(query.page, 10) || 1)); const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit, 10) || 25)); return { page: current, limit }; }
function common(req) { return { user: req.user, ip: req.ip, ...page(req.query), q: typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '' }; }
async function overview(req) { return repository.overview(req.user, req.ip); }
async function users(req) { const params = common(req); params.role = ['candidate', 'employer', 'admin'].includes(req.query.role) ? req.query.role : ''; return repository.listUsers(params); }
async function jobs(req) { return repository.listJobs(common(req)); }
async function companies(req) { return repository.listCompanies(common(req)); }
async function auditLogs(req) { return repository.listAuditLogs(common(req)); }
async function reports(req) { const status = ['new', 'reviewing', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : null; return repository.listReports(req.user, req.ip, status); }
async function lockUser(req) {
  const targetId = id(req.params.id, 'tài khoản'); if (targetId === String(req.user.id)) fail('Không thể tự khóa tài khoản Admin đang đăng nhập');
  if (typeof req.body?.locked !== 'boolean') fail('locked phải là true hoặc false');
  const result = await repository.lockUser({ id: targetId, locked: req.body.locked, adminId: req.user.id, ip: req.ip, reason: reason(req.body.reason) });
  if (result === 'missing') fail('Không tìm thấy tài khoản', 404); if (result === 'admin') fail('Không thể khóa tài khoản Admin');
  return { ok: true, locked: req.body.locked };
}
async function visibility(req) {
  const targetId = id(req.params.id, 'tin'); const why = reason(req.body?.reason); const value = req.body?.visibility;
  if (!['visible', 'hidden'].includes(value)) fail('visibility không hợp lệ');
  const result = await repository.updateJobVisibility({ id: targetId, visibility: value, adminId: req.user.id, ip: req.ip, reason: why });
  if (result === 'missing') fail('Không tìm thấy tin tuyển dụng', 404); return { ok: true, visibility: value };
}
async function companyStatus(req) {
  const targetId = id(req.params.id, 'công ty'); const why = reason(req.body?.reason); const value = req.body?.status;
  if (!['active', 'suspended'].includes(value)) fail('status không hợp lệ');
  const result = await repository.updateCompanyStatus({ id: targetId, status: value, adminId: req.user.id, ip: req.ip, reason: why });
  if (result === 'missing') fail('Không tìm thấy công ty', 404); return { ok: true, status: value };
}
async function updateReport(req) {
  const targetId = id(req.params.id, 'phản ánh'); const status = req.body?.status;
  if (!['reviewing', 'resolved', 'dismissed'].includes(status)) fail('Trạng thái xử lý không hợp lệ');
  const note = typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim() : ''; if (note.length > 1000) fail('Ghi chú tối đa 1.000 ký tự');
  if (!await repository.updateReport({ id: targetId, status, note, adminId: req.user.id, ip: req.ip })) fail('Không tìm thấy phản ánh', 404);
  return { ok: true, status };
}
module.exports = { overview, users, jobs, companies, auditLogs, reports, lockUser, visibility, companyStatus, updateReport };
