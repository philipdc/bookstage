const express = require('express');
const router  = express.Router();
const { getAccounts } = require('../db/firebird');

// GET /api/accounts?db=/path/to/company.fdb
router.get('/', async (req, res) => {
  try {
    const dbPath   = req.query.db || process.env.FB_DATABASE || '';
    const accounts = await getAccounts(dbPath);
    res.json(accounts);
  } catch (err) {
    console.error('Firebird error:', err.message);
    res.status(500).json({ error: 'Failed to load accounts', detail: err.message });
  }
});

module.exports = router;
