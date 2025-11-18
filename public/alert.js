// public/alert.js - Real-time alerts for Alert Engine tab
// Modified to fix bugs and make alert management more robust
console.log('Alert engine script loaded');

// Current user ID - in a real app, this would come from authentication
const CURRENT_USER_ID = 'user_' + Math.random().toString(36).substr(2, 9);

// Alert status mapping to display text and colors
const ALERT_STATUS = {
  new: { text: 'New', color: '#3b82f6' }, // blue
  acknowledged: { text: 'Acknowledged', color: '#8b5cf6' }, // purple
  in_progress: { text: 'In Progress', color: '#f59e0b' }, // amber
  resolved: { text: 'Resolved', color: '#10b981' } // green
};

// API base URL
const API_BASE_URL = '/api';

// Debug function to log to console and show in UI
function debugLog(message, data) {
  console.log(`[AlertEngine] ${message}`, data || '');

  const debugPanel = document.getElementById('debug-panel');
  if (!debugPanel) return;

  const logEntry = document.createElement('div');
  logEntry.textContent = `[${new Date().toISOString()}] ${message}`;
  if (data) {
    const dataEl = document.createElement('pre');
    dataEl.textContent = JSON.stringify(data, null, 2);
    logEntry.appendChild(document.createElement('br'));
    logEntry.appendChild(dataEl);
  }
  debugPanel.prepend(logEntry);
}

// Show toast notification
function showToast(message, type = 'info') {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'i'
  };

  const t = document.createElement('div');
  t.className = 'toast-notification';
  t.style.cssText = `
    position: fixed;
    right: 16px;
    bottom: 16px;
    background: #fff;
    color: #111;
    padding: 12px 16px;
    border-radius: 8px;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s, transform 0.3s;
    z-index: 99999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border-left: 4px solid ${colors[type] || colors.info};
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 320px;
  `;

  t.innerHTML = `
    <span style="font-weight: bold; color: ${colors[type] || colors.info};">${icons[type] || ''}</span>
    <span style="flex:1">${escapeHtml(message)}</span>
    <button aria-label="close toast" class="toast-close" style="border:none;background:none;cursor:pointer;font-weight:bold;">✕</button>
  `;

  document.body.appendChild(t);
  // close button
  t.querySelector('.toast-close').addEventListener('click', () => t.remove());

  // Trigger animation
  t.offsetHeight;
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';

  // Auto-remove after delay
  const timeout = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(-10px)';
    setTimeout(() => t.remove(), 300);
  }, 5000);

  // Pause removal on hover
  t.addEventListener('mouseenter', () => clearTimeout(timeout));
  return t;
}

function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Alert management API client (robust)
const alertApi = {
  // Get all alerts or alerts by status. status=null or 'all' -> returns many alerts
  getAlerts: async (status = null) => {
    debugLog('Fetching alerts...', { status });
    try {
      const url = (status && status !== 'all')
        ? `${API_BASE_URL}/alerts?status=${encodeURIComponent(status)}`
        : `${API_BASE_URL}/alerts?limit=100`;

      const response = await fetch(url);
      debugLog('Alerts API response status', { status: response.status, statusText: response.statusText });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      let data = await response.json().catch(() => null);
      debugLog('Raw API response', { dataType: typeof data, isArray: Array.isArray(data), sample: Array.isArray(data) ? data[0] : data });

      // Normalize to array
      let alerts = [];
      if (!data) {
        alerts = [];
      } else if (Array.isArray(data)) {
        alerts = data;
      } else if (data && Array.isArray(data.alerts)) {
        alerts = data.alerts;
      } else if (data && typeof data === 'object') {
        alerts = [data];
      }

      debugLog('Received alerts', { count: alerts.length });
      return alerts;
    } catch (error) {
      const errorMsg = `Error fetching alerts: ${error.message}`;
      console.error(errorMsg, error);
      debugLog(errorMsg, { error: error.message, stack: error.stack });
      showToast('Failed to load alerts', 'error');
      return [];
    }
  },

  // Acknowledge alert
  acknowledgeAlert: async (alertId, userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/${encodeURIComponent(alertId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'acknowledged',
          acknowledgedBy: userId,
          acknowledgedAt: new Date().toISOString()
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to acknowledge alert');
      }
      return await response.json();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      showToast(error.message || 'Failed to acknowledge alert', 'error');
      throw error;
    }
  },

  // Resolve alert
  resolveAlert: async (alertId, userId, notes = '') => {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/${encodeURIComponent(alertId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          resolvedBy: userId,
          resolvedAt: new Date().toISOString(),
          resolutionNotes: notes
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to resolve alert');
      }
      return await response.json();
    } catch (error) {
      console.error('Error resolving alert:', error);
      showToast(error.message || 'Failed to resolve alert', 'error');
      throw error;
    }
  },

  // Assign an alert
  assignAlert: async (alertId, userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/${encodeURIComponent(alertId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in_progress',
          assignedTo: userId,
          assignedAt: new Date().toISOString()
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to assign alert');
      }
      return await response.json();
    } catch (error) {
      console.error('Error assigning alert:', error);
      showToast(error.message || 'Failed to assign alert', 'error');
      throw error;
    }
  },

  // Unassign (remove assignedTo) and set ack status
  unassignAlert: async (alertId, userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/${encodeURIComponent(alertId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'acknowledged',
          assignedTo: null,
          unassignedBy: userId,
          unassignedAt: new Date().toISOString()
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to unassign alert');
      }
      return await response.json();
    } catch (error) {
      console.error('Error unassigning alert:', error);
      showToast(error.message || 'Failed to unassign alert', 'error');
      throw error;
    }
  }
};

