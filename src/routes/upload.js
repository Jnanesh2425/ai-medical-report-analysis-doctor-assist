// src/routes/upload.js
// Robust upload route: file OR manual fields, Groq call, parse + merge, safe output
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { extractTextFromPDF } = require('../parsers/pdfParser');
const { extractTextFromDocx } = require('../parsers/docxParser');

// ruleScorer exports: extractVitalsAndMetadata, computeRuleScore, parseLLMResponseImproved, generateAssessmentReport, formatReportForDisplay
const {
  extractVitalsAndMetadata,
  computeRuleScore,
  parseLLMResponseImproved,
  generateAssessmentReport,
  formatReportForDisplay
} = require('../rules/ruleScorer');

const { callGroq, buildPrompt } = require('../lib/groqClient');

const router = express.Router();

// configure multer to save uploaded files to /uploads
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/[^\w.-]/g, '_');
    cb(null, safe);
  }
});

const upload = multer({ storage, limits: { fileSize: 32 * 1024 * 1024 } }); // 32 MB

// Helper: merge manual fields (from req.body) into parsed vitals.
// Manual inputs override parsed values.
function mergeUserInputs(parsed = {}, body = {}) {
  const out = Object.assign({}, parsed); // shallow copy

  // patient info - prioritize manual input over parsed
  out._patient = {
    id: body.patientId || body.patientID || body.patient_id || (parsed._patient?.id) || null,
    name: (body.patientName && body.patientName.trim()) || (parsed._patient?.name) || null,
    age: body.age ? Number(body.age) : (parsed.age || parsed._patient?.age || null),
    sex: body.sex || (parsed._patient?.sex) || null
  };

  // manual temp (accept "98.2 F" or "36.7 C" or just a number)
  if (body.tempManual) {
    const tmp = String(body.tempManual).trim();
    const m = tmp.match(/([0-9.]+)\s*°?\s*([CFcf])?/);
    if (m) {
      let val = Number(m[1]);
      const unit = m[2] ? m[2].toUpperCase() : null;
      if (unit === 'F') val = (val - 32) * 5/9;
      else if (!unit && val >= 45) val = (val - 32) * 5/9; // assume F when large
      out.tempC = Math.round(val * 10) / 10;
      out.tempRaw = Number(m[1]);
      out.tempUnit = unit || (val >= 45 ? 'F' : 'C');
    }
  }

  if (body.hrManual) out.hr = Number(body.hrManual);
  if (body.rrManual) out.rr = Number(body.rrManual);

  if (body.bpManual) {
    const bpm = String(body.bpManual).match(/([0-9]{2,3})\/([0-9]{2,3})/);
    if (bpm) out.bp = { sys: Number(bpm[1]), dia: Number(bpm[2]) };
  }

  if (body.spo2Manual) out.spo2 = Number(body.spo2Manual);

  // optional free-text from the user to supplement/explain
  if (body.freeText) {
    out.notes = (out.notes ? out.notes + '\n' : '') + String(body.freeText);
  }

  return out;
}

// small helper: try parse JSON from text, else return null
function tryParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    const obj = JSON.parse(text);
    return obj;
  } catch (e) {
    return null;
  }
}

