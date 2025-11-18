// src/alerts/alertEngine.js - Core alert detection, classification, and emission
// Exports: evaluateAndEmitAlert() - Main entry point for alert evaluation

const { callGroq } = require('../lib/groqClient');
const alertStore = require('./alertStore');
const { v4: uuidv4 } = require('uuid');

const COOLDOWN_MS = 1000 * 60 * 5; // 5 minutes cooldown per patient per level

// Message classification prompts
const CLASSIFICATION_SYSTEM_PROMPT = `You are a clinical triage assistant. Classify the patient's message into exactly one of: Emergency, Priority, Normal.

Output ONLY valid JSON with this structure:

{"label": "Emergency"|"Priority"|"Normal", "reason": "<one-line justification with specific symptoms>"}

Do not include markdown formatting or explanations.`;

const CLASSIFICATION_USER_PROMPT = (message) => `Message: "${message}"

Classification guidelines:
- Emergency: Life-threatening symptoms (severe bleeding, chest pain, difficulty breathing, loss of consciousness, severe allergic reaction)
- Priority: Concerning symptoms needing attention within 24h (fever with wound drainage, moderate pain, signs of infection)
- Normal: Mild symptoms, questions, routine concerns

Examples:
1) "I'm coughing up blood" -> {"label":"Emergency","reason":"Hemoptysis indicates potential internal bleeding"}
2) "My surgical wound is red and draining yellow fluid, temp 38.8°C" -> {"label":"Priority","reason":"Signs of surgical site infection with fever"}
3) "I have a mild sore throat" -> {"label":"Normal","reason":"Minor symptom, no urgent intervention needed"}

Classify the message above and return JSON only.`;

/**
 * Sanitize message to remove PII (emails, phones, SSNs)
 * @param {string} message - Raw message text
 * @returns {string} Sanitized message
 */
function sanitizeMessage(message) {
  if (!message || typeof message !== 'string') return '';
  
  let sanitized = String(message);
  
  // Remove emails
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  
  // Remove phone numbers
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
  
  // Remove SSNs
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
  
  return sanitized.trim();
}

/**
 * Check immediate rule-based emergency conditions
 * @param {Object} ruleResult - Rule result object (may contain vitals in breakdown or separate)
 * @param {Object} llmParsed - LLM parsed data
 * @param {string} message - Patient message
 * @param {Object} mergedVitals - Merged vitals from upload route (optional)
 * @returns {Object|null} { level: 'Emergency', reason: string } or null
 */
function checkImmediateRules(ruleResult, llmParsed, message, mergedVitals) {
  try {
    // Extract vitals - try multiple sources
    const vitals = mergedVitals || ruleResult?.vitals || llmParsed?.vitals || {};
    const tempC = vitals.tempC;
    const spo2 = vitals.spo2;
    const bp = vitals.bp;
    const hr = vitals.hr;
    
    // Check temperature
    if (typeof tempC === 'number' && tempC >= 38.5) {
      return { level: 'Emergency', reason: `High fever ≥38.5°C (${tempC}°C)` };
    }
    
    // Check SpO2
    if (typeof spo2 === 'number' && spo2 < 90) {
      return { level: 'Emergency', reason: `Critical oxygen saturation <90% (${spo2}%)` };
    }
    
    // Check blood pressure
    if (bp && typeof bp.sys === 'number' && bp.sys < 90) {
      return { level: 'Emergency', reason: `Hypotension: SBP <90 mmHg (${bp.sys} mmHg)` };
    }
    
    // Check heart rate
    if (typeof hr === 'number' && (hr > 140 || hr < 40)) {
      return { level: 'Emergency', reason: `Critical heart rate (HR: ${hr} bpm)` };
    }
    
    // Check message for bleeding keywords
    if (message && typeof message === 'string') {
      const bleedingMatch = message.match(/uncontrolled bleeding|severe bleeding|active bleeding/i);
      if (bleedingMatch) {
        return { level: 'Emergency', reason: 'Active bleeding reported' };
      }
    }
    
    return null;
  } catch (err) {
    console.warn('alertEngine: checkImmediateRules error', err && err.message);
    return null;
  }
}

/**
 * Classify message using LLM
 * @param {string} message - Sanitized message
 * @returns {Promise<Object>} { label: string, reason: string }
 */
