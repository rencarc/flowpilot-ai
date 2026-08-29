import type { CaseStatus, RiskLevel } from "@/lib/supabase/types";

export interface CaseAnalysis {
  case_type: string;
  summary: string;
  risk_level: RiskLevel;
  status: CaseStatus;
  human_review_required: boolean;
  missing_information: string[];
  matched_rules: string[];
  recommendation: string;
  confidence_score: number;
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "case_type",
    "summary",
    "risk_level",
    "status",
    "human_review_required",
    "missing_information",
    "matched_rules",
    "recommendation",
    "confidence_score"
  ],
  properties: {
    case_type: { type: "string" },
    summary: { type: "string" },
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    status: { type: "string", enum: ["new", "needs_info", "in_review", "ready_to_run", "policy_evidence_missing", "ai_output_invalid"] },
    human_review_required: { type: "boolean" },
    missing_information: { type: "array", items: { type: "string" } },
    matched_rules: { type: "array", items: { type: "string" } },
    recommendation: { type: "string" },
    confidence_score: { type: "number", minimum: 0, maximum: 1 }
  }
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function validateCaseAnalysis(value: unknown): CaseAnalysis | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;
  const riskLevels = new Set(["low", "medium", "high"]);
  const statuses = new Set(["new", "needs_info", "in_review", "ready_to_run", "policy_evidence_missing", "ai_output_invalid"]);

  if (
    typeof data.case_type !== "string" ||
    typeof data.summary !== "string" ||
    typeof data.risk_level !== "string" ||
    !riskLevels.has(data.risk_level) ||
    typeof data.status !== "string" ||
    !statuses.has(data.status) ||
    typeof data.human_review_required !== "boolean" ||
    !isStringArray(data.missing_information) ||
    !isStringArray(data.matched_rules) ||
    typeof data.recommendation !== "string" ||
    typeof data.confidence_score !== "number" ||
    data.confidence_score < 0 ||
    data.confidence_score > 1
  ) {
    return null;
  }

  return data as unknown as CaseAnalysis;
}

function extractOutputText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const output = response.output;
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") {
        return text;
      }
    }
  }

  return null;
}

export async function analyzeCaseWithOpenAI(input: { title: string; rawRequest: string; department: string | null; priority: string | null }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You classify internal operations requests for FlowPilot AI. Follow explicit governance rules. AI may structure, classify, and recommend, but must not approve or execute production workflows."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Classify this request into structured governance fields.",
            risk_rules: {
              high: ["admin access", "payroll, finance, identity, or production systems", "personal data deletion", "legal or contract commitments", "payments or vendor changes"],
              medium: ["cross-team operational change", "non-sensitive workflow handoff", "business process impact"],
              low: ["informational request", "no sensitive data", "no permission, legal, financial, or production action"]
            },
            required_access_fields: ["employee", "system", "access level", "business reason", "manager approval evidence", "expiration date"],
            case: input
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "flowpilot_case_analysis",
          strict: true,
          schema
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText.slice(0, 240)}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  const outputText = extractOutputText(json);

  if (!outputText) {
    throw new Error("OpenAI response did not include output text.");
  }

  const parsed = JSON.parse(outputText) as unknown;
  const validated = validateCaseAnalysis(parsed);

  if (!validated) {
    throw new Error("OpenAI output failed application validation.");
  }

  if (validated.risk_level === "high") {
    validated.human_review_required = true;
  }

  if (validated.missing_information.length > 0) {
    validated.status = "needs_info";
  } else if (validated.human_review_required) {
    validated.status = "in_review";
  }

  return validated;
}
