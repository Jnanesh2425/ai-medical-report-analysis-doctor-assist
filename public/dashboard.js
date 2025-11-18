// public/dashboard.js - Dashboard functionality

let patientsMap = new Map(); // patientId -> { latest alert, risk level, lastUpdate, alerts, report }
let sortBy = 'risk';

// Load dashboard data
async function loadDashboard() {
  try {
    // Load patients from local storage
    if (window.storage) {
      const storedPatients = window.storage.getStoredPatients();
      storedPatients.forEach(patient => {
        const latestReport = patient.lastReport;
        if (latestReport) {
          const riskLevel = getRiskLevelFromReport(latestReport);
          // Ensure name is properly extracted
          const patientName = (patient.name && String(patient.name).trim()) 
                            || (latestReport.patient?.name && String(latestReport.patient.name).trim())
                            || 'Unknown Patient';
          
          patientsMap.set(patient.id, {
            id: patient.id,
            name: patientName,
            age: patient.age,
            sex: patient.sex,
            riskLevel: riskLevel,
            lastUpdate: new Date(patient.lastUpdated),
            report: latestReport,
            alerts: []
          });
        }
      });
    }
    
    // Fetch recent alerts and merge with patient data
    try {
      const alertsRes = await fetch('/api/alerts?limit=100');
      const alertsData = await alertsRes.json();
      
      if (alertsData.ok && Array.isArray(alertsData.alerts)) {
        processAlerts(alertsData.alerts);
      }
    } catch (err) {
      console.warn('Failed to fetch alerts:', err);
    }
    
    updateDashboard();
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// Get risk level from report
function getRiskLevelFromReport(report) {
  if (!report) return 'Low';
  const finalLabel = report.final_label || report.rule?.rule_label || 'Low';
  if (finalLabel === 'Critical' || finalLabel === 'High') return 'High';
  if (finalLabel === 'Medium') return 'Medium';
  return 'Low';
}

// Process alerts to build patient map (merge with existing patients)
function processAlerts(alerts) {
  alerts.forEach(alert => {
    const patientId = alert.patient?.id || 'unknown';
    const patientName = alert.patient?.name || 'Unknown Patient';
    
    if (!patientsMap.has(patientId)) {
      // Create new patient entry from alert
      patientsMap.set(patientId, {
        id: patientId,
        name: patientName,
        latestAlert: alert,
        riskLevel: mapAlertLevelToRisk(alert.level),
        lastUpdate: new Date(alert.timestamp),
        alerts: [],
        report: null
      });
    }
    
    const patient = patientsMap.get(patientId);
    patient.alerts.push(alert);
    
    // Update if this alert is newer
    const alertTime = new Date(alert.timestamp);
    if (alertTime > patient.lastUpdate) {
      patient.lastUpdate = alertTime;
      patient.latestAlert = alert;
      // Only update risk from alert if we don't have a report
      if (!patient.report) {
        patient.riskLevel = mapAlertLevelToRisk(alert.level);
      }
    }
  });
}

// Map alert level to risk level
function mapAlertLevelToRisk(alertLevel) {
  if (alertLevel === 'Emergency') return 'High';
  if (alertLevel === 'Priority') return 'Medium';
  return 'Low';
}

// Update dashboard UI
function updateDashboard() {
  updateRiskCards();
  updatePatientList();
  updateDashboardAlerts();
}

// Update risk summary cards
function updateRiskCards() {
  const patients = Array.from(patientsMap.values());
  const highRisk = patients.filter(p => p.riskLevel === 'High').length;
  const mediumRisk = patients.filter(p => p.riskLevel === 'Medium').length;
  const lowRisk = patients.filter(p => p.riskLevel === 'Low').length;
  
  document.getElementById('high-risk-count').textContent = highRisk;
  document.getElementById('medium-risk-count').textContent = mediumRisk;
  document.getElementById('low-risk-count').textContent = lowRisk;
  
  // Update trend (simplified - could be enhanced with historical data)
  const highRiskTrend = document.getElementById('high-risk-trend');
  if (highRiskTrend) {
    highRiskTrend.textContent = `${highRisk} new since yesterday`;
  }
}

// Update patient list
function updatePatientList() {
  const tbody = document.getElementById('patient-list-body');
  if (!tbody) return;
  
  let patients = Array.from(patientsMap.values());
  
  // Sort patients
  if (sortBy === 'risk') {
    const riskOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
    patients.sort((a, b) => {
      const aRisk = riskOrder[a.riskLevel] ?? 3;
      const bRisk = riskOrder[b.riskLevel] ?? 3;
      if (aRisk !== bRisk) return aRisk - bRisk;
      return b.lastUpdate - a.lastUpdate; // Newest first within same risk
    });
  } else if (sortBy === 'name') {
    patients.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  if (patients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No patients yet. Add a patient in the Post Op Score tab.</td></tr>';
    return;
  }
  
  tbody.innerHTML = patients.map(patient => {
    const timeAgo = getTimeAgo(patient.lastUpdate);
    const latestAlertReason = patient.latestAlert?.reason || (patient.report ? 'Report available' : 'No alerts');
    const status = getPatientStatus(patient.riskLevel);
    
    return `
      <tr>
        <td><strong>${escapeHtml(patient.name)}</strong></td>
        <td><span class="risk-badge ${patient.riskLevel.toLowerCase()}">${patient.riskLevel}</span></td>
        <td>${timeAgo}</td>
        <td>${escapeHtml(latestAlertReason.substring(0, 30))}${latestAlertReason.length > 30 ? '...' : ''}</td>
        <td><span class="status-badge ${status.class}">${status.text}</span></td>
        <td><button class="btn-view-details" onclick="viewPatientDetails('${escapeHtml(patient.id)}')">View Details</button></td>
      </tr>
    `;
  }).join('');
}

// Get patient status
function getPatientStatus(riskLevel) {
  if (riskLevel === 'High') {
    return { class: 'needs-review', text: 'Needs Review' };
  } else if (riskLevel === 'Medium') {
    return { class: 'monitor', text: 'Monitor' };
  } else {
    return { class: 'stable', text: 'Stable' };
  }
}

// Update dashboard alerts panel
function updateDashboardAlerts() {
  const alertsList = document.getElementById('dashboard-alerts-list');
  if (!alertsList) return;
  
  const patients = Array.from(patientsMap.values());
  const recentAlerts = patients
    .flatMap(p => p.alerts.slice(0, 3)) // Get up to 3 alerts per patient
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10); // Show top 10 most recent
  
  alertsList.innerHTML = recentAlerts.map(alert => {
    const timeAgo = getTimeAgo(new Date(alert.timestamp));
    const levelClass = alert.level.toLowerCase();
    
    // Extract patient name with proper fallbacks
    let patientName = 'Unknown';
    if (alert.patient?.name && String(alert.patient.name).trim()) {
      patientName = String(alert.patient.name).trim();
    } else if (alert.patient?.id && String(alert.patient.id).trim()) {
      patientName = String(alert.patient.id).trim();
    }
    
    return `
      <div class="alert-item ${levelClass}">
        <div class="alert-level">${alert.level} Alert</div>
        <div class="alert-reason">${escapeHtml(alert.reason || '')}</div>
        <div class="alert-patient">Patient: ${escapeHtml(patientName)}</div>
        <div class="alert-time">🕐 ${timeAgo}</div>
      </div>
    `;
  }).join('');
  
  if (recentAlerts.length === 0) {
    alertsList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No alerts yet</p>';
  }
}

// Get time ago string
function getTimeAgo(date) {
  if (!date || isNaN(date.getTime())) return 'Unknown';
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'Just now'; // Future date
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// View patient details - navigate to Post Op Score tab
function viewPatientDetails(patientId) {
  if (window.switchTab) {
    window.switchTab('postop');
    // Set patient ID in the form
    const patientIdInput = document.getElementById('patientId');
    if (patientIdInput) {
      patientIdInput.value = patientId;
    }
    // Update URL
    window.history.pushState({}, '', `?patientId=${encodeURIComponent(patientId)}`);
  }
}

// Sort button handlers
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sortBy = btn.getAttribute('data-sort');
      updatePatientList();
    });
  });
});

