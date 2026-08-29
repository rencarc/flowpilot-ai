const workflowTemplates = [
  {
    id: "it-access-review",
    name: "IT Access Review",
    category: "Sensitive access",
    status: "Active",
    reviewer: "Security reviewer",
    handoffTarget: "n8n -> IT service desk",
    requiredFields: ["employee", "system", "access level", "business reason", "manager approval", "expiration date"],
    riskGates: ["Admin access requires review", "Payroll, finance, and identity systems are sensitive", "Temporary access must include an expiration date"],
  },
  {
    id: "gdpr-deletion-review",
    name: "GDPR Deletion Review",
    category: "Data privacy",
    status: "Active",
    reviewer: "Privacy reviewer",
    handoffTarget: "n8n -> Data operations",
    requiredFields: ["subject email", "request source", "identity verification", "retention check", "confirmation recipient"],
    riskGates: ["Identity verification is required", "Legal retention must be checked", "Deletion actions must be audited"],
  },
  {
    id: "legal-contract-review",
    name: "Legal Contract Review",
    category: "Legal operations",
    status: "Active",
    reviewer: "Legal reviewer",
    handoffTarget: "n8n -> Legal intake",
    requiredFields: ["customer name", "contract version", "clause type", "proposed clause", "deadline", "deal value"],
    riskGates: ["Liability, indemnity, DPA, and payment changes require legal review", "Customer-facing commitments require approval"],
  },
];

const cases = [
  {
    id: "access-payroll",
    title: "Payroll admin access request",
    caseType: "Sensitive access request",
    category: "Security / IAM",
    priority: "High",
    riskLevel: "High",
    status: "In Review",
    handoffStatus: "Blocked",
    confidence: 0.88,
    createdAt: "Today, 09:12",
    requester: "People Operations",
    department: "HR",
    templateId: "it-access-review",
    raw: "Emma needs temporary admin access to the payroll system before Friday because payroll close is delayed.",
    summary: "A temporary payroll admin access request was submitted with urgency, but it touches a sensitive system and lacks required approval evidence.",
    extractedFields: {
      Employee: "Emma",
      System: "Payroll",
      "Access level": "Admin",
      Deadline: "Before Friday",
      Reason: "Payroll close is delayed",
    },
    missingInfo: ["Manager approval evidence", "Access expiration date"],
    matchedRules: ["Payroll is a sensitive system", "Admin access requires security review", "Temporary access requires an expiration date"],
    reviewReason: "Payroll admin access is high risk and cannot be handed off until approval evidence and expiration date are provided.",
    recommendation: "Request manager approval, confirm the shortest sufficient access level, add an expiration date, then route to Security review.",
    actions: ["Request manager approval evidence", "Confirm least-privilege role", "Assign Security reviewer", "Prepare IT access handoff"],
    handoffPayload: {
      template: "it_access_review",
      employee: "Emma",
      system: "Payroll",
      requested_role: "Admin",
      risk_level: "High",
      missing_info: ["manager_approval", "expiration_date"],
      review_required: true,
    },
  },
  {
    id: "gdpr-anna",
    title: "GDPR deletion request for anna@example.com",
    caseType: "Data deletion request",
    category: "Privacy / Compliance",
    priority: "High",
    riskLevel: "High",
    status: "Needs Info",
    handoffStatus: "Blocked",
    confidence: 0.91,
    createdAt: "Today, 10:28",
    requester: "Customer Operations",
    department: "Support",
    templateId: "gdpr-deletion-review",
    raw: "A customer asks us to delete all personal data connected to anna@example.com and confirm completion today.",
    summary: "The request appears to be a GDPR right-to-erasure case requiring identity verification, retention review, and auditable handling.",
    extractedFields: {
      "Subject email": "anna@example.com",
      Request: "Delete all personal data",
      Deadline: "Today",
      Confirmation: "Required",
      "Compliance area": "GDPR / Right to erasure",
    },
    missingInfo: ["Identity verification", "Request source", "Legal retention check"],
    matchedRules: ["Identity verification is required before deletion", "Deletion must be audited", "Retention obligations must be checked"],
    reviewReason: "The system cannot create a deletion handoff until identity verification and retention checks are complete.",
    recommendation: "Verify the requester identity, check retention obligations, identify affected systems, then route to Privacy review.",
    actions: ["Verify requester identity", "Check legal retention policy", "Prepare data operations handoff", "Draft confirmation response"],
    handoffPayload: {
      template: "gdpr_deletion_review",
      subject_email: "anna@example.com",
      systems_to_check: ["CRM", "Support", "Billing", "Analytics"],
      verification_required: true,
      audit_required: true,
    },
  },
  {
    id: "legal-liability",
    title: "Enterprise contract liability clause change",
    caseType: "Legal contract review",
    category: "Legal / Sales",
    priority: "High",
    riskLevel: "High",
    status: "In Review",
    handoffStatus: "Ready",
    confidence: 0.84,
    createdAt: "Yesterday, 16:44",
    requester: "Sales",
    department: "Revenue",
    templateId: "legal-contract-review",
    raw: "Sales wants to change the liability clause in an enterprise customer contract before the deal closes tomorrow.",
    summary: "A revenue team is requesting a liability clause change under time pressure, which requires legal review before any customer commitment.",
    extractedFields: {
      Department: "Sales",
      "Contract type": "Enterprise customer contract",
      Clause: "Liability",
      Deadline: "Tomorrow",
      Impact: "Deal close depends on review",
    },
    missingInfo: ["Customer name", "Contract version", "Proposed clause text", "Deal value"],
    matchedRules: ["Liability clause changes require Legal review", "Customer-facing commitments require approval"],
    reviewReason: "Liability changes carry legal risk and cannot be approved by Sales or AI without Legal review.",
    recommendation: "Ask Sales for the contract version and proposed clause text, then route the request to Legal with deal context and deadline.",
    actions: ["Request contract version", "Collect proposed clause text", "Assign Legal reviewer", "Prepare legal review handoff"],
    handoffPayload: {
      template: "legal_contract_review",
      department: "Sales",
      clause_type: "Liability",
      deadline: "Tomorrow",
      risk_level: "High",
      missing_info: ["customer_name", "contract_version", "proposed_clause", "deal_value"],
    },
  },
];