// Create a short synthesized clinical summary from available pieces
function synthesizeClinicalSummary({ llmParsed = {}, ruleResult = {}, parsedVitals = {} } = {}) {
  // Prefer direct LLM clinical_summary if present
  if (llmParsed && llmParsed.clinical_summary && String(llmParsed.clinical_summary).trim()) {
    return String(llmParsed.clinical_summary).trim();
  }

  // Otherwise build concise 1-2 sentence summary from top reasons or rule breakdown and vitals
  const reasons = (Array.isArray(llmParsed.primary_concerns) && llmParsed.primary_concerns.length)
    ? llmParsed.primary_concerns.slice(0,3)
    : (Array.isArray(llmParsed.top_reasons) && llmParsed.top_reasons.length)
      ? llmParsed.top_reasons.slice(0,3)
      : (Array.isArray(ruleResult.breakdown) && ruleResult.breakdown.length)
        ? ruleResult.breakdown.slice(0,3)
        : [];

  const vitStrParts = [];
  if (parsedVitals && parsedVitals.bp && parsedVitals.bp.sys != null) vitStrParts.push(`BP ${parsedVitals.bp.sys}/${parsedVitals.bp.dia || ''} mmHg`);
  if (parsedVitals && parsedVitals.tempC != null) vitStrParts.push(`Temp ${parsedVitals.tempC}°C`);
  if (parsedVitals && parsedVitals.hr != null) vitStrParts.push(`HR ${parsedVitals.hr} bpm`);
  if (parsedVitals && parsedVitals.rr != null) vitStrParts.push(`RR ${parsedVitals.rr} /min`);
  if (parsedVitals && parsedVitals.spo2 != null) vitStrParts.push(`SpO2 ${parsedVitals.spo2}%`);

  const reasonsPart = reasons.length ? `Primary concerns: ${reasons.join('; ')}.` : '';
  const vitPart = vitStrParts.length ? ` Current vitals — ${vitStrParts.join(', ')}.` : '';

  const base = reasonsPart + vitPart;
  if (base.trim()) {
    // Keep it concise
    return base.length > 220 ? base.slice(0, 217) + '...' : base;
  }

  // final fallback
  return `Rule-based score: ${ruleResult.rule_label || 'Unknown'}. Monitor vitals and escalate on red flags.`;
}