async function classifyMessageLLM(message) {
  if (!message || !String(message).trim()) {
    return { label: 'Normal', reason: '' };
  }
  
  try {
    const fullPrompt = `${CLASSIFICATION_SYSTEM_PROMPT}\n\n${CLASSIFICATION_USER_PROMPT(message)}`;
    const response = await callGroq(fullPrompt);
    const text = String((response && response.text) ? response.text : '').trim();
    
    // Try to parse JSON
    try {
      // Remove markdown code blocks if present
      let jsonText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      const parsed = JSON.parse(jsonText);
      const label = String(parsed.label || 'Normal').trim();
      const reason = String(parsed.reason || '').trim();
      
      // Normalize label
      let normalizedLabel = 'Normal';
      if (label.toLowerCase().startsWith('e')) normalizedLabel = 'Emergency';
      else if (label.toLowerCase().startsWith('p')) normalizedLabel = 'Priority';
      
      return { label: normalizedLabel, reason: reason || 'LLM classification' };
    } catch (parseErr) {
      // Fallback: try to extract label from text
      const lower = text.toLowerCase();
      if (lower.includes('emergency')) {
        return { label: 'Emergency', reason: text.slice(0, 200) };
      }
      if (lower.includes('priority')) {
        return { label: 'Priority', reason: text.slice(0, 200) };
      }
      return { label: 'Normal', reason: text.slice(0, 200) };
    }
  } catch (err) {
    console.error('alertEngine: classifyMessageLLM failed', err && err.message);
    return { label: 'Normal', reason: '' };
  }
}

/**
 * Check cooldown for patient/level combination
 * @param {string} patientId - Patient ID
 * @param {string} level - Alert level
 * @returns {boolean} True if within cooldown
 */
function isWithinCooldown(patientId, level) {
  if (!patientId || !level) return false;
  
  try {
    const recentAlerts = alertStore.getRecentForPatient(patientId, 20);
    const now = Date.now();
    
    // Check if any alert of same level exists within cooldown window
    for (const alert of recentAlerts) {
      if (alert.level === level) {
        const alertTime = new Date(alert.timestamp).getTime();
        const diff = now - alertTime;
        if (diff < COOLDOWN_MS && diff >= 0) {
          return true;
        }
      }
    }
    
    return false;
  } catch (err) {
    console.warn('alertEngine: isWithinCooldown error', err && err.message);
    return false;
  }
}

/**
 * Main alert evaluation and emission function
 * @param {Object} params - Evaluation parameters
 * @param {Object} params.req - Express request (optional)
 * @param {Object} params.io - Socket.IO instance (optional)
 * @param {Object} params.patient - Patient object {id, name}
 * @param {Object} params.ruleResult - Rule result {rule_score, rule_label, breakdown}
 * @param {Object} params.llmParsed - LLM parsed data (optional)
 * @param {Object} params.vitals - Vitals object (optional, for immediate rule checks)
 * @param {string} params.message - Patient message (optional)
 * @param {string} params.timestamp - ISO timestamp (optional)
 * @returns {Promise<Object|null>} Alert object or null
 */
