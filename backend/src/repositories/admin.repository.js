const { Op, QueryTypes, Transaction } = require('sequelize');
const { sequelize, User, Job, Company, Application, AdminAuditLog, JobReport } = require('../models');

function searchWhere(q, fields) {
  const text = String(q || '').replace(/[\[%_]/g, (c) => `[${c}]`);
  if (!text) return {};
  return { [Op.or]: fields.map((field) => ({ [field]: { [Op.like]: `%${text}%` } })) };
}

async function auditRead(adminId, ip, action, targetType) {
  await AdminAuditLog.create({
    adminId,
    action,
    targetType,
    ipAddress: String(ip || '').slice(0, 45) || null,
    createdAt: sequelize.literal('SYSUTCDATETIME()'),
  });
}

async function overview(user, ip) {
  await auditRead(user.id, ip, 'dashboard.view', 'dashboard');
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [candidates, employers, admins, activeJobs, applications, newUsersThisWeek,
    hiddenJobs, suspendedCompanies, newJobReports] = await Promise.all([
    User.count({ where: { role: 'candidate', status: 'active', adminLocked: false } }),
    User.count({ where: { role: 'employer', status: 'active', adminLocked: false } }),
    User.count({ where: { role: 'admin', status: 'active' } }),
    Job.count({ where: { status: 'active', adminVisibility: 'visible', [Op.or]: [
      { expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } },
    ] } }),
    Application.count(),
    User.count({ where: { createdAt: { [Op.gte]: weekAgo } } }),
    Job.count({ where: { adminVisibility: 'hidden' } }),
    Company.count({ where: { adminStatus: 'suspended' } }),
    JobReport.count({ where: { status: 'new' } }),
  ]);
  return { candidates, employers, admins, activeJobs, applications, newUsersThisWeek,
    hiddenJobs, suspendedCompanies, newJobReports };
}

async function listUsers({ user, ip, page, limit, q, role }) {
  await auditRead(user.id, ip, 'users.list', 'users');
  const where = { ...searchWhere(q, ['email', 'fullName']) };
  if (role) where.role = role;
  const result = await User.findAndCountAll({
    where,
    attributes: ['id', 'email', 'fullName', 'role', 'status', 'adminLocked', 'createdAt'],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    offset: (page - 1) * limit,
    limit,
  });
  return { items: result.rows.map((x) => ({ ...x.get({ plain: true }), id: Number(x.id), adminLocked: Boolean(x.adminLocked) })),
    total: Number(result.count), page, limit };
}

async function listJobs({ user, ip, page, limit, q }) {
  await auditRead(user.id, ip, 'jobs.list', 'jobs');
  const result = await Job.findAndCountAll({
    where: searchWhere(q, ['title', '$company.name$']),
    attributes: ['id', 'title', 'status', 'adminVisibility', 'createdAt'],
    include: [
      { model: Company, as: 'company', attributes: ['id', 'name'], required: true },
      { model: User, as: 'recruiter', attributes: ['email'], required: true },
    ],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    offset: (page - 1) * limit,
    limit,
    distinct: true,
  });
  return { items: result.rows.map((x) => ({
    id: Number(x.id), title: x.title, status: x.status, adminVisibility: x.adminVisibility,
    createdAt: x.createdAt, companyId: Number(x.company.id), companyName: x.company.name,
    employerEmail: x.recruiter.email,
  })), total: Number(result.count), page, limit };
}

async function listCompanies({ user, ip, page, limit, q }) {
  await auditRead(user.id, ip, 'companies.list', 'companies');
  const result = await Company.findAndCountAll({
    where: searchWhere(q, ['name', 'industry', '$employer.email$']),
    attributes: ['id', 'name', 'industry', 'location', 'adminStatus', 'employerId'],
    include: [{ model: User, as: 'employer', attributes: ['email'], required: true }],
    order: [['id', 'DESC']],
    offset: (page - 1) * limit,
    limit,
    distinct: true,
  });
  return { items: result.rows.map((x) => ({
    id: Number(x.id), name: x.name, industry: x.industry, location: x.location,
    adminStatus: x.adminStatus, employerId: Number(x.employerId), employerEmail: x.employer.email,
  })), total: Number(result.count), page, limit };
}

async function listAuditLogs({ user, ip, page, limit }) {
  await auditRead(user.id, ip, 'audit_logs.view', 'audit_logs');
  const result = await AdminAuditLog.findAndCountAll({
    attributes: ['id', 'action', 'targetType', 'targetId', 'reason', 'ipAddress', 'createdAt', 'metadataJson'],
    include: [{ model: User, as: 'admin', attributes: ['email'], required: true }],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    offset: (page - 1) * limit,
    limit,
    distinct: true,
  });
  return { items: result.rows.map((x) => ({
    id: Number(x.id), action: x.action, targetType: x.targetType,
    targetId: x.targetId == null ? null : Number(x.targetId), reason: x.reason,
    ipAddress: x.ipAddress, createdAt: x.createdAt, adminEmail: x.admin.email,
    metadata: x.metadataJson,
  })), total: Number(result.count), page, limit };
}

