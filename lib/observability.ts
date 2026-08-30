import { cache } from "react";
import { getCurrentUserContext, getVisibleCases, type AuditLogRecord } from "@/lib/cases";
import type { AiTraceRecord, CaseRecord } from "@/lib/supabase/types";

export function getLangfuseConfigStatus() {
  const hasPublicKey = Boolean(process.env.LANGFUSE_PUBLIC_KEY);
  const hasSecretKey = Boolean(process.env.LANGFUSE_SECRET_KEY);
  const host = process.env.LANGFUSE_HOST || "https://cloud.langfuse.com";
  const enabled = hasPublicKey && hasSecretKey;

  return {
    enabled,
    host,
    status: enabled ? "configured" : "not_configured",
    missing: [
      hasPublicKey ? null : "LANGFUSE_PUBLIC_KEY",
      hasSecretKey ? null : "LANGFUSE_SECRET_KEY"
    ].filter(Boolean) as string[]
  };
}

export const getVisibleAiTraces = cache(async (limit = 20) => {
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile || profile.role !== "admin") {
    return [];
  }

  const { data, error } = await supabase
    .from("ai_traces")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AiTraceRecord[]>();

  if (error) {
    console.error("Failed to load AI traces", error);
    return [];
  }

  return data;
});

function citationCount(item: CaseRecord) {
  const citations = item.ai_output?.policy_citations;
  return Array.isArray(citations) ? citations.length : 0;
}

function citationTitles(item: CaseRecord) {
  const citations = item.ai_output?.policy_citations;

  if (!Array.isArray(citations)) {
    return [];
  }

  return citations
    .map((citation) => {
      if (!citation || typeof citation !== "object") {
        return null;
      }

      const data = citation as Record<string, unknown>;
      return typeof data.policy_title === "string" ? data.policy_title : null;
    })
    .filter(Boolean) as string[];
}

export const getRagEvaluationCases = cache(async (limit = 8) => {
  const cases = await getVisibleCases();

  return cases.slice(0, limit).map((item) => {
    const titles = citationTitles(item);

    return {
      id: item.id,
      title: item.title,
      status: item.status,
      policyEvidenceStatus: item.policy_evidence_status,
      citationCount: titles.length,
      citationTitles: titles,
      updatedAt: item.updated_at
    };
  });
});

export async function getObservabilitySummary(auditEvents: AuditLogRecord[]) {
  const cases = await getVisibleCases();
  const totalCases = cases.length;
  const casesWithPolicyEvidence = cases.filter((item) => item.policy_evidence_status === "found").length;
  const casesWithCitations = cases.filter((item) => citationCount(item) > 0).length;
  const failedEvents = auditEvents.filter((event) => event.event_type.includes("FAILED") || event.event_type.includes("INVALID")).length;
  const workflowEvents = auditEvents.filter((event) => event.event_type.startsWith("WORKFLOW_")).length;
  const reviewEvents = auditEvents.filter((event) => ["CASE_APPROVED", "CASE_REJECTED", "CHANGES_REQUESTED"].includes(event.event_type)).length;

  return {
    totalCases,
    casesWithPolicyEvidence,
    casesWithCitations,
    citationCoverage: totalCases > 0 ? Math.round((casesWithCitations / totalCases) * 100) : 0,
    failedEvents,
    workflowEvents,
    reviewEvents
  };
}
