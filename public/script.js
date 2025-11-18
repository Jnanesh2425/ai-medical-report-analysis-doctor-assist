// public/script.js
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const clearBtn = document.getElementById("clearBtn");
const resultBox = document.getElementById("result");
const loading = document.getElementById("loading");

uploadBtn.addEventListener("click", async () => {
  // collect fields
  const patientId = document.getElementById("patientId").value.trim();
  const patientName = document.getElementById("patientName").value.trim();
  const age = document.getElementById("patientAge").value.trim();
  const sex = document.getElementById("patientSex").value;
  const tempManual = document.getElementById("tempManual").value.trim();
  const hrManual = document.getElementById("hrManual").value.trim();
  const rrManual = document.getElementById("rrManual").value.trim();
  const bpManual = document.getElementById("bpManual").value.trim();
  const spo2Manual = document.getElementById("spo2Manual").value.trim();

  const formData = new FormData();

  // append file if provided
  if (fileInput.files.length) {
    formData.append("file", fileInput.files[0]);
  }

  // append patient fields (backend will merge these)
  if (patientId) formData.append("patientId", patientId);
  if (patientName) formData.append("patientName", patientName);
  if (age) formData.append("age", age);
  if (sex) formData.append("sex", sex);
  if (tempManual) formData.append("tempManual", tempManual);
  if (hrManual) formData.append("hrManual", hrManual);
  if (rrManual) formData.append("rrManual", rrManual);
  if (bpManual) formData.append("bpManual", bpManual);
  if (spo2Manual) formData.append("spo2Manual", spo2Manual);

  loading.classList.remove("hidden");
  resultBox.classList.add("hidden");

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    loading.classList.add("hidden");

    if (data.error) {
      resultBox.innerHTML = `<p style="color:red">Error: ${JSON.stringify(data.error)}</p>`;
      resultBox.classList.remove("hidden");
      return;
    }

    // Save to local storage
    if (window.storage && window.storage.savePatientReport) {
      window.storage.savePatientReport(data);
      
      // Dispatch custom event to notify dashboard
      window.dispatchEvent(new CustomEvent('patientAdded', { detail: data }));
      
      // Trigger dashboard refresh if it's open
      if (window.loadDashboard) {
        setTimeout(() => {
          const dashboardTab = document.getElementById('dashboard-tab');
          if (dashboardTab && dashboardTab.classList.contains('active')) {
            window.loadDashboard();
          }
        }, 500);
      }
    }

    renderResult(data);

  } catch (e) {
    loading.classList.add("hidden");
    resultBox.innerHTML = `<p style="color:red">Failed: ${e.toString()}</p>`;
    resultBox.classList.remove("hidden");
  }
});

