import { retrievePolicyCitations, type PolicyCitation } from "@/lib/policies";
import type { CaseRecord, CaseStatus, RiskLevel, WorkflowTemplateRecord } from "@/lib/supabase/types";
import { recommendWorkflowTemplate } from "@/lib/workflows";

export interface AgentToolStep {
  tool: "retrieve_policy" | "check_missing_fields" | "recommend_workflow_template" | "draft_handoff_payload";
  status: "completed" | "blocked";
  summary: string;
  output: Record<string, unknown>;
}

const ACCESS_FIELDS = ["employee", "system", "access level", "business reason", "manager approval evidence", "expiration date"];

function missingAccessFields(item: CaseRecord) {
  const text = `${item.title}\n${item.raw_request}`.toLowerCase();

  return ACCESS_FIELDS.filter((field) => {
    if (field === "employee") {
      return !/\b(employee|user|staff|emma|contractor|requester)\b/.test(text);
    }

    if (field === "system") {
      return !/\b(system|payroll|hr|finance|iam|production|jira|slack|service_now)\b/.test(text);
    }

    if (field === "access level") {
      return !/\b(admin|read-only|role|permission|access level|privileged)\b/.test(text);
    }

    if (field === "business reason") {
      return !/\b(reason|because|needed|close|deadline|incident|support)\b/.test(text);
    }

    if (field === "manager approval evidence") {
      return !/\b(manager|approved|approval|owner)\b/.test(text);
    }

    return !/\b(expire|expiration|until|temporary|time-limited|date)\b/.test(text);
  });
}

function draftHandoffPayload(
  item: CaseRecord,
  citations: PolicyCitation[],
  template: WorkflowTemplateRecord | null,
  state?: { riskLevel?: RiskLevel | null; status?: CaseStatus }
) {
  return {
    case_id: item.id,
    title: item.title,
    requester: item.requester,
    department: item.department,
    risk_level: state?.riskLevel ?? item.risk_level,
    status: state?.status ?? item.status,
    workflow_template_id: template?.id ?? null,
    workflow_template_name: template?.name ?? null,
    policy_citation_ids: citations.map((citation) => citation.chunk_id),
    requires_human_approval: true
  };
}

export function createHandoffPayloadStep(input: {
  item: CaseRecord;
  citations: PolicyCitation[];
  missingFields: string[];
  template: WorkflowTemplateRecord | null;
  status: CaseStatus;
  riskLevel: RiskLevel | null;
}) {
  const payload = draftHandoffPayload(input.item, input.citations, input.template, {
    riskLevel: input.riskLevel,
    status: input.status
  });

  return {
    step: {
      tool: "draft_handoff_payload",
      status: input.template && input.missingFields.length === 0 && input.citations.length > 0 ? "completed" : "blocked",
      summary: "Drafted a backend-only handoff payload preview. Execution still requires approval.",
      output: payload
    } satisfies AgentToolStep,
    payload
  };
}

export async function runGovernedAgentTools(item: CaseRecord, templates: WorkflowTemplateRecord[] = []) {
  const steps: AgentToolStep[] = [];
  const citations = await retrievePolicyCitations(item);
  const missingFields = missingAccessFields(item);
  const recommended = recommendWorkflowTemplate(item, templates);

  steps.push({
    tool: "retrieve_policy",
    status: citations.length > 0 ? "completed" : "blocked",
    summary: citations.length > 0 ? `Retrieved ${citations.length} policy citation(s).` : "No matching policy citation found.",
    output: {
      citation_count: citations.length,
      retrieval_modes: Array.from(new Set(citations.map((citation) => citation.retrieval_mode ?? "keyword_dev"))),
      policy_titles: citations.map((citation) => citation.policy_title)
    }
  });

  steps.push({
    tool: "check_missing_fields",
    status: missingFields.length > 0 ? "blocked" : "completed",
    summary: missingFields.length > 0 ? `Missing ${missingFields.length} required field(s).` : "Required access fields are present.",
    output: { missing_fields: missingFields }
  });

  steps.push({
    tool: "recommend_workflow_template",
    status: recommended ? "completed" : "blocked",
    summary: recommended ? `Recommended workflow template: ${recommended.template.name}.` : "No approved workflow template matched.",
    output: {
      workflow_template_id: recommended?.template.id ?? null,
      workflow_template_name: recommended?.template.name ?? null,
      score: recommended?.score ?? 0
    }
  });

  return {
    steps,
    citations,
    missingFields,
    recommendedWorkflow: recommended?.template ?? null,
    handoffPayload: draftHandoffPayload(item, citations, recommended?.template ?? null)
  };
}