// POST /api/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const hasFile = !!req.file;
    const hasFields = req.body && Object.keys(req.body).length > 0;

    if (!hasFile && !hasFields) {
      return res.status(400).json({ error: 'Provide a file or form fields (patient/vitals).' });
    }

    // --- Step 1: extract text (if file)
    let extractedText = '';
    const parseErrors = [];

    if (hasFile) {
      const filePath = req.file.path;
      const ext = path.extname(filePath).toLowerCase();

      try {
        if (ext === '.pdf') {
          extractedText = await extractTextFromPDF(filePath);
        } else if (ext === '.docx' || ext === '.doc') {
          extractedText = await extractTextFromDocx(filePath);
        } else if (ext === '.txt') {
          extractedText = fs.readFileSync(filePath, 'utf8');
        } else {
          // fallback chain: docx -> pdf -> raw text
          try {
            extractedText = await extractTextFromDocx(filePath);
          } catch (errDoc) {
            parseErrors.push({ parser: 'docxParser', message: String(errDoc.message || errDoc) });
            try {
              extractedText = await extractTextFromPDF(filePath);
            } catch (errPdf) {
              parseErrors.push({ parser: 'pdfParser', message: String(errPdf.message || errPdf) });
              try {
                extractedText = fs.readFileSync(filePath, 'utf8');
              } catch (errRaw) {
                parseErrors.push({ parser: 'rawText', message: String(errRaw.message || errRaw) });
                extractedText = '';
              }
            }
          }
        }
      } catch (e) {
        parseErrors.push({ parser: 'extract', message: String(e.message || e) });
        extractedText = '';
      }
    }

    extractedText = (extractedText || '').replace(/\r/g, '');

    // --- Step 2: extract vitals/metadata from text (if any)
    const vitalsFromText = extractedText ? extractVitalsAndMetadata(extractedText) : {};

    // --- Step 3: merge manual user inputs (override parsed)
    const mergedVitals = mergeUserInputs(vitalsFromText, req.body || {});

    // compute rule score from merged vitals
    const ruleResult = computeRuleScore(mergedVitals);

    // build prompt for Groq/LLM (include available text + vitals summary)
    const prompt = buildPrompt({
      dischargeText: (extractedText || '').slice(0, 20_000),
      vitalsSummary: mergedVitals,
      rule_score: ruleResult.rule_score
    });

    // call Groq
    let groqResp;
    try {
      const groqContext = { ruleResult, file: (req.file && req.file.originalname) || mergedVitals._patient?.id || 'manual' };
      groqResp = await callGroq(prompt, groqContext);
    } catch (err) {
      // Return a useful error message detailing attempts if present
      if (err && err.attempts) {
        return res.status(502).json({
          error: 'Groq request failed. See attempts for details.',
          message: err.message,
          attempts: err.attempts,
          parseErrors: parseErrors.length ? parseErrors : undefined
        });
      }
      return res.status(502).json({ error: 'Groq request failed', message: err.message || String(err), parseErrors: parseErrors.length ? parseErrors : undefined });
    }

    // obtain textual output from Groq response
    const llmTextRaw = (groqResp && (groqResp.text || groqResp.raw || groqResp.output || groqResp.result))
                        ? String(groqResp.text || groqResp.raw || groqResp.output || groqResp.result).trim()
                        : '';

    // Try: if groqResp.raw looks like an object and contains JSON fields, try to reuse
    let llmParsed = {};
    try {
      // If server already returned JSON string in text, try parse it first
      const maybeJson = tryParseJson(llmTextRaw);
      if (maybeJson && typeof maybeJson === 'object') {
        // Map potential keys into expected shape
        llmParsed = {
          risk_level: maybeJson.llm_label || maybeJson.risk_level || maybeJson.llmLabel || maybeJson.label || undefined,
          confidence: maybeJson.confidence || maybeJson.confidence_level || maybeJson.conf || undefined,
          primary_concerns: maybeJson.top_reasons || maybeJson.primary_concerns || maybeJson.reasons || [],
          top_reasons: maybeJson.top_reasons || maybeJson.primary_concerns || maybeJson.reasons || [],
          clinical_summary: maybeJson.clinical_summary || maybeJson.notes || maybeJson.summary || '',
          immediate_actions: Array.isArray(maybeJson.immediate_actions) ? maybeJson.immediate_actions : (Array.isArray(maybeJson.immediateActions) ? maybeJson.immediateActions : []),
          short_term_actions: Array.isArray(maybeJson.short_term_actions) ? maybeJson.short_term_actions : (Array.isArray(maybeJson.shortTermActions) ? maybeJson.shortTermActions : []),
          monitoring_priorities: Array.isArray(maybeJson.monitoring_priorities) ? maybeJson.monitoring_priorities : (Array.isArray(maybeJson.monitoringPriorities) ? maybeJson.monitoringPriorities : []),
          escalation_criteria: Array.isArray(maybeJson.escalation_criteria) ? maybeJson.escalation_criteria : (Array.isArray(maybeJson.escalationCriteria) ? maybeJson.escalationCriteria : []),
          raw_text: llmTextRaw
        };
        // normalize via improved parser to fill other fields (if desired)
        try {
          const normalizedFromText = parseLLMResponseImproved(llmTextRaw);
          llmParsed = Object.assign({}, normalizedFromText, llmParsed);
        } catch (e) {
          // ignore parse errors here; keep llmParsed as-is
        }
      } else {
        // Not JSON: pass to the improved text parser
        llmParsed = parseLLMResponseImproved(llmTextRaw);
        // ensure we keep raw text
        llmParsed.raw_text = llmTextRaw;
        // If text parser didn't extract lists but model returned bullet lists in text, attempt light extraction
        if ((!llmParsed.primary_concerns || !llmParsed.primary_concerns.length) && llmTextRaw) {
          const lines = llmTextRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const extracted = [];
          for (const ln of lines) {
            const m = ln.match(/^\d+\.\s*(.+)$/);
            if (m) extracted.push(m[1].trim());
            else {
              const m2 = ln.match(/^[-•\u2022]\s*(.+)$/);
              if (m2) extracted.push(m2[1].trim());
            }
            if (extracted.length >= 5) break;
          }
          if (extracted.length) {
            llmParsed.primary_concerns = extracted;
            llmParsed.top_reasons = extracted;
          }
        }
      }
    } catch (e) {
      // Fallback minimal parsed object
      llmParsed = { risk_level: undefined, confidence: 'medium', primary_concerns: [], top_reasons: [], raw_text: llmTextRaw };
    }

    // Generate markdown + structured report using llmParsed
    let generated;
    try {
      generated = generateAssessmentReport(mergedVitals, ruleResult, llmParsed);
    } catch (e) {
      // Fallback minimal generated
      generated = {
        markdown: `# Risk Assessment Report\n\nFINAL RISK: ${ruleResult.rule_label}\n\nNo detailed report generated due to error.`,
        report: {
          generated_at: new Date().toISOString(),
          final_risk: ruleResult.rule_label,
          confidence: llmParsed.confidence || 'medium',
          primary_concerns: ruleResult.breakdown || [],
          vitals: mergedVitals || {},
          rule_summary: ruleResult || {},
          llm: llmParsed || {}
        }
      };
    }

    const markdown = generated.markdown || '';
    const report = generated.report || {};

    // Conservative merge: take higher of rule vs LLM
    const map = { Low: 0, Medium: 1, High: 2, Critical: 3 };
    const inv = ['Low', 'Medium', 'High', 'Critical'];

    const ruleIdx = map[ruleResult.rule_label] !== undefined ? map[ruleResult.rule_label] : 0;
    const llmIdx = map[(llmParsed && llmParsed.risk_level) ? llmParsed.risk_level : undefined] !== undefined
                   ? map[llmParsed.risk_level]
                   : 1;

    const finalIdx = Math.max(ruleIdx, llmIdx);
    const finalLabel = inv[Math.min(finalIdx, inv.length - 1)];

    // Ensure report uses the merged finalLabel
    if (report && typeof report === 'object') {
      report.final_risk = finalLabel;
      report.confidence = (llmParsed && llmParsed.confidence) ? llmParsed.confidence : (report.confidence || 'medium');

      // Build robust primary concerns
      const llmPrimary = Array.isArray(llmParsed.primary_concerns) ? llmParsed.primary_concerns : (Array.isArray(llmParsed.top_reasons) ? llmParsed.top_reasons : []);
      let fallbackReasons = Array.isArray(ruleResult.breakdown) ? ruleResult.breakdown.slice(0, 5) : [];

      // If LLM provided nothing, attempt to extract numbered lines from raw_text
      if ((!llmPrimary || llmPrimary.length === 0) && llmParsed && typeof llmParsed.raw_text === 'string' && llmParsed.raw_text.trim()) {
        const raw = llmParsed.raw_text;
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const extracted = [];
        for (const ln of lines) {
          const m = ln.match(/^\d+\.\s*(.+)$/);
          if (m) extracted.push(m[1].trim());
          else {
            const m2 = ln.match(/^[-•\u2022]\s*(.+)$/);
            if (m2) extracted.push(m2[1].trim());
          }
          if (extracted.length >= 5) break;
        }
        if (extracted.length) fallbackReasons = extracted;
      }

      const primaryConcernsFinal = (llmPrimary && llmPrimary.length) ? llmPrimary : (fallbackReasons && fallbackReasons.length ? fallbackReasons : []);
      report.primary_concerns = primaryConcernsFinal;

      // Ensure clinical_summary exists (prefer LLM, then synthesize)
      if (!report.clinical_summary || !String(report.clinical_summary).trim()) {
        report.clinical_summary = synthesizeClinicalSummary({ llmParsed, ruleResult, parsedVitals: mergedVitals });
      }

      // ---- NEW: Prefix patient name for clarity if not already included ----
      const patientDisplayName = (mergedVitals && mergedVitals._patient && mergedVitals._patient.name) ? String(mergedVitals._patient.name).trim() : '';
      if (patientDisplayName) {
        if (!String(report.clinical_summary).toLowerCase().includes(patientDisplayName.toLowerCase())) {
          report.clinical_summary = `${patientDisplayName} — ${report.clinical_summary}`;
        }
      }
      // ---------------------------------------------------------------------

      // Ensure immediate_actions / short_term_actions fields exist in report (copy from llmParsed if present)
      report.immediate_actions = Array.isArray(llmParsed.immediate_actions) && llmParsed.immediate_actions.length ? llmParsed.immediate_actions : (report.immediate_actions || []);
      report.short_term_actions = Array.isArray(llmParsed.short_term_actions) && llmParsed.short_term_actions.length ? llmParsed.short_term_actions : (report.short_term_actions || []);
      report.monitoring_priorities = Array.isArray(llmParsed.monitoring_priorities) && llmParsed.monitoring_priorities.length ? llmParsed.monitoring_priorities : (report.monitoring_priorities || []);
      report.escalation_criteria = Array.isArray(llmParsed.escalation_criteria) && llmParsed.escalation_criteria.length ? llmParsed.escalation_criteria : (report.escalation_criteria || []);
    }

    // Prepare display HTML/text
    const display = formatReportForDisplay(report);

    // Build final llm.top_reasons for frontend compatibility
    const llmTopReasons = (Array.isArray(llmParsed.primary_concerns) && llmParsed.primary_concerns.length)
                         ? llmParsed.primary_concerns
                         : (Array.isArray(llmParsed.top_reasons) && llmParsed.top_reasons.length)
                           ? llmParsed.top_reasons
                           : (report && Array.isArray(report.primary_concerns) && report.primary_concerns.length)
                             ? report.primary_concerns
                             : [];

    // Build immediate actions for frontend
    const llmImmediateActions = Array.isArray(llmParsed.immediate_actions) && llmParsed.immediate_actions.length
                                ? llmParsed.immediate_actions
                                : (report && Array.isArray(report.immediate_actions) && report.immediate_actions.length ? report.immediate_actions : []);

    const llmShortTermActions = Array.isArray(llmParsed.short_term_actions) && llmParsed.short_term_actions.length
                                ? llmParsed.short_term_actions
                                : (report && Array.isArray(report.short_term_actions) && report.short_term_actions.length ? report.short_term_actions : []);

    // Final payload
    // Trigger alert evaluation (non-blocking)
    (async () => {
      try {
        const alertEngine = require('../alerts/alertEngine');
        const io = req.app && req.app.get && req.app.get('io');
        
        // Extract patient info with proper fallbacks
        const patientId = mergedVitals._patient?.id || req.body.patientId || 'unknown';
        const patientName = (mergedVitals._patient?.name && mergedVitals._patient.name.trim()) 
                          || (req.body.patientName && req.body.patientName.trim())
                          || 'Unknown Patient';
        
        const patient = {
          id: patientId,
          name: patientName,
          age: mergedVitals._patient?.age || (req.body.age ? Number(req.body.age) : null),
          sex: mergedVitals._patient?.sex || req.body.sex || null
        };
        
        console.log('upload: alertEngine patient data:', { id: patient.id, name: patient.name });
        
        await alertEngine.evaluateAndEmitAlert({
          req,
          io,
          patient,
          ruleResult,
          llmParsed,
          vitals: mergedVitals, // Pass vitals for immediate rule checks
          message: (req.body && req.body.freeText) || mergedVitals.notes || (llmParsed && llmParsed.raw_text) || '',
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('upload: alertEngine error (non-fatal):', err.message);
        // Continue - don't fail upload on alert error
      }
    })();

    // Ensure patient object has all fields with proper fallbacks
    const patientId = mergedVitals._patient?.id || req.body.patientId || 'unknown';
    const patientName = (mergedVitals._patient?.name && mergedVitals._patient.name.trim()) 
                      || (req.body.patientName && req.body.patientName.trim())
                      || 'Unknown Patient';
    
    const patientObj = {
      id: patientId,
      name: patientName,
      age: mergedVitals._patient?.age || (req.body.age ? Number(req.body.age) : null),
      sex: mergedVitals._patient?.sex || req.body.sex || null
    };
    
    console.log('upload: response patient data:', patientObj);

    const responsePayload = {
      ok: true,
      patient: patientObj,
      final_label: finalLabel,
      rule: ruleResult,
      llm: {
        llm_label: (llmParsed && (llmParsed.risk_level || llmParsed.llm_label)) ? (llmParsed.risk_level || llmParsed.llm_label) : 'Medium',
        confidence: (llmParsed && llmParsed.confidence) ? llmParsed.confidence : 'medium',
        top_reasons: llmTopReasons,
        immediate_actions: llmImmediateActions,
        short_term_actions: llmShortTermActions,
        parsed: llmParsed,
        raw_text: llmParsed && llmParsed.raw_text ? llmParsed.raw_text : llmTextRaw
      },
      report_markdown: markdown,
      report_structured: report,
      display_text: display.text,
      display_html: display.html,
      parseErrors: parseErrors.length ? parseErrors : undefined
    };

    return res.json(responsePayload);

  } catch (err) {
    console.error('upload route error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: err.message || String(err), stack: err && err.stack ? String(err.stack) : undefined });
  }
});

module.exports = router;
