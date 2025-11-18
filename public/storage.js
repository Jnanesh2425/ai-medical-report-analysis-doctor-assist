// public/storage.js - Local storage management for patients and reports

const STORAGE_KEY_PATIENTS = 'postop_patients';
const STORAGE_KEY_REPORTS = 'postop_reports';

/**
 * Save patient report to local storage
 * @param {Object} reportData - Report data from upload/analysis
 */
function savePatientReport(reportData) {
  try {
    const patient = reportData.patient || {};
    const patientId = patient.id || `patient_${Date.now()}`;
    // Ensure name is properly extracted
    let patientName = 'Unknown Patient';
    if (patient.name && String(patient.name).trim()) {
      patientName = String(patient.name).trim();
    }
    
    console.log('storage: saving patient report:', { id: patientId, name: patientName });
    
    // Get existing reports
    const reports = getStoredReports();
    
    // Create or update patient record
    const patientRecord = {
      id: patientId,
      name: patientName,
      age: patient.age || null,
      sex: patient.sex || null,
      lastUpdated: new Date().toISOString(),
      lastReport: reportData
    };
    
    // Save patient
    const patients = getStoredPatients();
    const existingIndex = patients.findIndex(p => p.id === patientId);
    if (existingIndex >= 0) {
      patients[existingIndex] = { ...patients[existingIndex], ...patientRecord };
    } else {
      patients.push(patientRecord);
    }
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
    
    // Save report with timestamp
    const reportEntry = {
      id: `report_${Date.now()}`,
      patientId: patientId,
      timestamp: new Date().toISOString(),
      data: reportData
    };
    reports.push(reportEntry);
    
    // Keep only last 100 reports per patient
    const patientReports = reports.filter(r => r.patientId === patientId);
    if (patientReports.length > 100) {
      const toRemove = patientReports.slice(0, patientReports.length - 100);
      toRemove.forEach(r => {
        const index = reports.findIndex(report => report.id === r.id);
        if (index >= 0) reports.splice(index, 1);
      });
    }
    
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(reports));
    
    console.log('Saved patient report to local storage:', patientId);
    return patientRecord;
  } catch (err) {
    console.error('Failed to save patient report:', err);
    return null;
  }
}

/**
 * Get all stored patients
 * @returns {Array} Array of patient records
 */
function getStoredPatients() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PATIENTS);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('Failed to get stored patients:', err);
    return [];
  }
}

/**
 * Get all stored reports
 * @returns {Array} Array of report entries
 */
function getStoredReports() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_REPORTS);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('Failed to get stored reports:', err);
    return [];
  }
}

/**
 * Get reports for a specific patient
 * @param {string} patientId - Patient ID
 * @returns {Array} Array of reports for patient
 */
function getPatientReports(patientId) {
  const reports = getStoredReports();
  return reports.filter(r => r.patientId === patientId).sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
}

/**
 * Get latest report for a patient
 * @param {string} patientId - Patient ID
 * @returns {Object|null} Latest report or null
 */
function getLatestPatientReport(patientId) {
  const reports = getPatientReports(patientId);
  return reports.length > 0 ? reports[0].data : null;
}

/**
 * Delete a patient and all their reports
 * @param {string} patientId - Patient ID
 */
function deletePatient(patientId) {
  try {
    const patients = getStoredPatients();
    const filtered = patients.filter(p => p.id !== patientId);
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(filtered));
    
    const reports = getStoredReports();
    const filteredReports = reports.filter(r => r.patientId !== patientId);
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(filteredReports));
    
    return true;
  } catch (err) {
    console.error('Failed to delete patient:', err);
    return false;
  }
}

/**
 * Clear all stored data
 */
function clearAllStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY_PATIENTS);
    localStorage.removeItem(STORAGE_KEY_REPORTS);
    return true;
  } catch (err) {
    console.error('Failed to clear storage:', err);
    return false;
  }
}

// Make functions available globally
window.storage = {
  savePatientReport,
  getStoredPatients,
  getStoredReports,
  getPatientReports,
  getLatestPatientReport,
  deletePatient,
  clearAllStorage
};

