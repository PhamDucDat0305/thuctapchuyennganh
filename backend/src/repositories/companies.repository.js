const { Company } = require('../models');

async function findPublicById(id) {
  return Company.findOne({
    attributes: [
      'id', 'employerId', 'name', 'logoUrl', 'logo', 'industry', 'size',
      'location', 'website', 'description', 'createdAt', 'updatedAt',
    ],
    where: { id, adminStatus: 'active' },
    raw: true,
  });
}

module.exports = { findPublicById };