// Main initialization
function init() {
  console.log('Initializing alert.js...');

  debugLog('Initializing alert engine...');

  // Setup socket.io if available
  let socket = null;
  try {
    if (typeof io !== 'undefined') {
      // Optionally supply path or URL here if needed: io('/alerts') or io('https://...').
      socket = io();
      debugLog('Socket.IO initializing...');

      socket.on('connect', () => {
        debugLog('Socket.IO connected', { socketId: socket.id });
        showToast('Connected to real-time alerts', 'success');
      });

      socket.on('disconnect', (reason) => {
        debugLog('Socket.IO disconnected', { reason });
        showToast('Disconnected from real-time alerts', 'warning');
      });

      socket.on('error', (error) => {
        debugLog('Socket.IO error', { error });
      });
    } else {
      debugLog('Socket.IO not found. Real-time updates will not work.');
      console.warn('Socket.IO library not loaded. Real-time alerts will not work.');
    }
  } catch (error) {
    debugLog('Error initializing Socket.IO', { error: error.message });
  }

  const alertsContainer = document.getElementById('alertsPanel');
  const counters = {
    emergency: document.getElementById('countEmergency'),
    priority: document.getElementById('countPriority'),
    normal: document.getElementById('countNormal')
  };

  // in-page store for alerts
  let alerts = [];

  function updateCounters() {
    const em = alerts.filter(a => a.level === 'Emergency' ||
      (a.level === 'Priority' && (a.score || 0) >= 10)).length;
    const pr = alerts.filter(a => a.level === 'Priority' && (a.score || 0) < 10).length;
    const no = alerts.filter(a => a.level !== 'Emergency' &&
      (a.level !== 'Priority' || (a.score || 0) < 4)).length;

    if (counters.emergency) counters.emergency.textContent = em;
    if (counters.priority) counters.priority.textContent = pr;
    if (counters.normal) counters.normal.textContent = no;

    debugLog('Counters updated', { emergency: em, priority: pr, normal: no });
  }

  // Render alerts list
  function renderList() {
    if (!alertsContainer) {
      console.warn('alertsPanel element not found');
      return;
    }

    if (!alerts || alerts.length === 0) {
      alertsContainer.innerHTML = `
        <div style="color: #999; text-align: center; padding: 40px;">
          <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
          <p style="font-size: 16px; margin-bottom: 8px;">No alerts yet</p>
          <p style="font-size: 14px; color: #bbb;">Alerts will appear here as they are triggered</p>
          <button id="refreshAlertsBtn_empty" class="btn btn-sm btn-outline-secondary mt-3" style="margin-top: 16px;">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>`;

      // Hook up button in the empty state
      const refreshBtnEmpty = document.getElementById('refreshAlertsBtn_empty');
      if (refreshBtnEmpty) {
        refreshBtnEmpty.addEventListener('click', fetchRecent);
      }
      return;
    }

    const html = alerts.map(a => {
      let name = 'Unknown';
      if (a.patient?.name && String(a.patient.name).trim()) {
        name = String(a.patient.name).trim();
      } else if (a.patient?.id && String(a.patient.id).trim()) {
        name = String(a.patient.id).trim();
      }

      const timeAgo = getTimeAgo(new Date(a.timestamp || a.createdAt || Date.now()));

      const actualLevel = (a.level && ['Emergency', 'Priority', 'Normal'].includes(a.level))
        ? a.level
        : 'Normal';
      const levelColor = getLevelColor(actualLevel, a.score || 0);

      let priorityText = actualLevel;
      if (actualLevel === 'Priority') {
        const isHighPriority = (a.reason && a.reason.toLowerCase().includes('high risk')) ||
          (a.score !== null && a.score >= 10);
        priorityText = isHighPriority ? 'High Priority' : 'Medium Priority';
      }

      const isHighPriority = actualLevel === 'Emergency' ||
        (actualLevel === 'Priority' && (a.score || 0) >= 10);
      const isMediumPriority = actualLevel === 'Priority' && (a.score || 0) < 10;

      let cardStyle = 'background: #fff;';
      if (isHighPriority) {
        cardStyle = 'background: #ffebee; border-left: 4px solid #ef4444;';
      } else if (isMediumPriority) {
        cardStyle = 'background: #fff8e1; border-left: 4px solid #f59e0b;';
      } else {
        cardStyle = 'background: #e8f5e9; border-left: 4px solid #10b981;';
      }

      const statusInfo = ALERT_STATUS[a.status] || ALERT_STATUS.new;
      const statusStyle = `background: ${statusInfo.color}15; color: ${statusInfo.color}; border: 1px solid ${statusInfo.color}40; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem;`;

      const assignedInfo = a.assignedTo ?
        `<div class="assigned-badge" style="padding:4px 8px;border-radius:12px;font-size:0.75rem;border:1px solid rgba(0,0,0,0.05)">${a.assignedTo === CURRENT_USER_ID ? 'Assigned to me' : 'Assigned'}</div>` : '';

      let actionButtons = '';
      if (a.status !== 'resolved') {
        if (!a.status || a.status === 'new') {
          actionButtons += `
            <button class="btn-action btn-acknowledge" data-id="${a.id}">
              <i class="bi bi-check-circle"></i> Acknowledge
            </button>
            <button class="btn-action btn-assign" data-id="${a.id}">
              <i class="bi bi-person-plus"></i> Assign to me
            </button>`;
        }

        if (a.status === 'acknowledged' || a.status === 'in_progress') {
          actionButtons += `
            <button class="btn-action btn-resolve" data-id="${a.id}">
              <i class="bi bi-check-circle-fill"></i> Resolve
            </button>`;
        }

        if (a.status === 'in_progress' && a.assignedTo === CURRENT_USER_ID) {
          actionButtons += `
            <button class="btn-action btn-unassign" data-id="${a.id}">
              <i class="bi bi-person-dash"></i> Unassign
            </button>`;
        }
      }

      return `
        <div class="alert-card" data-id="${a.id}" data-level="${escapeHtml(actualLevel)}"
             style="${cardStyle} position: relative; padding: 12px 16px; margin-bottom: 12px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">

          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: ${levelColor};"></div>
              <div>
                <strong style="color: ${levelColor}; font-size: 0.95rem;">${escapeHtml(priorityText)} Alert</strong>
                ${a.score !== null && a.score !== undefined ?
                  `<span style="font-size: 0.75rem; color: #666; margin-left: 8px;">(Score: ${escapeHtml(a.score)})</span>` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 8px; align-items:center;">
              <span class="status-badge" style="${statusStyle}">${escapeHtml(statusInfo.text)}</span>
              ${assignedInfo}
            </div>
          </div>

          <div style="font-size: 0.95rem; color: #444; margin-bottom: 8px;">
            ${escapeHtml(a.reason || 'No details provided')}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 0.85rem; color: #777;">
              <i class="bi bi-person"></i> ${escapeHtml(name)}
            </div>
            <div style="font-size: 0.75rem; color: #999; display: flex; align-items: center; gap: 4px;">
              <i class="bi bi-clock"></i> ${timeAgo}
            </div>
          </div>

          <div class="alert-actions" style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
            <button data-pid="${escapeHtml(a.patient?.id || '')}" class="btn-view-details" style="font-size: 0.8rem; padding: 4px 8px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer;">
              <i class="bi bi-eye"></i> View Details
            </button>
            ${actionButtons}
          </div>
        </div>
      `;
    }).join('\n');

    alertsContainer.innerHTML = html;

    // Attach handlers for view-details
    Array.from(document.getElementsByClassName('btn-view-details')).forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.getAttribute('data-pid') || '';
        if (pid && window.switchTab) {
          window.switchTab('postop');
          const patientIdInput = document.getElementById('patientId');
          if (patientIdInput) {
            patientIdInput.value = pid;
          }
          window.history.pushState({}, '', `?patientId=${encodeURIComponent(pid)}`);
        }
      });
    });

    debugLog('Rendered alert list', { count: alerts.length });
  }

  function getLevelColor(level, score) {
    if (level === 'Emergency' || (level === 'Priority' && score >= 10)) {
      return '#ef4444';
    }
    if (level === 'Priority') return '#f59e0b';
    return '#10b981';
  }

  function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  function pushAlert(alert) {
    if (!alert || !alert.id) return;

    const existingIndex = alerts.findIndex(a => a.id === alert.id);
    if (existingIndex !== -1) {
      // merge update
      alerts[existingIndex] = { ...alerts[existingIndex], ...alert };
    } else {
      alerts.unshift(alert);
      if (alerts.length > 100) alerts.pop();
      const patientInfo = alert.patient && (alert.patient.name || alert.patient.id) ? (alert.patient.name || alert.patient.id) : 'Unknown';
      showToast(`${alert.level || 'Alert'}: ${patientInfo} — ${alert.reason || 'No details'}`, (alert.level === 'Emergency') ? 'error' : 'warning');
    }
    updateCounters();
    renderList();
  }

  function replaceAlerts(newAlerts) {
    alerts = Array.isArray(newAlerts) ? newAlerts.slice(0, 100) : [];
    updateCounters();
    renderList();
  }

  function clearAlertsLocal() {
    if (confirm('Are you sure you want to clear all alerts from this view?')) {
      alerts = [];
      updateCounters();
      renderList();
      showToast('Alerts cleared from view', 'info');
    }
  }

  // Fetch recent alerts using current status filter
  async function fetchRecent() {
    try {
      debugLog('fetchRecent called');

      if (alertsContainer) {
        alertsContainer.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #666;">
            <div class="spinner-border spinner-border-sm" role="status" style="margin-right: 8px;">
              <span class="visually-hidden">Loading...</span>
            </div>
            Loading alerts...
          </div>`;
      }

      const statusFilterEl = document.querySelector('.status-filter.active');
      const statusFilter = statusFilterEl ? statusFilterEl.dataset.status : 'all';
      debugLog('Fetching with filter', { statusFilter });

      // Pass null for all so API uses limit
      const passStatus = (statusFilter === 'all' || !statusFilter) ? null : statusFilter;
      const alertsData = await alertApi.getAlerts(passStatus);

      debugLog('Fetched alerts data', { count: alertsData.length, sample: alertsData[0] });

      // replace local alerts
      replaceAlerts(Array.isArray(alertsData) ? alertsData : []);

    } catch (e) {
      console.error('fetchRecent failed:', e);
      debugLog('fetchRecent error', { error: e.message, stack: e.stack });
      if (alertsContainer) {
        alertsContainer.innerHTML = `
          <div class="alert alert-danger" style="margin: 20px;">
            <strong>Failed to load alerts</strong>
            <p style="margin: 8px 0;">${escapeHtml(e.message)}</p>
            <button id="retryLoad" class="btn btn-sm btn-danger">
              <i class="bi bi-arrow-clockwise"></i> Retry
            </button>
          </div>`;
        const retryBtn = document.getElementById('retryLoad');
        if (retryBtn) retryBtn.addEventListener('click', fetchRecent);
      }
    }
  }

  // Single delegated handler for .btn-action clicks
  function handleAlertAction(event) {
    const btn = event.target.closest('.btn-action');
    if (!btn) return;

    const alertId = btn.getAttribute('data-id');
    if (!alertId) return;

    event.preventDefault();
    event.stopPropagation();

    // Disable the clicked button visually
    btn.disabled = true;
    btn.style.opacity = '0.6';

    // Determine action by presence of classList
    const isAcknowledge = btn.classList.contains('btn-acknowledge');
    const isResolve = btn.classList.contains('btn-resolve');
    const isAssign = btn.classList.contains('btn-assign');
    const isUnassign = btn.classList.contains('btn-unassign');

    const restoreBtn = () => {
      btn.disabled = false;
      btn.style.opacity = '1';
    };

    const localIndex = alerts.findIndex(a => a.id === alertId);
    const localAlert = localIndex !== -1 ? alerts[localIndex] : null;

    if (isAcknowledge) {
      alertApi.acknowledgeAlert(alertId, CURRENT_USER_ID)
        .then(updated => {
          if (localIndex !== -1) {
            alerts[localIndex] = { ...alerts[localIndex], ...updated, status: 'acknowledged' };
            updateCounters();
            renderList();
            showToast('Alert acknowledged', 'success');
          }
        })
        .catch(err => {
          showToast('Failed to acknowledge alert', 'error');
          restoreBtn();
        });
      return;
    }

    if (isResolve) {
      const notes = prompt('Add resolution notes (optional):', '');
      if (notes === null) {
        restoreBtn();
        return;
      }
      alertApi.resolveAlert(alertId, CURRENT_USER_ID, notes || '')
        .then(updated => {
          if (localIndex !== -1) {
            alerts[localIndex] = { ...alerts[localIndex], ...updated, status: 'resolved' };
            updateCounters();
            renderList();
            showToast('Alert resolved', 'success');
          }
        })
        .catch(err => {
          showToast('Failed to resolve alert', 'error');
          restoreBtn();
        });
      return;
    }

    if (isAssign) {
      alertApi.assignAlert(alertId, CURRENT_USER_ID)
        .then(updated => {
          if (localIndex !== -1) {
            alerts[localIndex] = { ...alerts[localIndex], ...updated, status: 'in_progress', assignedTo: CURRENT_USER_ID };
            updateCounters();
            renderList();
            showToast('Alert assigned to you', 'success');
          }
        })
        .catch(err => {
          showToast('Failed to assign alert', 'error');
          restoreBtn();
        });
      return;
    }

    if (isUnassign) {
      alertApi.unassignAlert(alertId, CURRENT_USER_ID)
        .then(updated => {
          if (localIndex !== -1) {
            alerts[localIndex] = { ...alerts[localIndex], ...updated, status: 'acknowledged', assignedTo: null };
            updateCounters();
            renderList();
            showToast('Alert unassigned', 'success');
          }
        })
        .catch(err => {
          showToast('Failed to unassign alert', 'error');
          restoreBtn();
        });
      return;
    }

    // If we reach here, restore the button
    restoreBtn();
  }

  // Socket event bindings (if socket available)
  if (socket) {
    socket.on('alert:new', (alert) => {
      debugLog('Received new alert via WebSocket', alert);
      pushAlert(alert);
    });

    socket.on('alert:update', (alert) => {
      debugLog('Received alert update via WebSocket', alert);
      const existingIndex = alerts.findIndex(a => a.id === alert.id);
      if (existingIndex !== -1) {
        alerts[existingIndex] = { ...alerts[existingIndex], ...alert };
        updateCounters();
        renderList();
      } else {
        // If update for unknown alert, add it
        pushAlert(alert);
      }
    });

    socket.on('alert:delete', (alertId) => {
      debugLog('Alert deleted', { alertId });
      const index = alerts.findIndex(a => a.id === alertId);
      if (index !== -1) {
        alerts.splice(index, 1);
        updateCounters();
        renderList();
      }
    });
  }

  // Delegated click handler for action buttons
  document.addEventListener('click', handleAlertAction);

  // Hook refresh/clear buttons which are likely in your page header
  const refreshBtn = document.getElementById('refreshAlertsBtn');
  const clearBtn = document.getElementById('clearAlertsBtn');

  if (refreshBtn) refreshBtn.addEventListener('click', fetchRecent);
  if (clearBtn) clearBtn.addEventListener('click', clearAlertsLocal);

  // Initial fetch and auto-refresh
  console.log('🚀 Starting initial alert fetch...');
  fetchRecent();

  // Use intervalID so consumer can clear if needed
  const intervalId = setInterval(fetchRecent, 30000);

  addStyles();

  console.log('✓ Alert engine initialized successfully');

  // Return an object for debugging if needed
  return { fetchRecent, pushAlert, replaceAlerts, clearAlertsLocal, intervalId };
}

// Add some basic styles (completed)
function addStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .alert-card { transition: all 0.15s ease; }
    .alert-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
    .btn-action {
      font-size: 0.85rem;
      padding: 6px 10px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .btn-action:disabled { cursor: not-allowed; opacity: 0.6; }
    .status-badge { display:inline-block; vertical-align: middle; }
    .assigned-badge { background: rgba(0,0,0,0.03); padding: 4px 8px; border-radius: 10px; font-size:0.75rem; }
    .toast-notification { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
    .spinner-border { display: inline-block; width: 1rem; height: 1rem; border: 2px solid rgba(0,0,0,0.08); border-right-color: rgba(0,0,0,0.3); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    /* small responsive fix */
    @media (max-width: 640px) {
      .alert-card { padding: 10px; }
      .alert-actions { flex-direction: column; align-items: stretch; }
      .btn-action { width: 100%; justify-content: center; }
    }
  `;
  document.head.appendChild(style);
}

// Auto init on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
