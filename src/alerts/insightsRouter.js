// src/alerts/insightsRouter.js - REST API for care coordinator insights
// Endpoint: POST /api/insights

const express = require('express');
const router = express.Router();
const { callGroq } = require('../lib/groqClient');

// Middleware for JSON parsing
router.use(express.json());

// Insights prompts
const INSIGHTS_SYSTEM_PROMPT = `You are an expert clinical assistant helping post-operative care coordinators. Given patient vitals, labs, rule-based risk score timeline, and discharge notes, provide actionable clinical insights.

Output ONLY valid JSON with this exact structure:

{
  "risk_label": "Low"|"Medium"|"High"|"Critical",
  "confidence": "low"|"medium"|"high",
  "top_drivers": ["driver1", "driver2", "driver3"],
  "recommended_actions": [
    {"action": "specific action text", "triage": "Call now"|"Schedule visit"|"Monitor"}
  ],
  "summary": "2-3 sentence clinical summary"
}

Do not include markdown formatting.`;

const INSIGHTS_USER_PROMPT = (vitals, labs, notes, ruleHistory) => `Analyze this post-operative patient data:

VITALS:
${JSON.stringify(vitals, null, 2)}

LABS:
${JSON.stringify(labs, null, 2)}

RISK SCORE TIMELINE (0-20 scale):
${ruleHistory ? JSON.stringify(ruleHistory.slice(-20), null, 2) : 'No timeline available'}

CLINICAL NOTES (first 4000 chars):
${notes.substring(0, 4000)}

Provide your analysis in the JSON format specified. Focus on:
1. Key clinical drivers of current risk level
2. Specific, actionable recommendations with appropriate triage urgency
3. Clear summary for nursing staff`;

/**
 * POST /api/insights
 * Generate care coordinator insights for a patient
 * Body: { patientId, report: { vitals, labs, notes, procedure }, rule_history? }
 */
router.post('/insights', async (req, res) => {
  try {
    const { patientId, report, rule_history } = req.body;
    
    // Validation
    if (!patientId || typeof patientId !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'patientId is required and must be a string'
      });
    }
    
    if (!report || typeof report !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'report is required and must be an object'
      });
    }
    
    const { vitals = {}, labs = {}, notes = '', procedure = '' } = report;
    
    console.log(`insightsRouter: generating insights for patient ${patientId}`);
    
    // Step 1: Truncate notes to 4000 chars
    const truncatedNotes = String(notes || '').substring(0, 4000);
    
    // Step 2: Format rule history (limit to last 20 entries)
    const formattedRuleHistory = Array.isArray(rule_history) 
      ? rule_history.slice(-20).map(entry => ({
          ts: entry.ts || entry.timestamp || new Date().toISOString(),
          score: typeof entry.score === 'number' ? entry.score : 0
        }))
      : null;
    
    // Step 3: Build prompt
    const fullPrompt = `${INSIGHTS_SYSTEM_PROMPT}\n\n${INSIGHTS_USER_PROMPT(vitals, labs, truncatedNotes, formattedRuleHistory)}`;
    
    // Step 4: Call Groq
    let groqResponse;
    try {
      // Note: callGroq expects a single prompt string, but we need to pass system + user
      // We'll combine them as a single user message for now
      groqResponse = await callGroq(fullPrompt);
    } catch (groqErr) {
      console.error('insightsRouter: Groq call failed', groqErr && groqErr.message);
      return res.status(500).json({
        ok: false,
        error: 'Failed to generate insights',
        details: groqErr.message || String(groqErr)
      });
    }
    
    // Step 5: Parse response
    const responseText = String((groqResponse && groqResponse.text) ? groqResponse.text : '').trim();
    
    let insights;
    try {
      // Try direct JSON parse
      let jsonText = responseText;
      
      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      // Try to extract JSON object if wrapped in text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
      
      insights = JSON.parse(jsonText);
      
      // Validate structure
      if (!insights.risk_label) insights.risk_label = 'Medium';
      if (!insights.confidence) insights.confidence = 'medium';
      if (!Array.isArray(insights.top_drivers)) insights.top_drivers = [];
      if (!Array.isArray(insights.recommended_actions)) insights.recommended_actions = [];
      if (!insights.summary) insights.summary = 'No summary available';
      
    } catch (parseErr) {
      console.warn('insightsRouter: JSON parse failed, returning raw text', parseErr && parseErr.message);
      return res.json({
        ok: true,
        insights: {
          raw: responseText,
          error: 'Failed to parse JSON response'
        },
        patientId
      });
    }
    
    return res.json({
      ok: true,
      insights,
      patientId
    });
    
  } catch (err) {
    console.error('insightsRouter: POST /insights error', err && err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || String(err)
    });
  }
});

module.exports = router;



