// src/alerts/alertStore.js - Alert persistence layer
// File-backed JSON store for alerts with in-memory cache
// Stores alerts at reports_store/alerts.json

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const STORE_DIR = path.join(__dirname, '..', '..', 'reports_store');
const STORE_FILE = path.join(STORE_DIR, 'alerts.json');
const MAX_ALERTS = 2000; // Cap stored alerts

let alerts = []; // In-memory cache, newest first

// Ensure directory exists
if (!fs.existsSync(STORE_DIR)) {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    console.log('alertStore: created reports_store directory');
  } catch (e) {
    console.warn('alertStore: failed to create directory', e && e.message);
  }
}

// Load existing alerts on startup
try {
  if (fs.existsSync(STORE_FILE)) {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      alerts = parsed.slice(0, MAX_ALERTS); // Keep newest first
      console.log(`alertStore: loaded ${alerts.length} alerts from disk`);
    }
  }
} catch (e) {
  console.warn('alertStore: init load failed', e && e.message);
  alerts = [];
}

/**
 * Persist alerts to disk (synchronous write to prevent corruption)
 * Writes newest-first array to JSON file
 */
function persist() {
  try {
    const toWrite = alerts.slice(0, MAX_ALERTS); // Ensure we don't exceed cap
    fs.writeFileSync(STORE_FILE, JSON.stringify(toWrite, null, 2), 'utf8');
  } catch (e) {
    console.error('alertStore: persist failed', e && e.message);
  }
}

/**
 * Normalize alert object to ensure required shape
 * @param {Object} alert - Alert object
 * @returns {Object} Normalized alert
 */
function normalizeAlert(alert) {
  if (!alert || typeof alert !== 'object') {
    throw new Error('Invalid alert object');
  }

  // Ensure level is one of the valid values
  const validLevels = ['Emergency', 'Priority', 'Normal'];
  let alertLevel = alert.level || 'Normal';
  if (!validLevels.includes(alertLevel)) {
    // Try to normalize
    const levelLower = String(alertLevel).toLowerCase();
    if (levelLower.includes('emergency') || levelLower.includes('critical')) {
      alertLevel = 'Emergency';
    } else if (levelLower.includes('priority') || levelLower.includes('high') || levelLower.includes('medium')) {
      alertLevel = 'Priority';
    } else {
      alertLevel = 'Normal';
    }
  }

  return {
    id: alert.id || uuidv4(),
    level: alertLevel,
    patient: {
      id: alert.patient?.id || 'unknown',
      name: alert.patient?.name || 'Unknown Patient'
    },
    reason: alert.reason || '',
    score: alert.score !== undefined ? alert.score : null,
    source: alert.source || 'rules',
    status: alert.status || 'new', // new, acknowledged, in_progress, resolved
    acknowledgedBy: alert.acknowledgedBy || null,
    acknowledgedAt: alert.acknowledgedAt || null,
    resolvedBy: alert.resolvedBy || null,
    resolvedAt: alert.resolvedAt || null,
    resolutionNotes: alert.resolutionNotes || '',
    assignedTo: alert.assignedTo || null,
    createdAt: alert.createdAt || new Date().toISOString(),
    updatedAt: alert.updatedAt || new Date().toISOString(),
    timestamp: alert.timestamp || new Date().toISOString()
  };
}

/**
 * Push alert to store (in-memory and persist)
 * @param {Object} alertObj - Alert object
 * @returns {Object} Normalized alert
 */
function pushAlert(alertObj) {
  try {
    const normalized = normalizeAlert(alertObj);
    
    // Add to front of array (newest first)
    alerts.unshift(normalized);
    
    // Trim if needed
    if (alerts.length > MAX_ALERTS) {
      alerts = alerts.slice(0, MAX_ALERTS);
    }
    
    // Persist to disk
    persist();
    
    return normalized;
  } catch (e) {
    console.error('alertStore: pushAlert failed', e && e.message);
    throw e;
  }
}

/**
 * Update an existing alert
 * @param {string} alertId - ID of the alert to update
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated alert or null if not found
 */
function updateAlert(alertId, updates) {
  try {
    const index = alerts.findIndex(a => a.id === alertId);
    if (index === -1) return null;
    
    // Create updated alert
    const updatedAlert = {
      ...alerts[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Update status timestamps if status changed
    if (updates.status === 'acknowledged' && !alerts[index].acknowledgedAt) {
      updatedAlert.acknowledgedAt = new Date().toISOString();
    }
    
    if (updates.status === 'resolved' && !alerts[index].resolvedAt) {
      updatedAlert.resolvedAt = new Date().toISOString();
    }
    
    alerts[index] = updatedAlert;
    persist();
    return updatedAlert;
  } catch (e) {
    console.error('alertStore: updateAlert failed', e && e.message);
    throw e;
  }
}

/**
 * Acknowledge an alert
 * @param {string} alertId - ID of the alert to acknowledge
 * @param {string} userId - ID of the user acknowledging the alert
 * @returns {Object|null} Updated alert or null if not found
 */
function acknowledgeAlert(alertId, userId) {
  return updateAlert(alertId, {
    status: 'acknowledged',
    acknowledgedBy: userId,
    acknowledgedAt: new Date().toISOString()
  });
}

/**
 * Resolve an alert
 * @param {string} alertId - ID of the alert to resolve
 * @param {string} userId - ID of the user resolving the alert
 * @param {string} notes - Resolution notes
 * @returns {Object|null} Updated alert or null if not found
 */
function resolveAlert(alertId, userId, notes = '') {
  return updateAlert(alertId, {
    status: 'resolved',
    resolvedBy: userId,
    resolvedAt: new Date().toISOString(),
    resolutionNotes: notes
  });
}

/**
 * Assign an alert to a user
 * @param {string} alertId - ID of the alert to assign
 * @param {string} userId - ID of the user to assign to
 * @returns {Object|null} Updated alert or null if not found
 */
function assignAlert(alertId, userId) {
  return updateAlert(alertId, {
    assignedTo: userId,
    status: 'in_progress'
  });
}

/**
 * Get alert by ID
 * @param {string} alertId - ID of the alert to find
 * @returns {Object|null} Found alert or null
 */
function getAlert(alertId) {
  return alerts.find(a => a.id === alertId) || null;
}

/**
 * Get recent alerts (newest first)
 * @param {number} limit - Maximum number of alerts to return (default 100)
 * @returns {Array} Array of alerts
 */
function getRecent(limit = 100) {
  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 100), MAX_ALERTS);
  return alerts.slice(0, safeLimit);
}

/**
 * Get recent alerts for a specific patient
 * @param {string} patientId - Patient ID
 * @param {number} limit - Maximum number of alerts to return (default 10)
 * @returns {Array} Array of alerts for patient
 */
function getRecentForPatient(patientId, limit = 10) {
  if (!patientId) return [];
  
  const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 200);
  const patientAlerts = alerts.filter(a => 
    String(a.patient?.id || '').toLowerCase() === String(patientId).toLowerCase()
  );
  
  return patientAlerts.slice(0, safeLimit);
}

/**
 * Clear all alerts (for testing)
 * @returns {number} Number of alerts cleared
 */
function clear() {
  const count = alerts.length;
  alerts = [];
  persist();
  console.log(`alertStore: cleared ${count} alerts`);
  return count;
}

module.exports = {
  pushAlert,
  getRecent,
  getRecentForPatient,
  getAlert,
  updateAlert,
  acknowledgeAlert,
  resolveAlert,
  assignAlert,
  clear
};
