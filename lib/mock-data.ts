export type RiskLevel = "Low" | "Medium" | "High";
export type CaseStatus = "In Review" | "Needs Info" | "Ready To Run" | "Completed";

export const workflowTemplates = [
  {
    id: "it-access-review",
    name: "IT Access Review",
    category: "Sensitive access",
    status: "Active",
    reviewer: "Security reviewer",
    handoffTarget: "Mock internal API -> IT service desk",
    version: "v1.3",
    requiredFields: ["employee", "system", "access level", "business reason", "manager approval", "expiration date"],
    riskGates: ["Admin access requires review", "Payroll, finance, and identity systems are sensitive", "Temporary access must include an expiration date"]
  },
  {
    id: "gdpr-deletion-review",
    name: "GDPR Deletion Review",
    category: "Data privacy",
    status: "Active",
    reviewer: "Privacy reviewer",
    handoffTarget: "Custom webhook -> Data operations",
    version: "v1.1",
    requiredFields: ["subject email", "request source", "identity verification", "retention check", "confirmation recipient"],
    riskGates: ["Identity verification is required", "Legal retention must be checked", "Deletion actions must be audited"]
  },
  {
    id: "legal-contract-review",
    name: "Legal Contract Review",
    category: "Legal operations",
    status: "Active",
    reviewer: "Legal reviewer",
    handoffTarget: "Mock internal API -> Legal intake",
    version: "v2.0",
    requiredFields: ["customer name", "contract version", "clause type", "proposed clause", "deadline", "deal value"],
    riskGates: ["Liability, indemnity, DPA, and payment changes require legal review", "Customer-facing commitments require approval"]
  }
];

export const cases = [
  {
    id: "access-payroll",
    title: "Payroll admin access request",
    caseType: "Sensitive access request",
    category: "Security / IAM",
    priority: "High",
    riskLevel: "High" as RiskLevel,
    status: "In Review" as CaseStatus,
    handoffStatus: "Blocked",
    confidence: 0.88,
    createdAt: "Today, 09:12",
    requester: "People Operations",
    department: "HR",
    templateId: "it-access-review",
    raw: "Emma needs temporary admin access to the payroll system before Friday because payroll close is delayed.",
    summary: "A temporary payroll admin access request was submitted with urgency, but it touches a sensitive system and lacks required approval evidence.",
    extractedFields: { Employee: "Emma", System: "Payroll", "Access level": "Admin", Deadline: "Before Friday", Reason: "Payroll close is delayed" },
    missingInfo: ["Manager approval evidence", "Access expiration date"],
    matchedRules: ["Payroll is a sensitive system", "Admin access requires security review", "Temporary access requires an expiration date"],
    recommendation: "Request manager approval, confirm the shortest sufficient access level, add an expiration date, then route to Security review.",
    handoffPayload: { template: "it_access_review", employee: "Emma", system: "Payroll", requested_role: "Admin", risk_level: "High", missing_info: ["manager_approval", "expiration_date"], review_required: true }
  },
  {
    id: "gdpr-anna",
    title: "GDPR deletion request for anna@example.com",
    caseType: "Data deletion request",
    category: "Privacy / Compliance",
    priority: "High",
    riskLevel: "High" as RiskLevel,
    status: "Needs Info" as CaseStatus,
    handoffStatus: "Blocked",
    confidence: 0.91,
    createdAt: "Today, 10:28",
    requester: "Customer Operations",
    department: "Support",
    templateId: "gdpr-deletion-review",
    raw: "A customer asks us to delete all personal data connected to anna@example.com and confirm completion today.",
    summary: "The request appears to be a GDPR right-to-erasure case requiring identity verification, retention review, and auditable handling.",
    extractedFields: { "Subject email": "anna@example.com", Request: "Delete all personal data", Deadline: "Today", Confirmation: "Required", "Compliance area": "GDPR / Right to erasure" },
    missingInfo: ["Identity verification", "Request source", "Legal retention check"],
    matchedRules: ["Identity verification is required before deletion", "Deletion must be audited", "Retention obligations must be checked"],
    recommendation: "Verify the requester identity, check retention obligations, identify affected systems, then route to Privacy review.",
    handoffPayload: { template: "gdpr_deletion_review", subject_email: "anna@example.com", systems_to_check: ["CRM", "Support", "Billing", "Analytics"], verification_required: true, audit_required: true }
  },
  {
    id: "legal-liability",
    title: "Enterprise contract liability clause change",
    caseType: "Legal contract review",
    category: "Legal / Sales",
    priority: "High",
    riskLevel: "High" as RiskLevel,
    status: "Ready To Run" as CaseStatus,
    handoffStatus: "Ready",
    confidence: 0.84,
    createdAt: "Yesterday, 16:44",
    requester: "Sales",
    department: "Revenue",
    templateId: "legal-contract-review",
    raw: "Sales wants to change the liability clause in an enterprise customer contract before the deal closes tomorrow.",
    summary: "A revenue team is requesting a liability clause change under time pressure, which requires legal review before any customer commitment.",
    extractedFields: { Department: "Sales", "Contract type": "Enterprise customer contract", Clause: "Liability", Deadline: "Tomorrow", Impact: "Deal close depends on review" },
    missingInfo: ["Customer name", "Contract version", "Proposed clause text", "Deal value"],
    matchedRules: ["Liability clause changes require Legal review", "Customer-facing commitments require approval"],
    recommendation: "Ask Sales for the contract version and proposed clause text, then route the request to Legal with deal context and deadline.",
    handoffPayload: { template: "legal_contract_review", department: "Sales", clause_type: "Liability", deadline: "Tomorrow", risk_level: "High", missing_info: ["customer_name", "contract_version", "proposed_clause", "deal_value"] }
  }
];

