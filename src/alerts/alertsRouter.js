// src/alerts/alertsRouter.js - REST API for alerts
// Endpoints: GET /api/alerts, POST /api/alerts/message, POST /api/alerts/evaluate, DELETE /api/alerts

const express = require('express');
const router = express.Router();
const alertStore = require('./alertStore');
const alertEngine = require('./alertEngine');

// Middleware for JSON parsing
router.use(express.json());

/**
 * GET /api/alerts?limit=50
 * Get recent alerts (newest first)
 */
router.get('/alerts', (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10) || 50));
    const alerts = alertStore.getRecent(limit);
    
    return res.json({
      ok: true,
      alerts,
      count: alerts.length
    });
  } catch (err) {
    console.error('alertsRouter: GET /alerts error', err && err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || String(err)
    });
  }
});

/**
 * POST /api/alerts/message
 * Classify and create alert from patient message
 * Body: { patientId, patientName, message, timestamp? }
 */
router.post('/alerts/message', async (req, res) => {
  try {
    const { patientId, patientName, message, timestamp } = req.body;
    
    // Validation
    if (!patientId || typeof patientId !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'patientId is required and must be a string'
      });
    }
    
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'message is required and must be a non-empty string'
      });
    }
    
    console.log(`alertsRouter: POST /message from patient ${patientId}`);
    
    // Get Socket.IO instance
    const io = req.app && req.app.get ? req.app.get('io') : null;
    
    // Call alert engine
    const alert = await alertEngine.evaluateAndEmitAlert({
      req,
      io,
      patient: {
        id: patientId,
        name: patientName || 'Unknown Patient'
      },
      ruleResult: null, // Message-only classification
      llmParsed: null,
      message: message.trim(),
      timestamp: timestamp || new Date().toISOString()
    });
    
    if (!alert) {
      return res.status(500).json({
        ok: false,
        error: 'Failed to create alert'
      });
    }
    
    return res.json({
      ok: true,
      alert
    });
    
  } catch (err) {
    console.error('alertsRouter: POST /message error', err && err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || String(err)
    });
  }
});

/**
 * POST /api/alerts/evaluate
 * Evaluate alert with full report data
 * Body: { patient: {id, name}, ruleResult, llmParsed?, message? }
 */
router.post('/alerts/evaluate', async (req, res) => {
  try {
    const { patient, ruleResult, llmParsed, message } = req.body;
    
    // Validation
    if (!patient || !patient.id) {
      return res.status(400).json({
        ok: false,
        error: 'patient.id is required'
      });
    }
    
    console.log(`alertsRouter: POST /evaluate for patient ${patient.id}`);
    
    // Get Socket.IO instance
    const io = req.app && req.app.get ? req.app.get('io') : null;
    
    // Call alert engine
    const alert = await alertEngine.evaluateAndEmitAlert({
      req,
      io,
      patient: {
        id: patient.id,
        name: patient.name || 'Unknown Patient'
      },
      ruleResult: ruleResult || null,
      llmParsed: llmParsed || null,
      message: message ? String(message).trim() : '',
      timestamp: new Date().toISOString()
    });
    
    if (!alert) {
      return res.status(500).json({
        ok: false,
        error: 'Failed to create alert'
      });
    }
    
    return res.json({
      ok: true,
      alert
    });
    
  } catch (err) {
    console.error('alertsRouter: POST /evaluate error', err && err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || String(err)
    });
  }
});

/**
 * DELETE /api/alerts
 * Clear all alerts (for testing only)
 */
router.delete('/alerts', (req, res) => {
  try {
    const count = alertStore.clear();
    
    return res.json({
      ok: true,
      message: 'Alerts cleared',
      count
    });
  } catch (err) {
    console.error('alertsRouter: DELETE /alerts error', err && err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || String(err)
    });
  }
});

module.exports = router;



