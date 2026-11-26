const { literal } = require('sequelize');
const { Company } = require('../models');

const companyAttributes = [
  'id', 'employerId', 'name', 'logoUrl', 'logo', 'industry', 'size',
  'location', 'website', 'description', 'createdAt', 'updatedAt',
];

function toCompanyResponse(company) {
  if (!company) return null;
  const row = typeof company.get === 'function' ? company.get({ plain: true }) : company;
  return { ...row, id: Number(row.id), employerId: Number(row.employerId) };
}

async function findByEmployer(employerId) {
  const company = await Company.findOne({
    attributes: companyAttributes,
    where: { employerId },
  });
  return toCompanyResponse(company);
}

async function upsertByEmployer(employerId, values) {
  const existing = await Company.findOne({ where: { employerId } });
  if (existing) {
    await existing.update({ ...values, updatedAt: literal('SYSUTCDATETIME()') });
    return findByEmployer(employerId);
  }

  await Company.create({
    employerId,
    ...values,
    adminStatus: 'active',
    createdAt: literal('SYSUTCDATETIME()'),
    updatedAt: literal('SYSUTCDATETIME()'),
  });
  return findByEmployer(employerId);
}

async function updateByEmployer(employerId, values) {
  const [affected] = await Company.update({
    ...values,
    updatedAt: literal('SYSUTCDATETIME()'),
  }, { where: { employerId } });
  if (!affected) return null;
  return findByEmployer(employerId);
}

module.exports = { findByEmployer, upsertByEmployer, updateByEmployer };
