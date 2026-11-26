const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const repository = require('../repositories/employer-company.repository');

const fields = {
  name: { max: 200, required: true },
  logo: { max: 500 },
  logoUrl: { max: 500 },
  industry: { max: 100 },
  size: { max: 50 },
  location: { max: 200 },
  website: { max: 500 },
  description: { max: 8000 },
};

function makeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validate(body, partial) {
  const values = {};
  const errors = [];
  for (const [key, rule] of Object.entries(fields)) {
    if (partial && !Object.hasOwn(body, key)) continue;
    const value = typeof body[key] === 'string' ? body[key].trim() : '';
    if (rule.required && !value) errors.push(`${key} là bắt buộc`);
    else if (value.length > rule.max) errors.push(`${key} không được vượt quá ${rule.max} ký tự`);
    values[key] = value || null;
  }
  if (values.website && !/^https?:\/\//i.test(values.website)) {
    errors.push('website phải bắt đầu bằng http:// hoặc https://');
  }
  if (errors.length) throw makeError(errors.join('; '), 400);
  return values;
}

async function getMine(employerId) {
  return repository.findByEmployer(employerId);
}

async function createOrUpdate(employerId, body) {
  return repository.upsertByEmployer(employerId, validate(body, false));
}

async function update(employerId, body) {
  const values = validate(body, true);
  if (!Object.keys(values).length) throw makeError('Không có trường hợp hợp lệ để cập nhật', 400);
  const company = await repository.updateByEmployer(employerId, values);
  if (!company) throw makeError('Chưa tạo hồ sơ công ty', 404);
  return company;
}

async function uploadLogo(employerId, contentType, image) {
  if (!image?.length || image.length > 2 * 1024 * 1024) {
    throw makeError('Ảnh logo trống hoặc vượt quá 2MB', 400);
  }

  const formats = {
    'image/png': {
      extension: 'png',
      matches: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    },
    'image/jpeg': {
      extension: 'jpg',
      matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    },
    'image/webp': {
      extension: 'webp',
      matches: (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
    },
  };
  const format = formats[contentType];
  if (!format || !format.matches(image)) throw makeError('Chỉ nhận ảnh PNG, JPG hoặc WEBP hợp lệ', 415);

  const filename = `company-${employerId}-${crypto.randomUUID()}.${format.extension}`;
  const uploadDirectory = path.resolve(__dirname, '..', '..', '..', 'public', 'employer', 'uploads', 'companies');
  await fs.mkdir(uploadDirectory, { recursive: true });
  await fs.writeFile(path.join(uploadDirectory, filename), image, { flag: 'wx', mode: 0o644 });
  return { logo: `/employer/uploads/companies/${filename}` };
}

module.exports = { getMine, createOrUpdate, update, uploadLogo };
