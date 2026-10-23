const express = require('express');
const { checkDatabase } = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

router.get('/db', async (req, res) => {
  try {
    await checkDatabase();
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('[health/db]', err.message);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

module.exports = router;
