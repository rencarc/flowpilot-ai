import type { CaseRecord } from "@/lib/supabase/types";

function langfuseConfig() {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const host = process.env.LANGFUSE_HOST || "https://cloud.langfuse.com";

  if (!publicKey || !secretKey) {
    return null;
  }

  return {
    publicKey,
    secretKey,
    host: host.replace(/\/$/, "")
  };
}

function authHeader(publicKey: string, secretKey: string) {
  return `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;
}

function compactOutput(value: Record<string, unknown> | null) {
  if (!value) {
    return null;
  }

  return {
    status: value.status,
    case_type: value.case_type,
    risk_level: value.risk_level,
    confidence_score: value.confidence_score,
    missing_information: value.missing_information,
    matched_rules: value.matched_rules,
    policy_citation_count: Array.isArray(value.policy_citations) ? value.policy_citations.length : 0,
    agent_steps: value.agent_steps
  };
}

export async function exportAiAnalysisTraceToLangfuse(input: {
  traceId: string;
  caseRecord: CaseRecord;
  model: string;
  promptVersion: string;
  latencyMs: number;
  outputValid: boolean;
  aiOutput: Record<string, unknown> | null;
  errorMessage?: string | null;
}) {
  const config = langfuseConfig();

  if (!config) {
    return;
  }

  const timestamp = new Date().toISOString();
  const generationId = `${input.traceId}-generation`;
  const body = {
    batch: [
      {
        id: `${input.traceId}-trace`,
        type: "trace-create",
        timestamp,
        body: {
          id: input.traceId,
          name: "case-ai-analysis",
          sessionId: input.caseRecord.id,
          userId: input.caseRecord.created_by,
          input: {
            title: input.caseRecord.title,
            raw_request: input.caseRecord.raw_request,
            department: input.caseRecord.department,
            priority: input.caseRecord.priority
          },
          output: compactOutput(input.aiOutput),
          metadata: {
            workspace_id: input.caseRecord.workspace_id,
            case_id: input.caseRecord.id,
            prompt_version: input.promptVersion,
            output_valid: input.outputValid,
            latency_ms: input.latencyMs,
            error_message: input.errorMessage ?? null
          },
          tags: ["flowpilot-ai", "case-analysis", input.outputValid ? "valid" : "invalid"]
        }
      },
      {
        id: `${input.traceId}-generation-event`,
        type: "generation-create",
        timestamp,
        body: {
          id: generationId,
          traceId: input.traceId,
          name: "openai-structured-case-analysis",
          model: input.model,
          startTime: new Date(Date.now() - input.latencyMs).toISOString(),
          endTime: timestamp,
          input: {
            case_id: input.caseRecord.id,
            title: input.caseRecord.title,
            raw_request: input.caseRecord.raw_request
          },
          output: compactOutput(input.aiOutput),
          metadata: {
            prompt_version: input.promptVersion,
            output_valid: input.outputValid,
            error_message: input.errorMessage ?? null
          }
        }
      }
    ]
  };

  try {
    const response = await fetch(`${config.host}/api/public/ingestion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(config.publicKey, config.secretKey)
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Langfuse trace export failed", response.status, errorText.slice(0, 240));
    }
  } catch (error) {
    console.error("Langfuse trace export failed", error);
  }
}