export const actions = [
  { id: "act-1", caseId: "access-payroll", title: "Request manager approval evidence", status: "Needs Changes", risk: "High", owner: "Security reviewer" },
  { id: "act-2", caseId: "access-payroll", title: "Prepare IT access review handoff", status: "In Review", risk: "High", owner: "Security reviewer" },
  { id: "act-3", caseId: "gdpr-anna", title: "Verify requester identity", status: "Needs Changes", risk: "High", owner: "Privacy reviewer" },
  { id: "act-4", caseId: "gdpr-anna", title: "Check legal retention policy", status: "In Review", risk: "High", owner: "Privacy reviewer" },
  { id: "act-5", caseId: "legal-liability", title: "Route liability clause request to Legal", status: "Approved", risk: "High", owner: "Legal reviewer" }
];

export const policies = [
  { title: "Privileged Access Policy", trigger: "Admin access to payroll, finance, or identity systems", requirement: "Security review and expiration date required", usedBy: "IT Access Review", citations: 6 },
  { title: "GDPR Deletion Policy", trigger: "Personal data deletion or right-to-erasure request", requirement: "Identity verification, retention check, and audit log required", usedBy: "GDPR Deletion Review", citations: 4 },
  { title: "Contract Risk Policy", trigger: "Liability, indemnity, DPA, or payment term changes", requirement: "Legal review required before customer commitment", usedBy: "Legal Contract Review", citations: 5 }
];

export const auditEvents = [
  { type: "AI_OUTPUT_CREATED", time: "Today 09:12", actor: "FlowPilot AI", summary: "Structured payroll access request with 88% confidence" },
  { type: "POLICY_MATCHED", time: "Today 09:12", actor: "Risk engine", summary: "Matched rule: Payroll admin access requires Security review" },
  { type: "MISSING_INFO_DETECTED", time: "Today 10:28", actor: "Risk engine", summary: "GDPR deletion request blocked because identity verification is missing" },
  { type: "WORKFLOW_READY", time: "Yesterday 17:21", actor: "System", summary: "Legal contract review handoff marked ready for mock internal API target" },
  { type: "REVIEW_APPROVED", time: "Yesterday 17:20", actor: "Legal reviewer", summary: "Reviewer approved Legal handoff payload" }
];

export const failureStates = [
  { name: "Invalid AI output", handling: "Mark ai_output_invalid, block execution, log validation failure, allow retry." },
  { name: "Needs more information", handling: "Set needs_info, ask requester for missing fields, block handoff." },
  { name: "Policy evidence missing", handling: "Route to review, show uncertainty, prevent automatic workflow run." },
  { name: "No template match", handling: "Allow AI proposal draft, require admin approval before execution." },
  { name: "Connector failed", handling: "Store failed attempt, show failure reason, expose retry after approval remains valid." }
];

export function getTemplate(id: string) {
  return workflowTemplates.find((template) => template.id === id) ?? workflowTemplates[0];
}

export function getCase(id: string) {
  return cases.find((item) => item.id === id) ?? cases[0];
}