let mutableCases = structuredClone(cases);
let mutableActions = [
  { id: "act-1", caseId: "access-payroll", title: "Request manager approval evidence", status: "needs_changes", risk: "High", owner: "Security reviewer" },
  { id: "act-2", caseId: "access-payroll", title: "Prepare IT access review handoff", status: "in_review", risk: "High", owner: "Security reviewer" },
  { id: "act-3", caseId: "gdpr-anna", title: "Verify requester identity", status: "needs_changes", risk: "High", owner: "Privacy reviewer" },
  { id: "act-4", caseId: "gdpr-anna", title: "Check legal retention policy", status: "in_review", risk: "High", owner: "Privacy reviewer" },
  { id: "act-5", caseId: "legal-liability", title: "Route liability clause request to Legal", status: "approved", risk: "High", owner: "Legal reviewer" },
];

let handoffRuns = [
  { id: "run-101", caseId: "legal-liability", template: "Legal Contract Review", provider: "n8n mock", status: "ready", lastEvent: "Approved by Legal intake owner", payload: "legal_contract_review" },
  { id: "run-102", caseId: "access-payroll", template: "IT Access Review", provider: "n8n mock", status: "blocked", lastEvent: "Waiting for manager approval evidence", payload: "it_access_review" },
  { id: "run-103", caseId: "gdpr-anna", template: "GDPR Deletion Review", provider: "n8n mock", status: "blocked", lastEvent: "Identity verification missing", payload: "gdpr_deletion_review" },
];

const policies = [
  { title: "Privileged Access Policy", trigger: "Admin access to payroll, finance, or identity systems", requirement: "Security review and expiration date required", usedBy: "IT Access Review", citations: 6 },
  { title: "GDPR Deletion Policy", trigger: "Personal data deletion or right-to-erasure request", requirement: "Identity verification, retention check, and audit log required", usedBy: "GDPR Deletion Review", citations: 4 },
  { title: "Contract Risk Policy", trigger: "Liability, indemnity, DPA, or payment term changes", requirement: "Legal review required before customer commitment", usedBy: "Legal Contract Review", citations: 5 },
];

