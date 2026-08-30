import { cache } from "react";
import { getCurrentUserContext, getVisibleCases, type AuditLogRecord } from "@/lib/cases";
import type { AiTraceRecord, CaseRecord } from "@/lib/supabase/types";

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
