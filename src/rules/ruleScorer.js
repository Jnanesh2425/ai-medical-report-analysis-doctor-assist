// src/rules/ruleScorer.js
// Enhanced deterministic rule engine with improved LLM prompt & reporting
// Exports:
//  - extractVitalsAndMetadata(text) => parsed data object
//  - computeRuleScore(parsed) => { rule_score, rule_label, breakdown }
//  - getLLMSystemPrompt() => comprehensive system prompt for LLM
//  - formatLLMUserPrompt(patientData, ruleScore) => formatted user prompt
//  - parseLLMResponse(llmText) => parsed LLM text (original best-effort parser)
//  - parseLLMResponseImproved(llmText) => normalized parser (confidence normalization)
//  - generateAssessmentReport(parsed, ruleResult, llmParsed) => { markdown, report }
//  - formatReportForDisplay(report) => { text, html }

function toNumberSafe(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[^\d.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Helper: find sentence around keyword to enable negation awareness
function sentenceAround(text, keyword, radius = 120) {
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return '';
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + keyword.length + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

// Negative context detector (simple, but effective)
function isNegated(phrase) {
  if (!phrase) return false;
  const p = phrase.toLowerCase();
  const negations = [' no ', ' not ', ' none', ' without ', ' negative', 'free of', 'absent'];
  for (const n of negations) {
    if (p.includes(n)) return true;
  }
  // explicit "resolved" should also be treated as non-active
  if (p.includes('resolved') || p.includes('improved') || p.includes('stable')) return true;
  return false;
}

// parse BP like 120/80 or "BP: 120/80"
function parseBP(text) {
  const m = text.match(/(?:BP|Blood Pressure)[:\s]*([0-9]{2,3})\/([0-9]{2,3})/i);
  if (m) return { sys: toNumberSafe(m[1]), dia: toNumberSafe(m[2]) };
  // also try any group like "118/76" standalone
  const m2 = text.match(/\b([1-2][0-9]{2}|[1-9][0-9])\/([0-9]{2,3})\b/);
  if (m2) return { sys: toNumberSafe(m2[1]), dia: toNumberSafe(m2[2]) };
  return null;
}

// Primary extraction function
function extractVitalsAndMetadata(textRaw) {
  const text = (textRaw || '').replace(/\r/g, '\n'); // normalize
  const lower = text.toLowerCase();

  const out = {
    age: null,
    tempRaw: null,
    tempUnit: null,
    tempC: null,
    hr: null,
    rr: null,
    bp: null,
    spo2: null,
    procedureCodes: [],
    woundPhrases: [],
    drains: [],
    meds: [],
    comorbidities: [],
    labs: {},     // e.g., { wbc: 12.3, hb: 9.2, cr: 1.8, lactate: 2.5 }
    symptoms: [],
    notes: text.trim()
  };

  // AGE
  const ageMatch = text.match(/(?:Age|age|AGE)[:\s]*([0-9]{1,3})\b/);
  if (ageMatch) out.age = toNumberSafe(ageMatch[1]);

  // TEMPERATURE: match values + optional unit (C or F)
  const tempRegex = /(?:Temp(?:erature)?|T[:\s])[:\s]*([0-9]{1,3}(?:\.[0-9]+)?)\s*°?\s*([CFcf])?\b/;
  const tMatch = text.match(tempRegex);
  if (tMatch) {
    const raw = toNumberSafe(tMatch[1]);
    const unit = tMatch[2] ? tMatch[2].toUpperCase() : null;
    out.tempRaw = raw;
    out.tempUnit = unit;
    if (raw != null) {
      if (unit === 'F') out.tempC = (raw - 32) * 5 / 9;
      else if (unit === 'C') out.tempC = raw;
      else {
        // If no unit given assume F if value looks like F (>= 45) else assume C
        if (raw >= 45) out.tempC = (raw - 32) * 5 / 9;
        else out.tempC = raw;
      }
      // round to 1 decimal
      out.tempC = Math.round(out.tempC * 10) / 10;
    }
  }

  // HEART RATE
  const hrMatch = text.match(/(?:HR|Heart Rate|Pulse)[:\s]*([0-9]{2,3})\b/i);
  if (hrMatch) out.hr = toNumberSafe(hrMatch[1]);

  // RESP RATE
  const rrMatch = text.match(/(?:RR|Respiratory Rate)[:\s]*([0-9]{2,3})\b/i);
  if (rrMatch) out.rr = toNumberSafe(rrMatch[1]);

  // BP
  const bp = parseBP(text);
  if (bp) out.bp = bp;

  // SpO2
  const spMatch = text.match(/(?:SpO2|SpO₂|O2 saturation|Saturation)[:\s]*([0-9]{2,3})\%?/i);
  if (spMatch) out.spo2 = toNumberSafe(spMatch[1]);

  // PROCEDURE keywords (broad) - includes cardiac procedures
  const procRegex = /\b(laparotomy|appendectomy|cholecystectomy|cesarean|c-section|cabg|cardiac|coronary|angioplasty|pci|stent|neurosurgery|thoracotomy|colorectal|stoma|amputation|vascular|transplant|orthopedic|hip replacement|knee replacement|major)\b/ig;
  let m;
  while ((m = procRegex.exec(text)) !== null) {
    out.procedureCodes.push(m[1]);
  }

  // WOUND / DRAIN / DEVICE phrases (collect sentences, negation-aware)
  const woundKeywords = ['wound infection','wound dehiscence','purulent discharge','drain site infection','surgical site infection','incision infection'];
  for (const kw of woundKeywords) {
    if (lower.includes(kw)) {
      const s = sentenceAround(text, kw, 100);
      out.woundPhrases.push({ keyword: kw, sentence: s, negated: isNegated(s) });
    }
  }

  // DRAINS (presence + output)
  const drainRegex = /\bdrain(?: output)?[:\s]*([0-9]{1,4})\s*(ml|mL)?/i;
  const drainMatch = text.match(drainRegex);
  if (drainMatch) out.drains.push({ text: drainMatch[0], ml: toNumberSafe(drainMatch[1]) });

  // MEDICATIONS — anticoagulants, antibiotics, steroids, immunosuppressants
  const medKeywords = ['warfarin','heparin','enoxaparin','apixaban','rivaroxaban','dabigatran','aspirin','clopidogrel','ticagrelor','prasugrel','cef', 'levo', 'piperacillin','vancomycin','steroid','predni','methylpred','dexamethasone','immunosuppress'];
  for (const kw of medKeywords) {
    if (lower.includes(kw)) out.meds.push(kw);
  }

  // COMORBIDITIES
  const comorbs = ['diabetes','dm','hypertension','htn','copd','asthma','ckd','chronic kidney','heart failure','cad','coronary','myocardial infarction','mi','dementia','stroke','cancer','malign'];
  for (const c of comorbs) {
    if (lower.includes(c)) out.comorbidities.push(c);
  }

  // LABS: WBC, Hb, Creatinine, Lactate, Platelets, Troponin
  const labPatterns = {
    wbc: /\b(?:WBC|white cell|white blood cell)[^\d\n\r\-:]*([0-9]{1,3}(?:\.[0-9]+)?)/i,
    hb: /\b(?:Hb|Hemoglobin|haemoglobin)[^\d\n\r\-:]*([0-9]{1,3}(?:\.[0-9]+)?)/i,
    cr: /\b(?:Cr|Creatinine)[^\d\n\r\-:]*([0-9]{1,3}(?:\.[0-9]+)?)/i,
    lactate: /\b(?:Lactate|Lactic acid)[^\d\n\r\-:]*([0-9]{1,3}(?:\.[0-9]+)?)/i,
    platelets: /\b(?:Platelet|Plt)[^\d\n\r\-:]*([0-9]{2,6}(?:\.[0-9]+)?)\b/i,
    bun: /\b(?:BUN|Urea)[^\d\n\r\-:]*([0-9]{1,3}(?:\.[0-9]+)?)/i,
    troponin: /\b(?:Troponin|Trop)[^\d\n\r\-:]*([0-9]{1,5}(?:\.[0-9]+)?)/i
  };
  for (const k of Object.keys(labPatterns)) {
    const mm = text.match(labPatterns[k]);
    if (mm) out.labs[k] = toNumberSafe(mm[1]);
  }

  // SYMPTOM KEYWORDS (collect active symptoms, negation-aware)
  const symptomKeywords = ['chest pain','shortness of breath','sob','dyspnea','bleeding','hemorrhage','hematoma','fever','rigor','vomit','nausea','oliguria','no urine','confusion','delirium','severe pain','uncontrolled pain','worsening','purulent','lethargy'];
  for (const s of symptomKeywords) {
    if (lower.includes(s)) {
      const ctx = sentenceAround(text, s, 80);
      if (!isNegated(ctx)) out.symptoms.push({ symptom: s, sentence: ctx });
    }
  }

  // NOTES: capture clinician note lines (if any)
  const noteMatch = text.match(/Clinician Note[:\s]*([^\n\r]+)/i);
  if (noteMatch) out.notes = out.notes + '\nClinicianNote: ' + noteMatch[1];

  return out;
}

// computeRuleScore: uses parsed metadata and returns a conservative numeric score (0..20)
function computeRuleScore(parsed) {
  const breakdown = [];
  let score = 0;

  // Helpers
  const add = (pts, reason) => { score += pts; breakdown.push(reason + ` (+${pts})`); };

  // 1) AGE (older patients higher risk)
  if (parsed.age) {
    if (parsed.age >= 85) { add(3, 'Age >=85'); }
    else if (parsed.age >= 75) { add(2, 'Age 75-84'); }
    else if (parsed.age >= 65) { add(1, 'Age 65-74'); }
  }

  // 2) Procedure risk (major operations)
  if (parsed.procedureCodes && parsed.procedureCodes.length > 0) {
    const highRiskProcs = ['cabg','cardiac','coronary','angioplasty','pci','neurosurgery','major','transplant','thoracotomy','laparotomy','colorectal','vascular','amputation','orthopedic'];
    const found = parsed.procedureCodes.map(p => p.toLowerCase()).filter(p => highRiskProcs.some(h=>p.includes(h)));
    if (found.length > 0) add(3, `High-risk procedure: ${found[0]}`);
  }

  // 3) Temperature
  if (parsed.tempC != null) {
    if (parsed.tempC >= 39) add(4, 'Fever >=39°C');
    else if (parsed.tempC >= 38) add(2, 'Fever 38-38.9°C');
  }

  // 4) Heart rate
  if (parsed.hr != null) {
    if (parsed.hr >= 130) add(3, 'Severe tachycardia HR>=130');
    else if (parsed.hr >= 110) add(2, 'Tachycardia HR 110-129');
    else if (parsed.hr < 50) add(2, 'Bradycardia HR<50');
  }

  // 5) Respiratory rate / respiratory distress
  if (parsed.rr != null) {
    if (parsed.rr >= 30) add(3, 'Tachypnea RR>=30');
    else if (parsed.rr >= 24) add(1, 'Tachypnea RR 24-29');
  }
  // symptoms indicating respiratory failure / SOB
  if ((parsed.symptoms || []).some(s=>/shortness of breath|sob|dyspnea|chest pain/.test(s.symptom))) add(3, 'Respiratory symptoms');

  // 6) SpO2 / hypoxia
  if (parsed.spo2 != null) {
    if (parsed.spo2 < 90) add(4, 'SpO2 <90%');
    else if (parsed.spo2 < 94) add(2, 'SpO2 90-93%');
  }

  // 7) Blood pressure extremes
  if (parsed.bp && parsed.bp.sys != null) {
    const s = parsed.bp.sys;
    const d = parsed.bp.dia || 0;
    if (s >= 180 || s <= 80) add(3, 'Systolic BP extreme');
    else if (s >= 160) add(1, 'High systolic BP >=160');
    if (d >= 110) add(2, 'Diastolic severe hypertension');
  }

  // 8) Wound / drain infection (negation-aware) - only flag actual wound infections
  const woundActive = (parsed.woundPhrases || []).some(p => !p.negated);
  if (woundActive) add(3, 'Wound/surgical site concern');

  // 9) Drain high output (>200 ml considered concerning)
  if (parsed.drains && parsed.drains.length > 0) {
    const highDrain = parsed.drains.some(d => d.ml && d.ml >= 200);
    if (highDrain) add(2, 'High drain output');
  }

  // 10) Bleeding/anticoagulation risk
  const bleedingMention = (parsed.symptoms || []).some(s => /bleed|bleeding|hematoma|hemorrhage/.test(s.symptom));
  const onAnticoag = (parsed.meds || []).some(m=>/(warfarin|heparin|enoxaparin|apixaban|rivaroxaban|dabigatran|aspirin|clopidogrel|ticagrelor|prasugrel)/i.test(m));
  if (bleedingMention) add(4, 'Active bleeding');
  if (onAnticoag && !bleedingMention) add(1, 'On anticoagulant/antiplatelet therapy');
  if (onAnticoag && bleedingMention) add(2, 'Anticoagulant + bleeding risk');

  // 11) Infection & sepsis flags from labs & symptoms (negation-aware)
  const wbc = parsed.labs ? parsed.labs.wbc : null;
  if (wbc != null) {
    if (wbc >= 15) add(3, 'High WBC >=15');
    else if (wbc >= 11) add(1, 'WBC 11-14.9');
    else if (wbc < 4) add(1, 'Low WBC <4');
  }
  // lactate
  const lac = parsed.labs ? parsed.labs.lactate : null;
  if (lac != null) {
    if (lac >= 4) add(4, 'Lactate >=4 (shock marker)');
    else if (lac >= 2) add(2, 'Lactate 2-3.9');
  }

  // sepsis suspicion if multiple signs
  const sepsisSigns = (
    (parsed.tempC != null && parsed.tempC >= 38 ? 1 : 0) +
    (wbc != null && wbc >= 11 ? 1 : 0) +
    (parsed.hr != null && parsed.hr >= 90 ? 1 : 0) +
    (parsed.rr != null && parsed.rr >= 22 ? 1 : 0) +
    (parsed.spo2 != null && parsed.spo2 < 94 ? 1 : 0)
  );
  if (sepsisSigns >= 3) add(5, 'Sepsis suspicion');

  // 12) Renal injury / oliguria markers
  const cr = parsed.labs ? parsed.labs.cr : null;
  if (cr != null) {
    if (cr >= 2.0) add(3, 'Elevated creatinine >=2.0');
    else if (cr >= 1.5) add(1, 'Elevated creatinine 1.5-1.99');
  }
  if ((parsed.symptoms || []).some(s=>/oliguria|no urine|decreased urine/i.test(s.symptom))) add(3, 'Oliguria/AKI sign');

  // 13) Neurologic / altered mental status / fall risk
  if ((parsed.symptoms || []).some(s => /confusion|delirium|lethargy|unresponsive/.test(s.symptom))) add(4, 'Altered mental status');

  // 14) Severe pain uncontrolled
  if ((parsed.symptoms || []).some(s => /severe pain|uncontrolled pain/.test(s.symptom))) add(2, 'Uncontrolled severe pain');

  // 15) Cardiovascular ischemia / arrhythmia - enhanced
  const cardiacIschemia = (parsed.symptoms || []).some(s => /chest pain/.test(s.symptom)) ||
                          (parsed.labs && parsed.labs.troponin != null) ||
                          (parsed.notes && parsed.notes.toLowerCase().includes('elevated troponin'));
  if (cardiacIschemia) add(4, 'Cardiac ischemia/elevated troponin');

  if ((parsed.symptoms || []).some(s => /palpitation|arrhythmia|irregular heartbeat/.test(s.symptom))) add(2, 'Arrhythmia symptom');

  // 16) Comorbidity burden (each major comorbidity adds small risk)
  const majorComorbs = ['diabetes','heart failure','ckd','copd','cancer','dementia','stroke','coronary','myocardial infarction'];
  const comCount = (parsed.comorbidities || []).filter(c => majorComorbs.some(m => c.includes(m))).length;
  if (comCount >= 2) add(2, 'Multiple major comorbidities');
  else if (comCount === 1) add(1, 'Major comorbidity');

  // 17) Lab anemia / thrombocytopenia
  const hb = parsed.labs ? parsed.labs.hb : null;
  if (hb != null) {
    if (hb < 7) add(4, 'Severe anemia (Hb<7)');
    else if (hb < 9) add(2, 'Moderate anemia (Hb 7-8.9)');
  }
  const plt = parsed.labs ? parsed.labs.platelets : null;
  if (plt != null && plt < 50) add(3, 'Thrombocytopenia <50k');

  // 18) Recent transfusion / immunosuppression
  if ((parsed.meds || []).some(m=>/(steroid|predni|dexamethasone|immunosuppress)/i.test(m))) add(1, 'On immunosuppressant/steroid');

  // 19) Red flags by free-text clinician notes (explicit)
  const note = parsed.notes ? parsed.notes.toLowerCase() : '';
  const redflagWords = ['poor perfusion','unstable','transfer to icu','icu','escalate','urgent','worsening rapidly','need reoperation','re-explore','critical'];
  for (const w of redflagWords) {
    if (note.includes(w)) {
      add(5, `Clinician red flag: ${w}`);
      break; // only add once
    }
  }

  // 20) Conservative cap
  if (score > 20) score = 20;

  // Map to label conservatively:
  // 0-3: Low, 4-9: Medium, 10-20: High
  let rule_label = 'Low';
  if (score >= 10) rule_label = 'High';
  else if (score >= 4) rule_label = 'Medium';

  return { rule_score: score, rule_label, breakdown };
}

// NEW: Comprehensive LLM System Prompt for Groq/Claude
function getLLMSystemPrompt() {
  return `You are an expert clinical assistant helping nurses assess post-operative complication risk.

Your task is to analyze patient data and provide a CLEAR, COMPREHENSIVE, ACTIONABLE risk assessment that nurses can immediately use.

RISK CLASSIFICATION:
- Low Risk: Stable patient, routine recovery expected, standard monitoring sufficient
- Medium Risk: Some concerning factors present, requires enhanced monitoring and closer observation
- High Risk: Multiple serious concerns present, needs intensive monitoring, possible ICU-level care
- Critical: Life-threatening situation requiring immediate intervention

OUTPUT FORMAT - You MUST provide ALL sections below:

**RISK LEVEL: [Low/Medium/High/Critical]**
**CONFIDENCE: [low/medium/high]**

**PRIMARY CONCERNS** (List 3-5 most critical clinical issues):
1. [Concern with specific values and clinical significance - explain WHY this matters]
2. [Concern with specific values and clinical significance]
3. [Continue as needed]

**RISK FACTOR ASSESSMENT:**

**Cardiovascular:**
[Specific issues related to heart, blood pressure, perfusion, or state "No immediate concerns"]

**Respiratory:**
[Specific issues related to breathing, oxygen, lung function, or state "No immediate concerns"]

**Infection/Sepsis:**
[Signs of infection, fever, elevated WBC, or state "Low risk currently"]

**Renal/Metabolic:**
[Kidney function, electrolytes, fluid balance issues, or state "No immediate concerns"]

**Bleeding/Coagulation:**
[Active bleeding, coagulation issues, anticoagulant risks, or state "No active bleeding"]

**Neurological:**
[Mental status, confusion, stroke risk, or state "Alert and oriented"]

**Pain Management:**
[Pain control adequacy, concerns, or state "Adequately controlled"]

**Wound/Surgical Site:**
[Incision status, drainage, infection signs, or state "Clean and dry"]

**IMMEDIATE ACTIONS** (Within 1 hour - be specific):
- [Action 1 with clear instructions]
- [Action 2 with clear instructions]
- [Continue - prioritize most urgent]

**SHORT-TERM ACTIONS** (Within 4-8 hours):
- [Action 1]
- [Action 2]
- [Continue]

**ONGOING MONITORING PRIORITIES:**
- [What to monitor and how frequently]
- [Specific parameters to track]
- [Warning signs to watch for]

**WHEN TO CALL THE DOCTOR - ESCALATION CRITERIA:**
🚨 IMMEDIATE (call now):
- [Red flag sign 1]
- [Red flag sign 2]

⚠️ URGENT (call within 30 min):
- [Warning sign 1]
- [Warning sign 2]

**CLINICAL SUMMARY:**
[2-4 sentences explaining the overall risk level, the main concerns, and why this patient requires this level of monitoring. Include key context about the procedure and expected recovery timeline.]

CRITICAL GUIDELINES:
1. Be SPECIFIC with values (don't just say "elevated troponin" - explain what it means)
2. Use NURSE-FRIENDLY language (avoid excessive jargon, but be medically accurate)
3. Focus on ACTIONABLE items (what nurses can monitor and do)
4. Consider the PROCEDURE TYPE and normal post-op course
5. Distinguish between EXPECTED post-op findings vs COMPLICATIONS
6. Be CONSERVATIVE - flag potential issues early
7. For cardiac patients: emphasize arrhythmia monitoring, troponin trends, signs of heart failure/cardiogenic shock
8. For surgical patients: emphasize wound care, infection signs, pain management, mobility
9. Always include WHEN TO ESCALATE criteria

Remember: Nurses need to know WHAT to watch for, WHY it matters, and WHEN to call for help.`;
}

// NEW: Format user prompt for LLM with context
function formatLLMUserPrompt(patientData, ruleScore) {
  return `Analyze this post-operative patient and provide comprehensive risk assessment:

PATIENT DATA:
${patientData}

AUTOMATED SCREENING RESULTS:
- Rule-based Risk Score: ${ruleScore.rule_score}/20 (${ruleScore.rule_label})
- Factors Identified: ${ruleScore.breakdown.join('; ')}

Please provide your comprehensive clinical analysis following the format specified in your system prompt. Focus on providing clear, actionable guidance for nursing staff.`;
}

// NEW: Parse LLM response to extract structured data (original robust parser)
function parseLLMResponse(llmText) {
  const result = {
    risk_level: 'Medium', // default
    confidence: 'medium',
    primary_concerns: [],
    risk_factors: {},
    immediate_actions: [],
    short_term_actions: [],
    monitoring_priorities: [],
    escalation_criteria: [],
    clinical_summary: '',
    raw_text: llmText
  };

  if (!llmText || typeof llmText !== 'string') return result;

  // Extract risk level
  const riskMatch = llmText.match(/RISK LEVEL:\s*(Low|Medium|High|Critical)/i);
  if (riskMatch) result.risk_level = riskMatch[1];

  // Extract confidence
  const confMatch = llmText.match(/CONFIDENCE:\s*(low|medium|high)/i);
  if (confMatch) result.confidence = confMatch[1].toLowerCase();

  // Extract primary concerns (numbered list)
  const concernsSection = llmText.match(/PRIMARY CONCERNS[:\s]*([\s\S]*?)(?=\*\*RISK FACTOR|$)/i);
  if (concernsSection) {
    const concerns = concernsSection[1].match(/^\s*\d+\.\s*(.+)$/gm);
    if (concerns) {
      result.primary_concerns = concerns.map(c => c.replace(/^\s*\d+\.\s*/, '').trim());
    }
  }

  // Extract risk factors for known categories
  const riskCategories = ['Cardiovascular', 'Respiratory', 'Infection/Sepsis', 'Renal/Metabolic',
                          'Bleeding/Coagulation', 'Neurological', 'Pain Management', 'Wound/Surgical Site'];
  for (const category of riskCategories) {
    const regex = new RegExp(`\\*\\*${category}:\\*\\*\\s*([^\\*]+)`, 'i');
    const match = llmText.match(regex);
    if (match) {
      result.risk_factors[category.toLowerCase().replace(/[\/\s]/g, '_')] = match[1].trim();
    }
  }

  // Helper to extract bullet items from a section by newline parsing
  function bulletsFromSection(sectionText) {
    if (!sectionText) return [];
    const lines = sectionText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const items = [];
    for (const line of lines) {
      // consider lines starting with common bullet markers or emoji or dash or number
      if (/^[-•\u2022\u2023\u25E6\u2024\u2043*–—•]/.test(line) || /^\d+\./.test(line) || /^[\p{Emoji}]/u.test(line)) {
        // remove leading bullet/emoji/number markers
        const cleaned = line.replace(/^([\-•\u2022\u2023\u25E6\u2024\u2043*–—•\s\uFE0F\u200D]+|\d+\.\s*)/, '').trim();
        if (cleaned) items.push(cleaned);
      } else {
        // also accept plain lines (non-bulleted) as items if they look like distinct actions (contain a verb)
        if (/[A-Za-z]/.test(line) && line.split(' ').length <= 20) items.push(line);
      }
    }
    return items;
  }

  // Extract immediate actions
  const immediateSection = llmText.match(/IMMEDIATE ACTIONS[:\s]*([\s\S]*?)(?=\*\*SHORT-TERM|\*\*ONGOING|$)/i);
  if (immediateSection) {
    result.immediate_actions = bulletsFromSection(immediateSection[1]);
  }

  // Extract short-term actions
  const shortTermSection = llmText.match(/SHORT-TERM ACTIONS[:\s]*([\s\S]*?)(?=\*\*ONGOING|\*\*WHEN|$)/i);
  if (shortTermSection) {
    result.short_term_actions = bulletsFromSection(shortTermSection[1]);
  }

  // Extract monitoring priorities
  const monitoringSection = llmText.match(/ONGOING MONITORING[:\s]*([\s\S]*?)(?=\*\*WHEN|\*\*CLINICAL|$)/i);
  if (monitoringSection) {
    result.monitoring_priorities = bulletsFromSection(monitoringSection[1]);
  }

  // Extract escalation criteria by splitting lines and selecting those that look like criteria
  const escalationSection = llmText.match(/WHEN TO CALL THE DOCTOR[:\s]*([\s\S]*?)(?=\*\*CLINICAL|$)/i);
  if (escalationSection) {
    const escLines = escalationSection[1].split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const criteria = [];
    for (const L of escLines) {
      // Accept lines that start with urgent markers, emoji, bullets, numbers, or look like a short criterion
      if (/^([🚨⚠️\-\u2022*•\u25E6\ufe0f]|\d+\.)/.test(L) || /call.*(doctor|physician|urgent|now|within)/i.test(L) || L.length < 120) {
        const cleaned = L.replace(/^([🚨⚠️\-\u2022*•\u25E6\ufe0f\d\.\s]+|[:\-–—]+)\s*/, '').trim();
        if (cleaned) criteria.push(cleaned);
      }
    }
    result.escalation_criteria = criteria;
  }

  // Extract clinical summary
  const summarySection = llmText.match(/CLINICAL SUMMARY[:\s]*([\s\S]*?)$/i);
  if (summarySection) {
    result.clinical_summary = summarySection[1].trim();
  }

  return result;
}

// normalize confidence and provide improved parser wrapper
function normalizeConfidence(conf) {
  if (!conf) return 'medium';
  const c = String(conf).toLowerCase();
  if (c.startsWith('h')) return 'high';
  if (c.startsWith('m') || c === 'med') return 'medium';
  if (c.startsWith('l')) return 'low';
  return 'medium';
}

// More robust parseLLMResponse: reuse existing parser then normalize
function parseLLMResponseImproved(llmText) {
  const base = parseLLMResponse(llmText); // reuse parser
  if (base.risk_level) base.risk_level = String(base.risk_level).trim().replace(/^\s+|\s+$/g, '');
  base.confidence = normalizeConfidence(base.confidence);
  // Ensure arrays exist
  base.primary_concerns = base.primary_concerns || [];
  base.immediate_actions = base.immediate_actions || [];
  base.short_term_actions = base.short_term_actions || [];
  base.monitoring_priorities = base.monitoring_priorities || [];
  base.escalation_criteria = base.escalation_criteria || [];
  return base;
}

// Create a human-friendly plain-text / markdown report and a JSON object to return to frontend
function generateAssessmentReport(parsed, ruleResult, llmParsed) {
  const now = new Date().toISOString();

  // Friendly labels and severity mapping
  const severity = (llmParsed && llmParsed.risk_level) ? llmParsed.risk_level : (ruleResult && ruleResult.rule_label ? ruleResult.rule_label : 'Low');
  const confidence = (llmParsed && llmParsed.confidence) ? llmParsed.confidence : 'medium';

  // Build PRIMARY CONCERNS: prefer LLM list, fallback to rule breakdown
  const primaryConcerns = (llmParsed && Array.isArray(llmParsed.primary_concerns) && llmParsed.primary_concerns.length > 0)
    ? llmParsed.primary_concerns
    : (ruleResult && Array.isArray(ruleResult.breakdown) && ruleResult.breakdown.length > 0 ? ruleResult.breakdown.slice(0,5) : []);

  // Build combined risk factor summary (merge LLM risk_factors with rule flags)
  const riskFactors = Object.assign({}, (llmParsed && llmParsed.risk_factors) ? llmParsed.risk_factors : {});
  // add short computed flags that are quick to display
  riskFactors['computed_rule_summary'] = `Rule score ${ruleResult.rule_score}/20 (${ruleResult.rule_label}) — ${Array.isArray(ruleResult.breakdown) ? ruleResult.breakdown.join('; ') : ''}`;

  // Compose a readable markdown report
  const mdLines = [];
  mdLines.push(`# Risk Assessment Report — ${now}`);
  mdLines.push(`**FINAL RISK:** ${severity}`);
  mdLines.push(`**CONFIDENCE:** ${confidence}`);
  mdLines.push('');
  mdLines.push(`## PRIMARY CONCERNS`);
  if (primaryConcerns.length === 0) mdLines.push('- No immediate primary concerns identified.');
  else primaryConcerns.forEach((c, i) => mdLines.push(`${i+1}. ${c}`));
  mdLines.push('');
  mdLines.push(`## KEY VITALS & LABS (parsed)`);
  const vitals = [];
  if (parsed && parsed.age != null) vitals.push(`Age: ${parsed.age} yrs`);
  if (parsed && parsed.tempC != null) vitals.push(`Temp: ${parsed.tempC} °C`);
  if (parsed && parsed.hr != null) vitals.push(`HR: ${parsed.hr} bpm`);
  if (parsed && parsed.rr != null) vitals.push(`RR: ${parsed.rr} /min`);
  if (parsed && parsed.bp && parsed.bp.sys != null) vitals.push(`BP: ${parsed.bp.sys}/${parsed.bp.dia || ''} mmHg`);
  if (parsed && parsed.spo2 != null) vitals.push(`SpO2: ${parsed.spo2}%`);
  if (parsed && parsed.labs && Object.keys(parsed.labs || {}).length > 0) {
    for (const [k,v] of Object.entries(parsed.labs)) {
      vitals.push(`${k.toUpperCase()}: ${v}`);
    }
  }
  if (vitals.length) mdLines.push(vitals.map(x=>`- ${x}`).join('\n'));
  else mdLines.push('- No discrete vitals/labs parsed.');

  mdLines.push('');
  mdLines.push('## RISK FACTOR ASSESSMENT (summary)');
  for (const [k,v] of Object.entries(riskFactors)) {
    mdLines.push(`- **${k.replace(/_/g,' ')}:** ${String(v).replace(/\n/g,' ')}`);
  }

  mdLines.push('');
  mdLines.push('## IMMEDIATE ACTIONS (LLM suggested)');
  if (llmParsed && llmParsed.immediate_actions && llmParsed.immediate_actions.length) {
    llmParsed.immediate_actions.forEach((a, i) => mdLines.push(`${i+1}. ${a}`));
  } else {
    mdLines.push('- No immediate LLM actions provided; follow local protocol and monitor vitals q15–60min depending on severity.');
  }

  mdLines.push('');
  mdLines.push('## SHORT-TERM ACTIONS');
  if (llmParsed && llmParsed.short_term_actions && llmParsed.short_term_actions.length) llmParsed.short_term_actions.forEach((a,i)=>mdLines.push(`${i+1}. ${a}`));
  else mdLines.push('- Standard post-op checks: vitals q4h, wound check q8h, labs PRN.');

  mdLines.push('');
  mdLines.push('## ONGOING MONITORING PRIORITIES');
  if (llmParsed && llmParsed.monitoring_priorities && llmParsed.monitoring_priorities.length) llmParsed.monitoring_priorities.forEach((m,i)=>mdLines.push(`${i+1}. ${m}`));
  else mdLines.push('- Monitor HR, BP, RR, SpO2, urine output, wound drainage.');

  mdLines.push('');
  mdLines.push('## ESCALATION CRITERIA (WHEN TO CALL)');
  if (llmParsed && llmParsed.escalation_criteria && llmParsed.escalation_criteria.length) llmParsed.escalation_criteria.forEach((e,i)=>mdLines.push(`${i+1}. ${e}`));
  else mdLines.push('- New onset hypotension (SBP <90), SpO2 <90%, persistent severe tachycardia >130, altered mental status.');

  mdLines.push('');
  mdLines.push('## CLINICAL SUMMARY');
  mdLines.push((llmParsed && llmParsed.clinical_summary) ? llmParsed.clinical_summary : `Rule-based score suggests ${ruleResult.rule_label} risk. Use nursing judgement and escalate on red flags.`);

  // JSON-friendly structured report
  const reportObject = {
    generated_at: now,
    final_risk: severity,
    confidence,
    primary_concerns: primaryConcerns,
    vitals: {
      age: (parsed && parsed.age) ? parsed.age : null,
      tempC: (parsed && parsed.tempC) ? parsed.tempC : null,
      hr: (parsed && parsed.hr) ? parsed.hr : null,
      rr: (parsed && parsed.rr) ? parsed.rr : null,
      bp: (parsed && parsed.bp) ? parsed.bp : null,
      spo2: (parsed && parsed.spo2) ? parsed.spo2 : null,
      labs: (parsed && parsed.labs) ? parsed.labs : {}
    },
    rule_summary: ruleResult || {},
    llm: llmParsed || {},
    risk_factors: riskFactors,
    immediate_actions: (llmParsed && llmParsed.immediate_actions) ? llmParsed.immediate_actions : [],
    short_term_actions: (llmParsed && llmParsed.short_term_actions) ? llmParsed.short_term_actions : [],
    monitoring_priorities: (llmParsed && llmParsed.monitoring_priorities) ? llmParsed.monitoring_priorities : [],
    escalation_criteria: (llmParsed && llmParsed.escalation_criteria) ? llmParsed.escalation_criteria : [],
    clinical_summary: (llmParsed && llmParsed.clinical_summary) ? llmParsed.clinical_summary : ''
  };

  return {
    markdown: mdLines.join('\n'),
    report: reportObject
  };
}

// formatReportForDisplay(report) -> returns plain text and a simple html version
function formatReportForDisplay(report) {
  if (!report) return { text: 'No report', html: '<div>No report</div>' };

  const r = report;
  const lines = [];
  lines.push(`=== Risk Assessment — ${r.generated_at} ===`);
  lines.push(`FINAL RISK: ${r.final_risk}   |   CONFIDENCE: ${r.confidence}`);
  lines.push('');

  // Primary concerns
  lines.push('PRIMARY CONCERNS:');
  if (r.primary_concerns && r.primary_concerns.length) {
    r.primary_concerns.forEach((c, i) => lines.push(` ${i+1}. ${c}`));
  } else {
    lines.push(' - None identified');
  }
  lines.push('');

  // Vitals & Labs
  lines.push('KEY VITALS & LABS:');
  const v = r.vitals || {};
  if (v.age != null) lines.push(` - Age: ${v.age} yrs`);
  if (v.tempC != null) lines.push(` - Temp: ${v.tempC} °C`);
  if (v.hr != null) lines.push(` - HR: ${v.hr} bpm`);
  if (v.rr != null) lines.push(` - RR: ${v.rr} /min`);
  if (v.bp && v.bp.sys != null) lines.push(` - BP: ${v.bp.sys}/${v.bp.dia || ''} mmHg`);
  if (v.spo2 != null) lines.push(` - SpO2: ${v.spo2}%`);
  if (v.labs && Object.keys(v.labs).length) {
    for (const [k,val] of Object.entries(v.labs)) lines.push(` - ${k.toUpperCase()}: ${val}`);
  }
  if (lines[lines.length-1] === 'KEY VITALS & LABS:') lines.push(' - No discrete vitals/labs parsed.');
  lines.push('');

  // Rule summary (concise)
  lines.push('RULE-BASED SCORE:');
  if (r.rule_summary) {
    lines.push(` - Score: ${r.rule_summary.rule_score} / 20  (${r.rule_summary.rule_label})`);
    if (r.rule_summary.breakdown && r.rule_summary.breakdown.length) {
      lines.push(' - Factors:');
      r.rule_summary.breakdown.forEach(b => lines.push(`    * ${b}`));
    }
  } else {
    lines.push(' - No rule summary available');
  }
  lines.push('');

  // Immediate & short-term actions
  lines.push('IMMEDIATE ACTIONS (within 1 hour):');
  if (r.immediate_actions && r.immediate_actions.length) r.immediate_actions.forEach((a,i)=>lines.push(` ${i+1}. ${a}`));
  else lines.push(' - Follow local protocol (monitor vitals q15–60 min); contact physician on red flags.');
  lines.push('');

  lines.push('SHORT-TERM ACTIONS (4–8 hours):');
  if (r.short_term_actions && r.short_term_actions.length) r.short_term_actions.forEach((a,i)=>lines.push(` ${i+1}. ${a}`));
  else lines.push(' - Standard checks: vitals q4h, labs PRN, review meds.');

  lines.push('');
  lines.push('ONGOING MONITORING PRIORITIES:');
  if (r.monitoring_priorities && r.monitoring_priorities.length) r.monitoring_priorities.forEach((m,i)=>lines.push(` ${i+1}. ${m}`));
  else lines.push(' - HR, BP, RR, SpO2, urine output, wound drainage (frequency per severity).');

  lines.push('');
  lines.push('ESCALATION CRITERIA (WHEN TO CALL):');
  if (r.escalation_criteria && r.escalation_criteria.length) r.escalation_criteria.forEach((e,i)=>lines.push(` ${i+1}. ${e}`));
  else lines.push(' - SBP <90; SpO2 <90%; HR >130; new altered mental status; uncontrolled bleeding.');

  lines.push('');
  lines.push('CLINICAL SUMMARY:');
  lines.push(' ' + (r.clinical_summary || 'No summary provided by LLM.'));

  const text = lines.join('\n');

  // Minimal safe HTML (escape to avoid injection)
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const html = `<pre style="white-space:pre-wrap; font-family:monospace;">${esc(text)}</pre>`;

  return { text, html };
}

// Defensive exports to ensure compatibility with other modules
module.exports = {
  extractVitalsAndMetadata: typeof extractVitalsAndMetadata === 'function' ? extractVitalsAndMetadata : undefined,
  computeRuleScore: typeof computeRuleScore === 'function' ? computeRuleScore : undefined,
  getLLMSystemPrompt: typeof getLLMSystemPrompt === 'function' ? getLLMSystemPrompt : undefined,
  formatLLMUserPrompt: typeof formatLLMUserPrompt === 'function' ? formatLLMUserPrompt : undefined,
  parseLLMResponse: typeof parseLLMResponse === 'function' ? parseLLMResponse : undefined,
  parseLLMResponseImproved: typeof parseLLMResponseImproved === 'function' ? parseLLMResponseImproved : undefined,
  generateAssessmentReport: typeof generateAssessmentReport === 'function' ? generateAssessmentReport : undefined,
  formatReportForDisplay: typeof formatReportForDisplay === 'function' ? formatReportForDisplay : undefined
};