// Helper function
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Make loadDashboard available globally
window.loadDashboard = loadDashboard;

// Listen for real-time alerts via Socket.IO
if (window.io) {
  const socket = io();
  socket.on('alert:new', (alert) => {
    // Add alert to patient map
    const patientId = alert.patient?.id || 'unknown';
    if (!patientsMap.has(patientId)) {
      // Try to get patient from storage
      let patientData = null;
      if (window.storage) {
        const storedPatients = window.storage.getStoredPatients();
        patientData = storedPatients.find(p => p.id === patientId);
      }
      
      // Ensure name is properly extracted from multiple sources
      let patientName = 'Unknown Patient';
      if (alert.patient?.name && String(alert.patient.name).trim()) {
        patientName = String(alert.patient.name).trim();
      } else if (patientData?.name && String(patientData.name).trim()) {
        patientName = String(patientData.name).trim();
      } else if (patientData?.lastReport?.patient?.name && String(patientData.lastReport.patient.name).trim()) {
        patientName = String(patientData.lastReport.patient.name).trim();
      }
      
      patientsMap.set(patientId, {
        id: patientId,
        name: patientName,
        latestAlert: alert,
        riskLevel: mapAlertLevelToRisk(alert.level),
        lastUpdate: new Date(alert.timestamp),
        alerts: [alert],
        report: patientData?.lastReport || null
      });
    } else {
      const patient = patientsMap.get(patientId);
      patient.alerts.unshift(alert);
      if (patient.alerts.length > 10) patient.alerts.pop();
      
      const alertTime = new Date(alert.timestamp);
      if (alertTime > patient.lastUpdate) {
        patient.lastUpdate = alertTime;
        patient.latestAlert = alert;
        // Only update risk from alert if we don't have a report
        if (!patient.report) {
          patient.riskLevel = mapAlertLevelToRisk(alert.level);
        }
      }
    }
    
    // Update dashboard if it's active
    const dashboardTab = document.getElementById('dashboard-tab');
    if (dashboardTab && dashboardTab.classList.contains('active')) {
      updateDashboard();
    }
  });
}

// Listen for storage events (when patient is added in another tab)
window.addEventListener('storage', (e) => {
  if (e.key === 'postop_patients' || e.key === 'postop_reports') {
    const dashboardTab = document.getElementById('dashboard-tab');
    if (dashboardTab && dashboardTab.classList.contains('active')) {
      loadDashboard();
    }
  }
});

// Also listen for custom event when patient is added in same tab
window.addEventListener('patientAdded', () => {
  const dashboardTab = document.getElementById('dashboard-tab');
  if (dashboardTab && dashboardTab.classList.contains('active')) {
    loadDashboard();
  }
});

// Auto-refresh dashboard every 30 seconds
setInterval(() => {
  const dashboardTab = document.getElementById('dashboard-tab');
  if (dashboardTab && dashboardTab.classList.contains('active')) {
    loadDashboard();
  }
}, 30000);

