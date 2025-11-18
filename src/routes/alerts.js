const express = require('express');
const router = express.Router();
const alertStore = require('../alerts/alertStore');

/**
 * @swagger
 * tags:
 *   name: Alerts
 *   description: Alert management endpoints
 */

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: Get recent alerts
 *     tags: [Alerts]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of alerts to return
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, new, acknowledged, in_progress, resolved]
 *           default: all
 *         description: Filter alerts by status
 *     responses:
 *       200:
 *         description: List of alerts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Alert'
 */
router.get('/', (req, res) => {
  try {
    let { limit = '100', status = 'all' } = req.query;
    limit = Math.min(parseInt(limit, 10) || 100, 1000);
    
    let alerts = alertStore.getRecent(1000); // Get more than needed for filtering
    
    // Filter by status if specified
    if (status !== 'all') {
      alerts = alerts.filter(alert => alert.status === status);
    }
    
    // Apply limit after filtering
    alerts = alerts.slice(0, limit);
    
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * @swagger
 * /api/alerts/{alertId}:
 *   get:
 *     summary: Get alert by ID
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the alert to get
 *     responses:
 *       200:
 *         description: Alert details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alert'
 *       404:
 *         description: Alert not found
 */
router.get('/:alertId', (req, res) => {
  try {
    const { alertId } = req.params;
    const alert = alertStore.getAlert(alertId);
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(alert);
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

/**
 * @swagger
 * /api/alerts/{alertId}/acknowledge:
 *   post:
 *     summary: Acknowledge an alert
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the alert to acknowledge
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user acknowledging the alert
 *     responses:
 *       200:
 *         description: Alert acknowledged successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alert'
 *       404:
 *         description: Alert not found
 */
router.post('/:alertId/acknowledge', (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const updatedAlert = alertStore.acknowledgeAlert(alertId, userId);
    
    if (!updatedAlert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(updatedAlert);
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

/**
 * @swagger
 * /api/alerts/{alertId}/resolve:
 *   post:
 *     summary: Resolve an alert
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the alert to resolve
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user resolving the alert
 *               notes:
 *                 type: string
 *                 description: Resolution notes
 *     responses:
 *       200:
 *         description: Alert resolved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alert'
 *       404:
 *         description: Alert not found
 */
router.post('/:alertId/resolve', (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId, notes = '' } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const updatedAlert = alertStore.resolveAlert(alertId, userId, notes);
    
    if (!updatedAlert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(updatedAlert);
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

/**
 * @swagger
 * /api/alerts/{alertId}/assign:
 *   post:
 *     summary: Assign an alert to a user
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the alert to assign
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID of the user to assign the alert to
 *     responses:
 *       200:
 *         description: Alert assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alert'
 *       404:
 *         description: Alert not found
 */
router.post('/:alertId/assign', (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const updatedAlert = alertStore.assignAlert(alertId, userId);
    
    if (!updatedAlert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(updatedAlert);
  } catch (error) {
    console.error('Error assigning alert:', error);
    res.status(500).json({ error: 'Failed to assign alert' });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Alert:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the alert
 *         level:
 *           type: string
 *           enum: [Emergency, Priority, Normal]
 *           description: Alert severity level
 *         status:
 *           type: string
 *           enum: [new, acknowledged, in_progress, resolved]
 *           description: Current status of the alert
 *         patient:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             name:
 *               type: string
 *         reason:
 *           type: string
 *           description: Description of why the alert was triggered
 *         score:
 *           type: number
 *           description: Numeric score indicating alert severity
 *         source:
 *           type: string
 *           description: Source of the alert (e.g., 'rules', 'fusion')
 *         acknowledgedBy:
 *           type: string
 *           description: ID of user who acknowledged the alert
 *         acknowledgedAt:
 *           type: string
 *           format: date-time
 *         resolvedBy:
 *           type: string
 *           description: ID of user who resolved the alert
 *         resolvedAt:
 *           type: string
 *           format: date-time
 *         resolutionNotes:
 *           type: string
 *           description: Notes about how the alert was resolved
 *         assignedTo:
 *           type: string
 *           description: ID of user the alert is assigned to
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

module.exports = router;