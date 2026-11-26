const repository = require('../repositories/employer-jobs.repository');

const fields = {
  title: { max: 200, required: true },
  description: { max: 8000, required: true },
  requirements: { max: 8000, required: true },
  benefits: { max: 8000 },
  category: { max: 100, required: true },
  location: { max: 200, required: true },
  salary: { max: 100 },
  type: { max: 30, required: true },
  experience: { max: 100, required: true },
};

function makeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateJob(body, { partial = false } = {}) {
  const values = {};
  const errors = [];
  for (const [key, rule] of Object.entries(fields)) {
    if (partial && !Object.hasOwn(body, key)) continue;
    const value = typeof body[key] === 'string' ? body[key].trim() : '';
    if (rule.required && !value) errors.push(`${key} là bắt buộc`);
    else if (value.length > rule.max) errors.push(`${key} không được vượt quá ${rule.max} ký tự`);
    values[key] = value || null;
  }

  if (Object.hasOwn(body, 'type') && !['full-time', 'part-time'].includes(values.type)) {
    errors.push('type phải là full-time hoặc part-time');
  }

  const hasSalaryMin = Object.hasOwn(body, 'salaryMin');
  const hasSalaryMax = Object.hasOwn(body, 'salaryMax');
  if (!partial || hasSalaryMin || hasSalaryMax) {
    if (!hasSalaryMin || !hasSalaryMax || body.salaryMin === '' || body.salaryMax === ''
      || body.salaryMin == null || body.salaryMax == null) {
      errors.push('salaryMin và salaryMax là bắt buộc và phải được nhập cùng nhau');
    } else {
      const salaryMin = Number(body.salaryMin);
      const salaryMax = Number(body.salaryMax);
      if (!Number.isSafeInteger(salaryMin) || !Number.isSafeInteger(salaryMax)
        || salaryMin <= 0 || salaryMax <= 0 || salaryMin > salaryMax) {
        errors.push('Khoảng lương không hợp lệ; lương tối thiểu phải nhỏ hơn hoặc bằng lương tối đa');
      } else {
        values.salaryMin = salaryMin;
        values.salaryMax = salaryMax;
        values.salary = `${(salaryMin / 1000000).toLocaleString('vi-VN')} - ${(salaryMax / 1000000).toLocaleString('vi-VN')} triệu VND/tháng`;
      }
    }
  }

  if (!partial || Object.hasOwn(body, 'expiresAt')) {
    const rawExpiresAt = body.expiresAt;
    if (rawExpiresAt == null || rawExpiresAt === '') {
      values.expiresAt = null;
      if (!partial) errors.push('Hạn ứng tuyển là bắt buộc');
    } else if (typeof rawExpiresAt !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(rawExpiresAt)
      || Number.isNaN(Date.parse(rawExpiresAt))
      || new Date(rawExpiresAt).toISOString() !== rawExpiresAt) {
      errors.push('Hạn ứng tuyển không hợp lệ');
    } else {
      const expiresAt = new Date(rawExpiresAt);
      if (!partial && expiresAt.getTime() <= Date.now()) errors.push('Hạn ứng tuyển phải ở tương lai');
      values.expiresAt = expiresAt;
    }
  }
  return { values, errors };
}

function validateId(id) {
  if (!/^\d+$/.test(id)) throw makeError('Mã công việc không hợp lệ', 400);
}

async function list(recruiterId) {
  return repository.listByRecruiter(recruiterId);
}

async function get(recruiterId, id) {
  const job = await repository.findByIdAndRecruiter(id, recruiterId);
  if (!job) throw makeError('Không tìm thấy tin tuyển dụng', 404);
  return job;
}

async function create(recruiterId, body) {
  const { values, errors } = validateJob(body || {});
  if (errors.length) throw makeError(errors.join('; '), 400);
  const company = await repository.findCompanyForRecruiter(recruiterId);
  if (!company) throw makeError('Tài khoản chưa có thông tin công ty', 409);
  const id = await repository.createJob({
    ...values,
    companyId: company.id,
    recruiterId,
  });
  return repository.findByIdAndRecruiter(id, recruiterId);
}

async function update(recruiterId, id, body) {
  validateId(id);
  const { values, errors } = validateJob(body || {}, { partial: true });
  if (errors.length) throw makeError(errors.join('; '), 400);
  if (!Object.keys(values).length) throw makeError('Không có trường hợp hợp lệ để cập nhật', 400);
  if (!await repository.updateJob(id, recruiterId, values)) throw makeError('Không tìm thấy tin tuyển dụng', 404);
  return repository.findByIdAndRecruiter(id, recruiterId);
}

async function close(recruiterId, id) {
  validateId(id);
  if (!await repository.closeJob(id, recruiterId)) throw makeError('Không tìm thấy tin đang mở của bạn', 404);
  return { ok: true };
}

module.exports = { list, get, create, update, close };
