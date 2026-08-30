import { cache } from "react";
import { getCurrentUserContext } from "@/lib/cases";
import type { ConnectorRecord, ExecutionAttemptRecord, WorkflowRunRecord } from "@/lib/supabase/types";

export const getVisibleConnectors = cache(async () => {
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile || profile.role !== "admin") {
    return [];
  }

  const { data, error } = await supabase.from("connectors").select("*").order("updated_at", { ascending: false }).returns<ConnectorRecord[]>();

  if (error) {
    console.error("Failed to load connectors", error);
    return [];
  }

  return data;
});

export async function getWorkflowRunsForCase(caseId: string) {
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile || profile.role === "requester") {
    return [];
  }

  const { data, error } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .returns<WorkflowRunRecord[]>();

  if (error) {
    console.error("Failed to load workflow runs", error);
    return [];
  }

  return data;
}

export async function getExecutionAttemptsForRuns(runIds: string[]) {
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile || profile.role === "requester" || runIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("execution_attempts")
    .select("*")
    .in("workflow_run_id", runIds)
    .order("created_at", { ascending: false })
    .returns<ExecutionAttemptRecord[]>();

  if (error) {
    console.error("Failed to load execution attempts", error);
    return [];
  }

  return data;
}
