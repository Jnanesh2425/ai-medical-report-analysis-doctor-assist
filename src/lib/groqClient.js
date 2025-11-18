// src/lib/groqClient.js
const axios = require('axios');

async function callGroq(promptText) {
  const url = process.env.GROQ_API_URL;   // should point to your Groq/OpenAI-compatible endpoint
  const model = process.env.GROQ_MODEL;

  if (!url || !model || !process.env.GROQ_API_KEY) {
    throw new Error("Missing Groq env configuration");
  }

  // OpenAI-compatible payload
  const payload = {
    model,
    messages: [
      { role: "user", content: promptText }
    ],
    temperature: 0,
    max_tokens: 800
  };

  try {
    const res = await axios.post(url, payload, {
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 30_000
    });

    // Standard OpenAI chat response, or fallback to entire response
    const text =
      res.data?.choices?.[0]?.message?.content ||
      JSON.stringify(res.data);

    return { raw: res.data, text };
  } catch (err) {
    const data = err.response?.data || err.message;
    throw new Error("Groq request failed: " + JSON.stringify(data));
  }
}

/**
 * buildPrompt
 * - Asks the model to return *only* valid JSON with required keys.
 * - Forces inclusion of clinical_summary and at least one immediate_action.
 */
function buildPrompt({ dischargeText, vitalsSummary, rule_score }) {
  return `
You are a clinical post-op risk evaluator for nursing staff. Read the discharge note and vitals below and RETURN ONLY valid JSON (no surrounding text, no commentary). The JSON MUST contain the exact keys shown. If you cannot determine a field, return an empty array or short string, but still include the key.

Discharge note:
${dischargeText}

VitalsSummary:
${JSON.stringify(vitalsSummary)}

Rule-based score: ${rule_score}

Return JSON exactly in this shape (use these exact keys and values where possible):

{
  "llm_label": "Low" | "Medium" | "High" | "Critical",
  "top_reasons": ["reason1","reason2","reason3"],                // 1-5 short reasons (strings)
  "confidence": "low" | "medium" | "high",
  "clinical_summary": "one to two sentence nurse-friendly summary",
  "immediate_actions": ["action1","action2"],                    // actions within 1 hour (at least 1)
  "short_term_actions": ["action1","action2"],                   // actions within 4-8 hours
  "monitoring_priorities": ["param: frequency", "..."],          // optional
  "escalation_criteria": ["criterion1","criterion2"]             // optional
}

Important instructions:
- RESPOND ONLY WITH VALID JSON. Do not include any prose or explanation outside the JSON.
- llm_label must be one of: Low, Medium, High, Critical.
- confidence must be one of: low, medium, high.
- Provide at least one immediate_actions item even if minimal (e.g., "Monitor vitals q15min; escalate if SBP<90 or SpO2<90%").
- top_reasons should be concise and specific (include values where relevant, e.g., "Hb 6.8 g/dL").
- Keep clinical_summary short (1-2 sentences).
- If you cannot determine a value, return an empty array or short string but keep the key present.

Do not output anything else besides the JSON object.
  `.trim();
}

module.exports = { callGroq, buildPrompt };
