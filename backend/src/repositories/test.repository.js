const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

async function pingDatabase() {
  const rows = await sequelize.query('SELECT 1 AS result', {
    type: QueryTypes.SELECT,
  });
  return Number(rows[0]?.result) === 1;
}

module.exports = { pingDatabase };