let auditEvents = [
  "AI structured payroll access request with 88% confidence",
  "Rule matched: Payroll admin access requires Security review",
  "GDPR deletion request blocked because identity verification is missing",
  "Legal contract review handoff marked ready for n8n mock target",
  "Reviewer approved Legal handoff payload",
];

let currentView = "login";
let selectedCaseId = mutableCases[0].id;
let draftInput = mutableCases[0].raw;
let draftPreviewId = mutableCases[0].id;
const app = document.querySelector("#app");

function logoMark() {
  return `<img class="logo-mark" src="./assets/flowpilot-logo.png?v=20260818-logo" alt="" />`;
}

function cls(value) {
  return String(value).toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
}

function getTemplate(id) {
  return workflowTemplates.find((template) => template.id === id) || workflowTemplates[0];
}

function tag(label, type = "") {
  return `<span class="tag ${type || cls(label)}">${label}</span>`;
}

function navButton(id, label, icon) {
  return `<button class="${currentView === id ? "active" : ""}" onclick="navigate('${id}')"><span>${icon}</span>${label}</button>`;
}

function shell(content) {
  return `
    <section class="app-shell">
      <aside class="sidebar">
        <div class="brand-row">${logoMark()}<span>FlowPilot AI</span></div>
        <button class="new-case" onclick="navigate('create')">+ New request</button>
        <div class="nav-group-label">Workspace</div>
        <nav class="nav">
          ${navButton("dashboard", "Overview", "◎")}
          ${navButton("cases", "Cases", "□")}
          ${navButton("review", "Review Queue", "✓")}
          ${navButton("workflows", "Workflows", "◇")}
          ${navButton("knowledge", "Knowledge", "▤")}
          ${navButton("audit", "Audit Logs", "◷")}
          ${navButton("settings", "Settings", "⚙")}
        </nav>
        <div class="workspace-card">
          <strong>Admin / Ops Lead view</strong>
          <span>Role model ready for Operator, Reviewer, Admin, and Owner.</span>
          <div class="mini-progress"><i style="width:72%"></i></div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="crumb">Private › FlowPilot workspace</div>
          <input class="input search" placeholder="Search cases, templates, policies..." />
          <div class="user-chip"><span>Acme Internal Ops</span><div class="avatar">XL</div></div>
        </header>
        <section class="content">${content}</section>
      </main>
    </section>
  `;
}

