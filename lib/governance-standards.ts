export interface GovernanceStandard {
  title: string;
  description: string;
  sourceUrl: string;
  content: string;
}

export const governanceStandards: GovernanceStandard[] = [
  {
    title: "EU AI Act Compliance Policy",
    description: "Internal operating policy based on EU AI Act risk management, transparency, human oversight, and logging themes.",
    sourceUrl: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
    content: `Purpose
This policy defines how FlowPilot AI uses AI-assisted analysis under EU AI Act-aligned governance principles.

Scope
This applies to AI-assisted intake, risk classification, missing information detection, policy citation, workflow template proposal, and review routing.

Policy Rules
AI may structure requests, classify risk, detect missing information, draft recommendations, and cite policy evidence. AI must not approve high-risk actions, grant access, execute connector calls, or bypass required human review. Users and reviewers must be able to see that AI was used in the analysis.

Approval Requirements
Requests affecting employment, access rights, payroll systems, sensitive data, regulated decisions, or production workflows require reviewer or admin approval before execution.

Automation Rules
AI output must be validated against a structured schema before it is saved or used. Invalid or incomplete AI output must move the case to ai_output_invalid or human review.

Risk Conditions
High-risk indicators include privileged access, employee impact, sensitive personal data, automated workflow execution, production system change, lack of policy evidence, or missing approval evidence.

Required Audit Logs
The system must record AI model, prompt version, output validation status, reviewer decision, status transition, and policy citations used.

Example Cases
Payroll admin access, HR data export, employee disciplinary workflow, connector execution approval, and AI-generated workflow proposal.`
  },
  {
    title: "GDPR Data Protection Policy",
    description: "Internal data protection policy for personal data, sensitive data, lawful purpose, minimization, and auditability.",
    sourceUrl: "https://commission.europa.eu/law/law-topic/data-protection/data-protection-eu_en",
    content: `Purpose
This policy governs personal data handling in employee and operations requests.

Scope
This applies to requests involving employee records, payroll data, customer data, personal identifiers, data deletion, data export, data correction, and privacy-related workflow handoffs.

Policy Rules
Personal data must be processed for a specific business purpose. Requests must use the minimum data required. Sensitive or confidential data must not be exposed in unnecessary workflow payloads, logs, or AI prompts.

Approval Requirements
Requests involving personal data export, deletion, cross-border transfer, payroll data, HR records, or sensitive categories require human review and appropriate approval evidence.

Automation Rules
AI may detect personal data risk and recommend controls. AI must not decide privacy rights outcomes, delete records, or transfer personal data without approved workflow handoff.

Risk Conditions
High-risk indicators include payroll information, employee records, government identifiers, health information, legal disputes, large exports, unclear purpose, or missing requester authority.

Required Audit Logs
Record requester, purpose, data category, policy citation, reviewer decision, workflow payload preview, and final handoff status.

Example Cases
Employee data export, payroll correction, HR file access, account deletion, vendor access to personal data.`
  },
  {
    title: "Corporate Information Security Policy",
    description: "Internal security policy for system protection, secrets handling, connectors, audit logging, and incident escalation.",
    sourceUrl: "https://www.iso.org/standard/27001",
    content: `Purpose
This policy establishes baseline information security controls for FlowPilot AI operations.

Scope
This applies to internal systems, security events, connectors, webhook configuration, credentials, privileged actions, audit logs, and production workflow handoffs.

Policy Rules
Secrets, API keys, tokens, and connector credentials must never be exposed in browser code, case comments, AI prompts, or audit summaries. Security-relevant actions require traceable approval and audit logging.

Approval Requirements
New connectors, webhook destinations, production access, security exception requests, and changes involving sensitive systems require admin review.

Automation Rules
Backend services must perform connector calls. The browser must not hold privileged secrets. AI may prepare payloads and recommend controls but cannot execute unapproved actions.

Risk Conditions
High-risk indicators include external webhook URLs, credential rotation, disabled MFA, security exception, production system access, incident response, or missing audit trail.

Required Audit Logs
Record actor, case, connector reference, approval decision, payload preview hash, status transition, retry attempt, and failure reason.

Example Cases
Create a webhook connector, rotate API token, approve emergency access, investigate suspicious login, request production database access.`
  },
  {
    title: "Identity and Access Management Policy",
    description: "Internal IAM policy for least privilege, privileged access, temporary access, approvals, and access review.",
    sourceUrl: "https://pages.nist.gov/800-63-4/",
    content: `Purpose
This policy governs identity, authentication, authorization, and access provisioning.

Scope
This applies to access requests for payroll, HR, finance, production, customer data, admin consoles, workflow tools, and internal APIs.

Policy Rules
Access must follow least privilege. Privileged access must be time-limited, justified by business need, and approved by an authorized manager or system owner.

Approval Requirements
Admin access requires manager approval and reviewer or admin validation. Temporary access must include target system, role, reason, start date, expiration date, and rollback plan.

Automation Rules
AI may classify access risk and prepare an access request payload. AI must not grant access, change roles, disable MFA, or approve its own recommendation.

Risk Conditions
High-risk indicators include admin role, payroll or HR system, production system, broad access scope, missing expiration, missing manager approval, or emergency access.

Required Audit Logs
Record requested role, target system, approval evidence, reviewer decision, expiration date, status transition, and workflow handoff result.

Example Cases
Temporary payroll admin access, finance system role change, production read-only access, emergency identity unlock, contractor access request.`
  },
  {
    title: "HR and Payroll Data Protection Policy",
    description: "Internal policy for employee records, payroll system access, compensation data, and HR approval evidence.",
    sourceUrl: "internal://flowpilot/policies/hr-payroll-data-protection",
    content: `Purpose
This policy protects employee records, compensation data, payroll operations, and HR system access.

Scope
This applies to payroll admin access, salary data, benefits records, employee files, HRIS exports, payroll correction workflows, and HR-related connector handoffs.

Policy Rules
Payroll and HR data are confidential. Access must be limited to authorized HR, payroll, finance, or approved support personnel with a documented business need.

Approval Requirements
Payroll admin access requires HR or payroll owner approval, manager approval, least-privilege role, expiration date for temporary access, and audit logging.

Automation Rules
AI may identify payroll or HR sensitivity, ask for missing evidence, and recommend human review. AI must not grant payroll access or modify employee compensation records directly.

Risk Conditions
High-risk indicators include payroll admin access, compensation changes, employee record export, missing approver, urgent access before payroll close, broad employee data scope, or unclear requester authority.

Required Audit Logs
Record requester, department, target payroll or HR system, approval evidence, access duration, reviewer decision, and handoff status.

Example Cases
Temporary payroll admin access before payroll close, HR data export, salary correction request, benefits administrator access, employee record review.`
  },
  {
    title: "Governed Workflow Handoff Policy",
    description: "FlowPilot safety policy for approved workflow execution, connector calls, idempotency, retries, and failure tracking.",
    sourceUrl: "internal://flowpilot/policies/governed-workflow-handoff",
    content: `Purpose
This policy defines how FlowPilot AI moves from analysis to controlled workflow handoff.

Scope
This applies to workflow templates, AI-generated proposals, connector payloads, approvals, workflow runs, execution attempts, retries, and audit logs.

Policy Rules
AI may recommend or draft a workflow handoff. Only approved workflow templates may execute. Connector calls must run through backend services after reviewer or admin approval.

Approval Requirements
High-risk cases, missing information, missing policy evidence, new workflow proposals, and connector changes require human review before execution.

Automation Rules
Every workflow run must include an idempotency key, payload preview, status tracking, retry limit, failure reason, and audit trail.

Risk Conditions
High-risk indicators include new connector, external webhook, production action, payroll or HR system, missing template match, unvalidated AI output, or missing approval.

Required Audit Logs
Record template match, payload preview metadata, approver, approved_at, workflow_run status, execution_attempt status, retry count, and failure reason.

Example Cases
Provision access, send approved webhook, create Jira ticket, notify Slack channel, trigger HR workflow, retry failed connector call.`
  },
  {
    title: "Vendor Onboarding and Third-Party Risk Policy",
    description: "Internal policy for vendor intake, third-party access, data sharing, security review, and contract status.",
    sourceUrl: "internal://flowpilot/policies/vendor-third-party-risk",
    content: `Purpose
This policy governs vendor onboarding and third-party risk checks.

Scope
This applies to new vendors, contractor access, data sharing, software procurement, external integrations, webhook destinations, and third-party system access.

Policy Rules
Vendors must have a documented business owner, contract status, data access description, security review status, and approved onboarding path before production access.

Approval Requirements
Vendors accessing confidential data, employee data, customer data, production systems, or internal APIs require security and business owner approval.

Automation Rules
AI may summarize vendor risk, identify missing onboarding evidence, and recommend review routing. AI must not approve a vendor or activate a connector directly.

Risk Conditions
High-risk indicators include personal data access, production integration, missing DPA, missing security review, external webhook, unclear business owner, or urgent onboarding.

Required Audit Logs
Record vendor name, business owner, data categories, security review result, contract status, reviewer decision, and workflow handoff status.

Example Cases
New SaaS vendor onboarding, contractor system access, vendor webhook integration, third-party payroll service access, procurement risk review.`
  },
  {
    title: "Contract Review and Legal Approval Policy",
    description: "Internal policy for contract changes, legal approval, liability terms, renewal requests, and signature routing.",
    sourceUrl: "internal://flowpilot/policies/contract-legal-approval",
    content: `Purpose
This policy governs legal review and approval for contract-related requests.

Scope
This applies to new contracts, contract amendments, renewals, liability terms, data processing terms, vendor terms, and signature workflow handoffs.

Policy Rules
Contracts must have a business owner, counterparty, contract value, risk summary, legal review status, and approval evidence before signature or execution workflow handoff.

Approval Requirements
Legal approval is required for non-standard terms, data processing agreements, liability changes, auto-renewals, high-value contracts, or unclear authority to sign.

Automation Rules
AI may extract contract metadata, flag missing legal evidence, and route the case to review. AI must not approve legal terms, sign contracts, or execute signature workflows without approval.

Risk Conditions
High-risk indicators include uncapped liability, personal data processing, missing legal review, urgent signature request, non-standard clause, high contract value, or vendor security dependency.

Required Audit Logs
Record business owner, counterparty, contract type, approval evidence, legal review status, reviewer decision, and final workflow handoff.

Example Cases
Vendor contract renewal, DPA review, liability clause change, urgent signature routing, procurement legal approval.`
  }
];