clearBtn.addEventListener("click", () => {
  document.getElementById("patientId").value = "";
  document.getElementById("patientName").value = "";
  document.getElementById("patientAge").value = "";
  document.getElementById("patientSex").value = "";
  document.getElementById("tempManual").value = "";
  document.getElementById("hrManual").value = "";
  document.getElementById("rrManual").value = "";
  document.getElementById("bpManual").value = "";
  document.getElementById("spo2Manual").value = "";
  fileInput.value = "";
  resultBox.classList.add("hidden");
});

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderResult(data) {
  const { final_label, rule, llm, merged } = data || {};
  const patient = data.patient || {};
  const displayHtml = data.display_html || null;
  const reportMarkdown = data.report_markdown || null;
  const reportStructured = data.report_structured || null;

  // Clinical summary & actions
  const clinicalSummary = (reportStructured && reportStructured.clinical_summary) || (llm && llm.parsed && llm.parsed.clinical_summary) || '';
  const immediateActions = (llm && llm.immediate_actions) || (reportStructured && reportStructured.immediate_actions) || [];
  const shortTermActions = (llm && llm.short_term_actions) || (reportStructured && reportStructured.short_term_actions) || [];
  const monitoringPriorities = (reportStructured && reportStructured.monitoring_priorities) || (llm && llm.parsed && llm.parsed.monitoring_priorities) || [];
  const escalationCriteria = (reportStructured && reportStructured.escalation_criteria) || (llm && llm.parsed && llm.parsed.escalation_criteria) || [];

  // Build header (support Critical color)
  const color = final_label === 'Critical' ? '#8B0000' : (final_label === 'High' ? '#c70000' : (final_label === 'Medium' ? '#c67a00' : '#0a7a3a'));
  const header = `
    <h2>Risk Assessment Result</h2>
    <p><strong>Patient:</strong> ${escapeHtml(patient.id || '')}${patient.name ? ' / ' + escapeHtml(patient.name) : ''}${patient.age ? ' / ' + escapeHtml(String(patient.age)) + ' yrs' : ''}${patient.sex ? ' / ' + escapeHtml(patient.sex) : ''}</p>
    <p><strong>Final Label:</strong> <span style="color:${color}">${escapeHtml(final_label || 'Unknown')}</span></p>
  `;

  // Rule-based details
  const ruleHtml = rule ? `
    <h3>Rule-based Score</h3>
    <p><strong>Score:</strong> ${escapeHtml(String(rule.rule_score))} (${escapeHtml(rule.rule_label)})</p>
    <ul class="reason-list">${(rule.breakdown || []).map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
  ` : `<h3>Rule-based Score</h3><p>- Not available</p>`;

  // LLM details (normalize names from server)
  const llmLabel = escapeHtml((llm && (llm.llm_label || (llm.parsed && llm.parsed.risk_level))) || 'Medium');
  const llmConfidence = escapeHtml((llm && (llm.confidence || (llm.parsed && llm.parsed.confidence))) || 'medium');
  const topReasons = (llm && (llm.top_reasons || (llm.parsed && llm.parsed.primary_concerns))) || (data.llm && data.llm.top_reasons) || [];

  const llmHtml = `
    <h3>LLM Analysis</h3>
    <p><strong>LLM Label:</strong> ${llmLabel}</p>
    <p><strong>Confidence:</strong> ${llmConfidence}</p>
    <p><strong>Top reasons:</strong></p>
    ${topReasons.length ? `<ul class="reason-list">${topReasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : '<p>- No reasons returned</p>'}
  `;

  // Clinical summary block — show patient name if present
  const patientNameDisplay = patient.name ? `${escapeHtml(patient.name)} — ` : '';
  const summaryHtml = clinicalSummary ? `<h3>Clinical Summary</h3><p><strong>${patientNameDisplay}</strong>${escapeHtml(clinicalSummary)}</p>` : '';

  // Immediate and short-term actions blocks
  const immediateHtml = immediateActions && immediateActions.length ? `<h4>Immediate Actions (within 1 hour)</h4><ol>${immediateActions.map(a=>`<li>${escapeHtml(a)}</li>`).join('')}</ol>` : '';
  const shortTermHtml = shortTermActions && shortTermActions.length ? `<h4>Short-term Actions (4-8 hours)</h4><ol>${shortTermActions.map(a=>`<li>${escapeHtml(a)}</li>`).join('')}</ol>` : '';

  // Monitoring priorities & escalation criteria
  const monitoringHtml = monitoringPriorities && monitoringPriorities.length ? `<h4>Monitoring Priorities</h4><ol>${monitoringPriorities.map(m=>`<li>${escapeHtml(m)}</li>`).join('')}</ol>` : '';
  const escalationHtml = escalationCriteria && escalationCriteria.length ? `<h4>Escalation Criteria (When to call)</h4><ol>${escalationCriteria.map(e=>`<li>${escapeHtml(e)}</li>`).join('')}</ol>` : '';

  

  // Full human-friendly report (server-produced escaped HTML). Use this as primary display.
  const fullReportHtml = displayHtml ? `
    <hr />
    <h3> Final  Assessment</h3>
    <div id="full-report">${displayHtml}</div>
  ` : (reportMarkdown ? `
    <hr />
    <h3>Full Report (markdown)</h3>
    <pre style="white-space:pre-wrap;">${escapeHtml(reportMarkdown)}</pre>
  ` : `
    <hr />
    <h3>Full Report</h3>
    <p>- No full report available from server.</p>
  `);

  // Add optional structured JSON viewer for debugging
  const structuredHtml = reportStructured ? `
    <details style="margin-top:1rem">
      <summary><strong>View structured report (JSON)</strong></summary>
      <pre style="white-space:pre-wrap; max-height:300px; overflow:auto; background:#fafafa; padding:8px; border:1px solid #eee;">${escapeHtml(JSON.stringify(reportStructured, null, 2))}</pre>
    </details>
  ` : '';

  // Compose everything
  resultBox.innerHTML = `
    ${header}
    ${ruleHtml}
    ${llmHtml}
    ${summaryHtml}
    ${immediateHtml}
    ${shortTermHtml}
    ${monitoringHtml}
    ${escalationHtml}
    ${fullReportHtml}
    ${structuredHtml}
  `;
  resultBox.classList.remove("hidden");
}