async function listReports(user, ip, status) {
  await auditRead(user.id, ip, 'job_reports.list', 'job_reports');
  const result = await JobReport.findAll({
    where: status ? { status } : undefined,
    attributes: ['id', 'jobId', 'reporterId', 'fullName', 'phone', 'address', 'email', 'content', 'status', 'adminNote', 'createdAt', 'updatedAt'],
    include: [{ model: Job, as: 'job', attributes: ['title'], required: true,
      include: [{ model: Company, as: 'company', attributes: ['name'], required: true }] }],
    order: [[sequelize.literal("CASE [JobReport].[status] WHEN N'new' THEN 0 WHEN N'reviewing' THEN 1 ELSE 2 END"), 'ASC'], ['createdAt', 'DESC'], ['id', 'DESC']],
    limit: 200,
  });
  return result.map((x) => ({
    id: Number(x.id), jobId: Number(x.jobId), jobTitle: x.job.title, companyName: x.job.company.name,
    reporterId: Number(x.reporterId), fullName: x.fullName, phone: x.phone, address: x.address,
    email: x.email, content: x.content, status: x.status, adminNote: x.adminNote,
    createdAt: x.createdAt, updatedAt: x.updatedAt,
  }));
}

async function updateJobVisibility(input) {
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (tx) => {
    const found = await sequelize.query('SELECT id FROM dbo.jobs WITH (UPDLOCK,ROWLOCK) WHERE id=:id', {
      replacements: { id: input.id }, transaction: tx, type: QueryTypes.SELECT,
    });
    if (!found.length) return 'missing';

    // SQL Server's trigger updates updated_at; silent avoids Sequelize adding an OUTPUT clause.
    const [affected] = await Job.update({ adminVisibility: input.visibility }, {
      where: { id: input.id }, transaction: tx, silent: true,
    });
    if (Number(affected) !== 1) return 'missing';

    await AdminAuditLog.create({
      adminId: input.adminId,
      action: `job.${input.visibility}`,
      targetType: 'job',
      targetId: input.id,
      reason: input.reason,
      ipAddress: String(input.ip || '').slice(0, 45) || null,
      createdAt: sequelize.literal('SYSUTCDATETIME()'),
    }, { transaction: tx });
    return 'ok';
  });
}
async function lockUser(input) {
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (tx) => {
    const found = await sequelize.query('SELECT id,role FROM dbo.users WITH (UPDLOCK,ROWLOCK) WHERE id=:id', {
      replacements: { id: input.id }, transaction: tx, type: QueryTypes.SELECT,
    });
    if (!found.length) return 'missing';
    if (found[0].role === 'admin') return 'admin';

    const [affected] = await User.update({ adminLocked: input.locked }, {
      where: { id: input.id }, transaction: tx, silent: true,
    });
    if (Number(affected) !== 1) return 'missing';

    await AdminAuditLog.create({
      adminId: input.adminId,
      action: input.locked ? 'user.lock' : 'user.unlock',
      targetType: 'user',
      targetId: input.id,
      reason: input.reason,
      ipAddress: String(input.ip || '').slice(0, 45) || null,
      createdAt: sequelize.literal('SYSUTCDATETIME()'),
    }, { transaction: tx });
    return 'ok';
  });
}
async function updateCompanyStatus(input) {
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (tx) => {
    const found = await sequelize.query('SELECT id FROM dbo.companies WITH (UPDLOCK,ROWLOCK) WHERE id=:id', {
      replacements: { id: input.id }, transaction: tx, type: QueryTypes.SELECT,
    });
    if (!found.length) return 'missing';

    const [affected] = await Company.update({ adminStatus: input.status }, {
      where: { id: input.id }, transaction: tx, silent: true,
    });
    if (Number(affected) !== 1) return 'missing';

    await AdminAuditLog.create({
      adminId: input.adminId,
      action: `company.${input.status}`,
      targetType: 'company',
      targetId: input.id,
      reason: input.reason,
      ipAddress: String(input.ip || '').slice(0, 45) || null,
      createdAt: sequelize.literal('SYSUTCDATETIME()'),
    }, { transaction: tx });
    return 'ok';
  });
}
async function updateReport(input) {
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (tx) => {
    const found = await sequelize.query('SELECT id FROM dbo.job_reports WITH (UPDLOCK,ROWLOCK) WHERE id=:id', {
      replacements: { id: input.id }, transaction: tx, type: QueryTypes.SELECT,
    });
    if (!found.length) return false;

    const [affected] = await JobReport.update({
      status: input.status,
      adminNote: input.note || null,
      updatedAt: sequelize.literal('SYSUTCDATETIME()'),
    }, { where: { id: input.id }, transaction: tx, silent: true });
    if (Number(affected) !== 1) return false;

    await AdminAuditLog.create({
      adminId: input.adminId,
      action: `job_report.${input.status}`,
      targetType: 'job_report',
      targetId: input.id,
      reason: input.note || 'Admin cập nhật trạng thái phản ánh',
      ipAddress: String(input.ip || '').slice(0, 45) || null,
      createdAt: sequelize.literal('SYSUTCDATETIME()'),
    }, { transaction: tx });
    return true;
  });
}
module.exports = { overview, listUsers, listJobs, listCompanies, listAuditLogs, listReports, lockUser, updateCompanyStatus, updateJobVisibility, updateReport };