function pageHeader(title, subtitle, action = "") {
  return `<div class="page-header"><div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}

function metrics() {
  const total = mutableCases.length;
  const review = mutableActions.filter((a) => ["in_review", "needs_changes"].includes(a.status)).length;
  const missing = mutableCases.filter((c) => c.missingInfo.length > 0).length;
  const ready = handoffRuns.filter((h) => h.status === "ready").length;
  return { total, review, missing, ready, auto: Math.max(0, total - review), high: mutableCases.filter((c) => c.riskLevel === "High").length };
}

function dashboard() {
  const m = metrics();
  return shell(`
    ${pageHeader("Workflow health", "Track how messy requests become structured, governed, and ready for safe handoff.", `<button class="primary-btn" onclick="navigate('create')">+ New intake</button>`)}
    <div class="metric-strip">
      ${metric("Total cases", m.total, "Structured internal requests")}
      ${metric("Auto-routed", m.auto, "Low-risk or ready paths")}
      ${metric("Review required", m.review, "Human decision needed")}
      ${metric("Missing info", m.missing, "Blocked before handoff")}
      ${metric("Handoff ready", m.ready, "Approved payloads")}
    </div>
    <div class="monitor-grid">
      <section class="panel wide">
        <div class="panel-header"><h2>Risk and handoff monitor</h2>${tag("Policy gated", "approved")}</div>
        <div class="chart-grid">
          ${spark("Case intake", "73", [34,22,22,55,40,18,26,63,31,22,28,44,20,62,18,43,18,55,31,52,10,10])}
          ${spark("Avg review time", "5.2h", [64,64,43,58,34,42,28,66,55,38,47,40,58,12,55,48,44,60,54,48,10,10])}
          ${spark("Handoff success", "82%", [12,12,12,12,12,12,12,48,12,12,12,12,12,12,44,12,12,12,12,12,8,8])}
          ${spark("Policy confidence", "0.87", [5,55,55,55,5,62,5,24,65,65,65,65,5,66,58,49,8,8])}
        </div>
      </section>
      <aside class="panel side-feed">
        <div class="panel-header"><h2>Recent audit</h2></div>
        <div class="timeline">${auditEvents.map(eventItem).join("")}</div>
      </aside>
    </div>
    <div class="grid-2">
      <section class="panel">
        <div class="panel-header"><h2>Recent cases</h2><button class="secondary-btn" onclick="navigate('cases')">View all</button></div>
        <div class="table">${caseRows(mutableCases.slice(0, 3))}</div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Review queue</h2>${tag(`${m.review} items`, "review")}</div>
        <div class="action-list">${mutableActions.slice(0, 4).map(actionRow).join("")}</div>
      </section>
    </div>
  `);
}

function metric(label, value, note) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
}

function spark(title, value, points) {
  const poly = points.map((p, i) => `${(i / (points.length - 1)) * 100},${70 - p}`).join(" ");
  return `<div class="spark-card"><div class="row-between"><h3>${title}</h3><strong>${value}</strong></div><svg viewBox="0 0 100 78" preserveAspectRatio="none"><polyline points="${poly}" /></svg></div>`;
}

function caseRows(items) {
  return `
    <div class="table-row table-head"><span>Case</span><span>Risk</span><span>Template</span><span>Status</span><span>Handoff</span></div>
    ${items
      .map(
        (item) => `
        <button class="table-row" onclick="openCase('${item.id}')">
          <span><strong>${item.title}</strong><small>${item.caseType}</small></span>
          <span>${tag(item.riskLevel, item.riskLevel)}</span>
          <span>${getTemplate(item.templateId).name}</span>
          <span>${tag(item.status, item.status)}</span>
          <span>${tag(item.handoffStatus, item.handoffStatus)}</span>
        </button>`,
      )
      .join("")}
  `;
}

function casesPage() {
  return shell(`
    ${pageHeader("Cases", "Structured requests with risk level, template match, review state, and handoff status.", `<button class="primary-btn" onclick="navigate('create')">+ New intake</button>`)}
    <div class="tabs"><button class="tab active">All</button><button class="tab">High risk</button><button class="tab">Needs info</button><button class="tab">Handoff ready</button></div>
    <section class="panel"><div class="table">${caseRows(mutableCases)}</div></section>
  `);
}

function createPage() {
  const preview = mutableCases.find((item) => item.id === draftPreviewId) || mutableCases[0];
  return shell(`
    ${pageHeader("New request", "Paste an internal request. The mock AI output shows how one model call will structure, risk-score, and route it.", `<button class="secondary-btn" onclick="openCase('${preview.id}')">Open preview case</button>`)}
    <div class="create-layout">
      <section class="panel">
        <div class="panel-header"><h2>Raw request</h2>${tag("Mock structured output", "pending")}</div>
        <div class="panel-body">
          <textarea id="case-input" class="textarea">${draftInput}</textarea>
          <div class="split-actions">
            <button class="primary-btn" onclick="analyzeDraft()">Analyze request</button>
            <button class="secondary-btn" onclick="createMockCase()">Create mock case</button>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Demo scenarios</h2></div>
        <div class="panel-body examples">${mutableCases.map((item) => `<button class="example-btn" onclick="loadExample('${item.id}')"><strong>${item.caseType}</strong><span>${item.raw}</span></button>`).join("")}</div>
      </section>
    </div>
    <br />
    ${structurePreview(preview)}
  `);
}

function structurePreview(item) {
  return `
    <section class="panel">
      <div class="panel-header"><h2>AI structure preview</h2><div class="tags">${tag(item.riskLevel, item.riskLevel)}${tag(`${Math.round(item.confidence * 100)}% confidence`, "approved")}</div></div>
      <div class="panel-body structure-grid">
        <div><h3>Structured output</h3><div class="kv">${kv("Case type", item.caseType)}${kv("Priority", item.priority)}${kv("Suggested workflow", getTemplate(item.templateId).name)}${kv("Review required", "Yes")}</div></div>
        <div><h3>Missing info</h3><div class="pill-list">${item.missingInfo.map((x) => tag(x, "review")).join("")}</div><h3>Rule validation</h3><div class="pill-list">${item.matchedRules.map((x) => tag(x, "neutral")).join("")}</div></div>
        <div><h3>Recommended actions</h3><ol class="clean-list">${item.actions.map((x) => `<li>${x}</li>`).join("")}</ol></div>
      </div>
    </section>
  `;
}

function caseDetailPage() {
  const item = mutableCases.find((c) => c.id === selectedCaseId) || mutableCases[0];
  const template = getTemplate(item.templateId);
  const itemActions = mutableActions.filter((a) => a.caseId === item.id);
  return shell(`
    ${pageHeader(item.title, "Single-case view: AI structure, policy gates, review decisions, handoff payload, and audit trail.", `<button class="secondary-btn" onclick="navigate('cases')">Back to cases</button>`)}
    <div class="detail-grid">
      <section class="panel">
        <div class="panel-header"><h2>Request</h2>${tag(item.riskLevel, item.riskLevel)}</div>
        <div class="panel-body">
          <div class="raw-box">${item.raw}</div>
          <div class="kv">${kv("Requester", item.requester)}${kv("Department", item.department)}${kv("Status", item.status)}${kv("Confidence", `${Math.round(item.confidence * 100)}%`)}</div>
          <h3>Extracted fields</h3>
          <div class="kv">${Object.entries(item.extractedFields).map(([k, v]) => kv(k, v)).join("")}</div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Risk control</h2>${tag("Policy matched", "approved")}</div>
        <div class="panel-body">
          <h3>Summary</h3><p class="muted">${item.summary}</p>
          <h3>Recommendation</h3><p>${item.recommendation}</p>
          <h3>Matched rules</h3><div class="pill-list">${item.matchedRules.map((r) => tag(r, "neutral")).join("")}</div>
          <h3>Missing information</h3><div class="pill-list">${item.missingInfo.map((m) => tag(m, "review")).join("")}</div>
          <h3>Workflow template</h3><div class="quote-box"><strong>${template.name}</strong><br />Reviewer: ${template.reviewer}<br />Target: ${template.handoffTarget}</div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Handoff control</h2>${tag(item.handoffStatus, item.handoffStatus)}</div>
        <div class="panel-body">
          <div class="quote-box">${item.reviewReason}</div>
          <h3>Actions</h3><div class="action-list">${itemActions.map(actionRow).join("")}</div>
          <h3>Payload preview</h3><pre class="payload">${JSON.stringify(item.handoffPayload, null, 2)}</pre>
          <h3>Audit trail</h3><div class="timeline">${auditEvents.slice(0, 4).map(eventItem).join("")}</div>
        </div>
      </section>
    </div>
  `);
}

function kv(key, value) {
  return `<div class="kv-item"><span>${key}</span><strong>${value}</strong></div>`;
}

function actionRow(action) {
  const item = mutableCases.find((c) => c.id === action.caseId);
  return `<article class="action-row"><div><h3>${action.title}</h3><p>${item?.title || "Linked case"} · Owner: ${action.owner}</p></div><div class="tags">${tag(action.risk, action.risk)}${tag(action.status, action.status)}</div></article>`;
}

function reviewPage() {
  const reviewItems = mutableActions.filter((a) => ["in_review", "needs_changes"].includes(a.status));
  return shell(`
    ${pageHeader("Review queue", "Only high-risk, incomplete, or policy-sensitive actions are routed here for human judgment.")}
    <div class="review-list">${reviewItems
      .map((action) => {
        const item = mutableCases.find((c) => c.id === action.caseId);
        return `<section class="panel review-item">
          <div class="panel-header"><h2>${action.title}</h2>${tag(action.status, action.status)}</div>
          <div class="panel-body">
            <p class="muted">${item.reviewReason}</p>
            <div class="pill-list">${item.missingInfo.map((m) => tag(m, "review")).join("")}</div>
            <div class="split-actions">
              <button class="primary-btn" onclick="reviewAction('${action.id}', 'approved')">Approve</button>
              <button class="secondary-btn" onclick="reviewAction('${action.id}', 'needs_changes')">Request changes</button>
              <button class="danger-btn" onclick="reviewAction('${action.id}', 'rejected')">Reject</button>
            </div>
          </div>
        </section>`;
      })
      .join("")}</div>
  `);
}

function workflowsPage() {
  return shell(`
    ${pageHeader("Workflows", "Approved templates, handoff runs, and AI-assisted template drafts. AI can suggest, but only approved templates can route work.")}
    <div class="tabs"><button class="tab active">Templates</button><button class="tab">Handoffs</button><button class="tab">Builder draft</button></div>
    <div class="workflow-grid">
      <section class="panel">
        <div class="panel-header"><h2>Approved templates</h2>${tag("3 active", "approved")}</div>
        <div class="panel-body template-list">${workflowTemplates.map(templateCard).join("")}</div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Handoff runs</h2>${tag("n8n-ready", "pending")}</div>
        <div class="panel-body action-list">${handoffRuns.map(handoffRow).join("")}</div>
      </section>
      <section class="panel builder-panel">
        <div class="panel-header"><h2>AI template builder</h2>${tag("Draft only", "review")}</div>
        <div class="panel-body">
          <div class="raw-box">Create a workflow for vendor security review requests.</div>
          <br />
          <div class="kv">${kv("Draft template", "Vendor Security Review")}${kv("Required fields", "vendor, data access, contract value, security contact")}${kv("Risk gates", "Customer data access requires Security review")}${kv("Status", "Draft - admin approval required")}</div>
        </div>
      </section>
    </div>
  `);
}

function templateCard(template) {
  return `<article class="template-card"><div class="row-between"><h3>${template.name}</h3>${tag(template.status, "approved")}</div><p>${template.category} · ${template.handoffTarget}</p><div class="pill-list">${template.riskGates.map((g) => tag(g, "neutral")).join("")}</div></article>`;
}

function handoffRow(run) {
  const item = mutableCases.find((c) => c.id === run.caseId);
  return `<article class="action-row"><div><h3>${run.template}</h3><p>${item?.title} · ${run.provider}</p><small>${run.lastEvent}</small></div>${tag(run.status, run.status)}</article>`;
}

function knowledgePage() {
  return shell(`
    ${pageHeader("Knowledge", "Policy rules that ground risk checks today and become RAG source citations later.")}
    <div class="policy-list">${policies.map((p) => `<article class="policy-row"><div><h3>${p.title}</h3><p><strong>Trigger:</strong> ${p.trigger}</p><p><strong>Requirement:</strong> ${p.requirement}</p></div><div class="tags">${tag(p.usedBy, "neutral")}${tag(`${p.citations} citations`, "approved")}${tag("RAG ready", "pending")}</div></article>`).join("")}</div>
  `);
}

function settingsPage() {
  return shell(`
    ${pageHeader("Settings", "Workspace-level rules, roles, and external handoff configuration placeholders.")}
    <div class="settings-grid">
      <section class="panel"><div class="panel-header"><h2>Workspace</h2></div><div class="panel-body">${kv("Name", "Acme Internal Ops")}${kv("Current view", "Admin / Ops Lead")}${kv("Default model", "OpenAI structured output placeholder")}</div></section>
      <section class="panel"><div class="panel-header"><h2>Roles</h2></div><div class="panel-body">${kv("Operator", "Create and view cases")}${kv("Reviewer", "Approve, reject, request changes")}${kv("Admin", "Manage templates, rules, and handoffs")}${kv("Owner", "Workspace and integration control")}</div></section>
      <section class="panel"><div class="panel-header"><h2>Webhook</h2>${tag("V2/V3", "pending")}</div><div class="panel-body"><input class="input" placeholder="https://n8n.example.com/webhook/flowpilot" /><p class="muted">Approved handoff payloads will be sent to this external workflow endpoint.</p></div></section>
      <section class="panel"><div class="panel-header"><h2>Risk gates</h2></div><div class="panel-body">${kv("High risk", "Always requires review")}${kv("Missing info", "Blocks handoff")}${kv("Approved templates only", "AI cannot execute unknown workflows")}</div></section>
    </div>
  `);
}

function auditPage() {
  return shell(`
    ${pageHeader("Audit logs", "A searchable record of AI decisions, rule matches, review actions, and workflow handoff events.")}
    <section class="panel">
      <div class="table audit-table">
        <div class="table-row table-head"><span>Event</span><span>Actor</span><span>Case</span><span>Type</span><span>Time</span></div>
        ${[
          ["AI structured payroll access request with 88% confidence", "FlowPilot AI", "Payroll admin access request", "AI output", "Today 09:12"],
          ["Rule matched: Payroll admin access requires Security review", "Rule engine", "Payroll admin access request", "Policy gate", "Today 09:12"],
          ["GDPR deletion request blocked because identity verification is missing", "Rule engine", "GDPR deletion request", "Missing info", "Today 10:28"],
          ["Reviewer approved Legal handoff payload", "Legal reviewer", "Enterprise contract liability clause change", "Review", "Yesterday 17:20"],
          ["Legal contract review handoff marked ready for n8n mock target", "System", "Enterprise contract liability clause change", "Handoff", "Yesterday 17:21"],
        ].map(([event, actor, caseName, type, time]) => `
          <button class="table-row">
            <span><strong>${event}</strong><small>${actor}</small></span>
            <span>${actor}</span>
            <span>${caseName}</span>
            <span>${tag(type, "neutral")}</span>
            <span>${time}</span>
          </button>
        `).join("")}
      </div>
    </section>
  `);
}

function loginPage() {
  return `
    <section class="home-page">
      <div class="home-bg"></div>
      <div class="home-overlay"></div>
      <header class="home-nav">
        <div class="brand-row">${logoMark()}<span>FlowPilot AI</span></div>
        <nav><button>Platform</button><button>Workflows</button><button>Security</button><button onclick="navigate('dashboard')">Sign in</button></nav>
      </header>
      <div class="home-content">
        <p class="eyebrow">AI intake, risk control, workflow handoff</p>
        <h1>Turn unclear requests into safe, auditable workflows.</h1>
        <p class="home-sub">FlowPilot AI structures messy employee and operations requests, checks policy rules, detects missing information, and routes approved handoffs to the right workflow template.</p>
        <div class="split-actions"><button class="primary-btn" onclick="navigate('dashboard')">Enter demo workspace</button><button class="glass-btn" onclick="navigate('create')">Watch workflow</button></div>
      </div>
      <div class="hero-flow">
        ${["Raw request", "AI structure", "Review required", "Audit logged"].map((step, index) => `<div class="flow-step"><span>0${index + 1}</span><strong>${step}</strong><small>${["Noisy internal ask", "Fields + risk level", "Human gate if needed", "Trace every decision"][index]}</small></div>`).join("")}
      </div>
    </section>
  `;
}

function eventItem(text) {
  return `<div class="timeline-item"><div class="dot"></div><div><strong>${text}</strong><span>Recorded in workspace audit trail</span></div></div>`;
}

function navigate(view) {
  currentView = view;
  render();
}

function openCase(id) {
  selectedCaseId = id;
  currentView = "case-detail";
  render();
}

function loadExample(id) {
  const item = mutableCases.find((c) => c.id === id);
  draftInput = item.raw;
  draftPreviewId = id;
  render();
}

function analyzeDraft() {
  const input = document.querySelector("#case-input");
  draftInput = input.value;
  const lower = draftInput.toLowerCase();
  if (lower.includes("gdpr") || lower.includes("delete") || lower.includes("personal data")) draftPreviewId = "gdpr-anna";
  else if (lower.includes("liability") || lower.includes("contract") || lower.includes("legal")) draftPreviewId = "legal-liability";
  else draftPreviewId = "access-payroll";
  render();
}

function createMockCase() {
  analyzeDraft();
  auditEvents.unshift("Mock case created from intake and routed through rule validation");
}

function reviewAction(id, status) {
  mutableActions = mutableActions.map((a) => (a.id === id ? { ...a, status } : a));
  auditEvents.unshift(`Reviewer changed ${id} to ${status}`);
  render();
}

function render() {
  const views = {
    login: loginPage,
    dashboard,
    cases: casesPage,
    create: createPage,
    "case-detail": caseDetailPage,
    review: reviewPage,
    workflows: workflowsPage,
    knowledge: knowledgePage,
    audit: auditPage,
    settings: settingsPage,
  };
  app.innerHTML = (views[currentView] || dashboard)();
}

render();
