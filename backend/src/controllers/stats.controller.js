const service = require('../services/stats.service');

async function getOverview(req, res) {
  return res.json(await service.getOverview());
}

module.exports = { getOverview };
