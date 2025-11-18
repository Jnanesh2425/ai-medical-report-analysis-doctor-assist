// src/alerts/alertRoutes.js
const express = require('express');
const router = express.Router();
const alertStore = require('./alertStore');

// GET /api/alerts?limit=20
router.get('/', (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit || '50', 10) || 50);
    const data = alertStore.getRecent(limit);
    return res.json({ ok: true, count: data.length, alerts: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

// GET /api/alerts/patient/:patientId
router.get('/patient/:patientId', (req, res) => {
  try {
    const pid = req.params.patientId;
    if (!pid) return res.status(400).json({ ok: false, error: 'patientId required' });
    const data = alertStore.getByPatient(pid, 200);
    return res.json({ ok: true, count: data.length, alerts: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

module.exports = router;
