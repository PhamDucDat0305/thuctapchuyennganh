const service = require('../services/job-reports.service');

const fields = {
  fullName: { max: 150, label: 'họ và tên' },
  phone: { max: 30, label: 'số điện thoại' },
  address: { max: 300, label: 'địa chỉ' },
  email: { max: 255, label: 'địa chỉ email' },
  content: { max: 4000, label: 'nội dung phản ánh' },
};

function validate(body) {
  const jobId = String(body.jobId || '');
  if (!/^[1-9]\d*$/.test(jobId)) return { error: 'Mã tin tuyển dụng không hợp lệ' };

  const values = { jobId };
  for (const [key, rule] of Object.entries(fields)) {
    values[key] = typeof body[key] === 'string' ? body[key].trim() : '';
    if (!values[key]) return { error: `Vui lòng nhập ${rule.label}` };
    if (values[key].length > rule.max) {
      return { error: `Trường ${rule.label} vượt quá ${rule.max} ký tự` };
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return { error: 'Địa chỉ email không hợp lệ' };
  }
  return { values };
}

async function create(req, res) {
  const { values, error } = validate(req.body || {});
  if (error) return res.status(400).json({ error });

  const id = await service.createReport({ ...values, reporterId: req.user.id });
  return res.status(201).json({
    ok: true,
    id: Number(id),
    message: 'Đã gửi phản ánh đến quản trị viên',
  });
}

module.exports = { create };