async function evaluateAndEmitAlert({ req, io, patient, ruleResult, llmParsed, vitals, message, timestamp } = {}) {
  try {
    // Step 1: Normalize inputs
    if (!patient || !patient.id) {
      console.warn('alertEngine: missing patient.id, skipping evaluation');
      return null;
    }
    
    const patientId = String(patient.id);
    // Ensure name is properly extracted - check multiple sources
    let patientName = 'Unknown Patient';
    if (patient.name && String(patient.name).trim()) {
      patientName = String(patient.name).trim();
    } else if (patient.patientName && String(patient.patientName).trim()) {
      patientName = String(patient.patientName).trim();
    }
    
    console.log('alertEngine: normalized patient:', { id: patientId, name: patientName });
    const normalizedRuleResult = ruleResult || {};
    const normalizedLLMParsed = llmParsed || {};
    const normalizedMessage = message ? String(message).trim() : '';
    const normalizedTimestamp = timestamp || new Date().toISOString();
    
    // Get Socket.IO instance if not provided
    if (!io && req && req.app && req.app.get) {
      try {
        io = req.app.get('io');
      } catch (e) {
        // io not available, continue without it
      }
    }
    
    console.log(`alertEngine: evaluating patient [${patientId}]`);
    console.log(`alertEngine: ruleResult=`, { 
      rule_score: normalizedRuleResult.rule_score, 
      rule_label: normalizedRuleResult.rule_label,
      breakdown: normalizedRuleResult.breakdown?.slice(0, 3) 
    });
    
    // Step 2: Cooldown check (check before processing)
    // We'll check cooldown after determining the level
    
    // Step 3: Immediate rule checks
    // Extract vitals from passed vitals param, ruleResult, or llmParsed
    const vitalsForRules = vitals || normalizedRuleResult?.vitals || normalizedLLMParsed?.vitals || {};
    const immediateRule = checkImmediateRules(normalizedRuleResult, normalizedLLMParsed, normalizedMessage, vitalsForRules);
    
    if (immediateRule && immediateRule.level === 'Emergency') {
      // Check cooldown for Emergency
      if (isWithinCooldown(patientId, 'Emergency')) {
        console.log(`alertEngine: cooldown active, skipping duplicate Emergency alert for patient ${patientId}`);
        // Return existing alert if available
        const existing = alertStore.getRecentForPatient(patientId, 1).find(a => a.level === 'Emergency');
        return existing || null;
      }
      
      const alert = {
        id: uuidv4(),
        level: 'Emergency',
        patient: { id: patientId, name: patientName },
        reason: immediateRule.reason,
        score: normalizedRuleResult.rule_score || null,
        source: 'rules',
        timestamp: normalizedTimestamp
      };
      
      const saved = alertStore.pushAlert(alert);
      
      // Emit via Socket.IO
      if (io) {
        try {
          io.emit('alert:new', saved);
          console.log(`alertEngine: emitted alert [${saved.id}] level=Emergency patient=[${patientId}] source=rules`);
        } catch (emitErr) {
          console.warn('alertEngine: Socket.IO emit failed', emitErr && emitErr.message);
        }
      }
      
      return saved;
    }
    
    // Step 4 & 5: Determine alert level based on RULE SCORE (primary) and optionally LLM classification (for reason only)
    // Rule score is the primary determinant of alert level
    const ruleScore = normalizedRuleResult.rule_score || 0;
    let level = 'Normal';
    let source = 'rules';
    let reason = '';
    
    // Build patient-specific reason from rule breakdown
    const breakdown = normalizedRuleResult.breakdown || [];
    const topFactors = breakdown.slice(0, 2).join(', ');
    
    // Determine alert level based on rule score (PRIMARY)
    // Score 0-3: Low risk = Normal
    // Score 4-9: Medium risk = Priority (needs attention)
    // Score 10-15: High risk = Priority (urgent)
    // Score 16+: Very high risk = Emergency (critical)
    if (ruleScore >= 16) {
      level = 'Emergency';
      reason = topFactors ? `Critical risk: ${topFactors}` : `Critical risk score (${ruleScore}/20)`;
      source = 'rules';
      
      // Check cooldown
      if (isWithinCooldown(patientId, 'Emergency')) {
        console.log(`alertEngine: cooldown active, skipping duplicate Emergency alert for patient ${patientId}`);
        const existing = alertStore.getRecentForPatient(patientId, 1).find(a => a.level === 'Emergency');
        return existing || null;
      }
    } else if (ruleScore >= 10) {
      level = 'Priority';
      reason = topFactors ? `High risk: ${topFactors}` : `High risk score (${ruleScore}/20)`;
      source = 'rules';
      
      // Check cooldown
      if (isWithinCooldown(patientId, 'Priority')) {
        console.log(`alertEngine: cooldown active, skipping duplicate Priority alert for patient ${patientId}`);
        const existing = alertStore.getRecentForPatient(patientId, 1).find(a => a.level === 'Priority');
        return existing || null;
      }
    } else if (ruleScore >= 4) {
      level = 'Priority';
      reason = topFactors ? `Moderate risk: ${topFactors}` : `Medium risk score (${ruleScore}/20)`;
      source = 'rules';
      
      // Check cooldown for Priority
      if (isWithinCooldown(patientId, 'Priority')) {
        console.log(`alertEngine: cooldown active, skipping duplicate Priority alert for patient ${patientId}`);
        const existing = alertStore.getRecentForPatient(patientId, 1).find(a => a.level === 'Priority');
        return existing || null;
      }
    } else {
      level = 'Normal';
      reason = topFactors ? `Low risk: ${topFactors}` : `Low risk score (${ruleScore}/20)`;
      source = 'rules';
    }
    
    // If message is present, optionally enhance reason with LLM classification (but don't change level)
    if (normalizedMessage && level !== 'Emergency') {
      // Only use LLM to enhance reason for Priority/Normal alerts, not to change level
      try {
        const sanitized = sanitizeMessage(normalizedMessage);
        const llmClassification = await classifyMessageLLM(sanitized);
        
        // Enhance reason with LLM insight if available, but keep the rule-based level
        if (llmClassification.reason && llmClassification.reason.trim()) {
          // Append LLM insight to reason, but level stays based on rule score
          reason = `${reason} | ${llmClassification.reason}`;
          source = 'fusion'; // Indicate it's a combination
        }
      } catch (llmErr) {
        // Ignore LLM errors, use rule-based reason only
        console.warn('alertEngine: LLM classification failed, using rule-based reason only', llmErr && llmErr.message);
      }
    }
    
    const alert = {
      id: uuidv4(),
      level,
      patient: { id: patientId, name: patientName },
      reason,
      score: ruleScore,
      source,
      timestamp: normalizedTimestamp
    };
    
    console.log(`alertEngine: creating alert with level=${level}, score=${ruleScore}, reason=${reason.substring(0, 50)}`);
    
    const saved = alertStore.pushAlert(alert);
    
    if (io) {
      try {
        io.emit('alert:new', saved);
        console.log(`alertEngine: emitted alert [${saved.id}] level=${saved.level} patient=[${patientId}] source=${source} score=${ruleScore}`);
      } catch (emitErr) {
        console.warn('alertEngine: Socket.IO emit failed', emitErr && emitErr.message);
      }
    }
    
    return saved;
    
  } catch (err) {
    console.error('alertEngine: evaluateAndEmitAlert error', err && err.message, err && err.stack);
    // Never throw - return null on error
    return null;
  }
}

module.exports = {
  evaluateAndEmitAlert
};
