import type { RiskLevel } from "@/lib/supabase/types";

export type StandardWorkflowTemplate = {
  name: string;
  description: string;
  category: string;
  trigger_condition: string;
  required_fields: string[];
  risk_level: RiskLevel;
  requires_review: boolean;
  payload_schema: Record<string, string>;
};

export const standardWorkflowTemplates: StandardWorkflowTemplate[] = [
  {
    name: "Payroll access review",
    description: "Routes temporary payroll access requests through policy evidence, manager approval, and controlled handoff.",
    category: "Access management",
    trigger_condition: "Payroll or HR system access request with admin, elevated, or temporary permissions",
    required_fields: ["requester", "manager approval", "target system", "requested role", "access duration", "business justification"],
    risk_level: "high",
    requires_review: true,
    payload_schema: { requester: "string", target_system: "string", requested_role: "string", access_duration: "string", approval_evidence: "string" }
  },
  {
    name: "Vendor bank change verification",
    description: "Handles supplier bank detail changes with independent verification before payment or master data update.",
    category: "Vendor risk",
    trigger_condition: "Vendor bank account, IBAN, payment detail, supplier master data, or invoice payment change request",
    required_fields: ["requester", "vendor name", "old bank details", "new bank details", "independent verification evidence", "finance approver", "payment deadline"],
    risk_level: "high",
    requires_review: true,
    payload_schema: { requester: "string", vendor_name: "string", new_bank_details: "string", verification_evidence: "string", finance_approver: "string" }
  },
  {
    name: "Purchase approval routing",
    description: "Routes purchase and procurement requests through budget, vendor, and approval checks.",
    category: "Procurement",
    trigger_condition: "Purchase request, procurement approval, software purchase, vendor order, equipment request, or budget approval",
    required_fields: ["requester", "supplier", "estimated cost", "cost center", "business justification", "manager approval"],
    risk_level: "medium",
    requires_review: true,
    payload_schema: { requester: "string", supplier: "string", estimated_cost: "string", cost_center: "string", approval_evidence: "string" }
  },
  {
    name: "Contract review and legal approval",
    description: "Routes contract changes, renewals, liability terms, and signature requests to legal review.",
    category: "Legal",
    trigger_condition: "Contract renewal, legal review, data processing addendum, liability clause, signature request, or terms change",
    required_fields: ["requester", "counterparty", "contract type", "commercial owner", "legal issue", "deadline"],
    risk_level: "medium",
    requires_review: true,
    payload_schema: { requester: "string", counterparty: "string", contract_type: "string", legal_issue: "string", deadline: "string" }
  },
  {
    name: "Employee data export review",
    description: "Controls HR, payroll, and employee data exports with privacy and approval checks.",
    category: "Data privacy",
    trigger_condition: "Employee data export, payroll report, HR data sharing, personnel file, or GDPR-sensitive employee information",
    required_fields: ["requester", "data subjects", "data fields", "purpose", "recipient", "retention period", "privacy approval"],
    risk_level: "high",
    requires_review: true,
    payload_schema: { requester: "string", data_subjects: "string", data_fields: "string", purpose: "string", recipient: "string", privacy_approval: "string" }
  },
  {
    name: "Employee onboarding task",
    description: "Creates controlled onboarding tasks for accounts, equipment, and workspace setup.",
    category: "HR operations",
    trigger_condition: "New employee onboarding, account setup, laptop request, system access setup, or first-day preparation",
    required_fields: ["employee name", "start date", "department", "manager", "role", "required systems", "equipment needs"],
    risk_level: "medium",
    requires_review: true,
    payload_schema: { employee_name: "string", start_date: "string", department: "string", manager: "string", required_systems: "string" }
  },
  {
    name: "Production change approval",
    description: "Routes production system changes through risk review, rollback planning, and authorized approval.",
    category: "IT change management",
    trigger_condition: "Production deployment, configuration change, database change, system update, emergency fix, or rollback request",
    required_fields: ["requester", "system", "change summary", "risk assessment", "rollback plan", "approver", "deployment window"],
    risk_level: "high",
    requires_review: true,
    payload_schema: { requester: "string", system: "string", change_summary: "string", risk_assessment: "string", rollback_plan: "string", deployment_window: "string" }
  },
  {
    name: "Customer data access request",
    description: "Controls internal access to customer records, exports, and support investigation data.",
    category: "Customer data",
    trigger_condition: "Customer record access, support investigation, customer data export, account lookup, or production customer data request",
    required_fields: ["requester", "customer account", "data requested", "business reason", "access duration", "approver"],
    risk_level: "high",
    requires_review: true,
    payload_schema: { requester: "string", customer_account: "string", data_requested: "string", business_reason: "string", access_duration: "string" }
  },
  {
    name: "Security exception review",
    description: "Routes policy exceptions, temporary bypasses, and security control deviations for approval.",
    category: "Security governance",
    trigger_condition: "Security exception, policy bypass, MFA exception, firewall exception, blocked access override, or temporary control deviation",
    required_fields: ["requester", "exception type", "affected system", "risk reason", "compensating control", "expiration date", "security approver"],
    risk_level: "high",
    requires_review: true,
    payload_schema: { requester: "string", exception_type: "string", affected_system: "string", compensating_control: "string", expiration_date: "string" }
  },
  {
    name: "Finance exception approval",
    description: "Routes urgent payment, invoice, refund, and finance exceptions through approval and audit capture.",
    category: "Finance operations",
    trigger_condition: "Urgent payment, invoice exception, refund approval, payment hold release, budget exception, or manual finance adjustment",
    required_fields: ["requester", "amount", "vendor or customer", "reason", "approver", "deadline", "supporting evidence"],
    risk_level: "high",
    requires_review: true,
    payload_schema: { requester: "string", amount: "string", party: "string", reason: "string", approver: "string", deadline: "string" }
  }
];
