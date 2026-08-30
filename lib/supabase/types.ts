export type UserRole = "requester" | "reviewer" | "admin";
export type CaseStatus =
  | "new"
  | "analyzing"
  | "needs_info"
  | "policy_evidence_missing"
  | "in_review"
  | "approved"
  | "rejected"
  | "ready_to_run"
  | "running"
  | "failed"
  | "completed"
  | "closed"
  | "ai_output_invalid"
  | "no_template_match";

export type RiskLevel = "low" | "medium" | "high";
export type WorkflowLifecycleStatus = "approved" | "active" | "deprecated" | "disabled";
export type ProposalStatus = "draft" | "under_review" | "approved" | "rejected" | "converted";
export type ConnectorType =
  | "mock_internal_api"
  | "custom_webhook"
  | "internal_api"
  | "n8n"
  | "make"
  | "pipedream"
  | "slack"
  | "email"
  | "jira"
  | "service_now"
  | "power_automate";

export interface Profile {
  id: string;
  user_id: string;
  workspace_id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface CaseRecord {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  raw_request: string;
  summary: string | null;
  requester: string | null;
  department: string | null;
  category: string | null;
  priority: string | null;
  risk_level: RiskLevel | null;
  status: CaseStatus;
  confidence_score: number | null;
  missing_information: string[];
  ai_output: Record<string, unknown> | null;
  human_review_required: boolean;
  policy_evidence_status: "found" | "missing" | "not_checked";
  matched_workflow_template_id: string | null;
  workflow_template_proposal_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateRecord {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  category: string;
  trigger_condition: string;
  required_fields: string[];
  risk_level: RiskLevel;
  requires_review: boolean;
  payload_schema: Record<string, unknown>;
  connector_id: string | null;
  active: boolean;
  version: number;
  lifecycle_status: WorkflowLifecycleStatus;
  created_from_proposal_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateProposalRecord {
  id: string;
  workspace_id: string;
  source_case_id: string | null;
  proposed_by_ai_trace_id: string | null;
  name: string;
  description: string | null;
  category: string;
  trigger_condition: string;
  required_fields: string[];
  risk_level: RiskLevel;
  requires_review: boolean;
  suggested_steps: string[];
  payload_schema: Record<string, unknown>;
  connector_type_suggestion: ConnectorType | null;
  policy_evidence: Record<string, unknown>[];
  limitations: string[];
  status: ProposalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}
