const express = require('express');
const { sequelize } = require('../models');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

router.get('/db', async (req, res) => {
  try {
    await sequelize.query('SELECT 1 AS ok');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('[health/db]', err.message);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

module.exports = router;
