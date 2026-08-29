import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CaseRecord, Profile } from "@/lib/supabase/types";

export interface AuditLogRecord {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  actor_type: "user" | "ai" | "system" | "connector";
  case_id: string | null;
  workflow_run_id: string | null;
  event_type: string;
  event_summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CurrentProfile extends Profile {
  workspaces?: { name: string } | Array<{ name: string }> | null;
}

export const getCurrentUserContext = cache(async () => {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return { supabase, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_id, workspace_id, full_name, role, created_at, workspaces(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle<CurrentProfile>();

  return { supabase, user, profile };
});

export async function getVisibleCases() {
  const { supabase, user } = await getCurrentUserContext();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<CaseRecord[]>();

  if (error) {
    console.error("Failed to load cases", error);
    return [];
  }

  return data;
}

export async function getVisibleCase(id: string) {
  const { supabase, user } = await getCurrentUserContext();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .maybeSingle<CaseRecord>();

  if (error) {
    console.error("Failed to load case", error);
    return null;
  }

  return data;
}

export async function getVisibleAuditLogs(limit = 8) {
  const { supabase, user } = await getCurrentUserContext();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AuditLogRecord[]>();

  if (error) {
    console.error("Failed to load audit logs", error);
    return [];
  }

  return data;
}

export async function getAuditLogsForCase(caseId: string) {
  const { supabase, user } = await getCurrentUserContext();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .returns<AuditLogRecord[]>();

  if (error) {
    console.error("Failed to load case audit logs", error);
    return [];
  }

  return data;
}

export function needsReview(item: CaseRecord) {
  return (
    item.human_review_required ||
    item.risk_level === "high" ||
    item.status === "needs_info" ||
    item.status === "in_review" ||
    item.status === "policy_evidence_missing"
  );
}

export function getReviewCases(items: CaseRecord[]) {
  return items.filter(needsReview);
}

export function formatCaseStatus(status: CaseRecord["status"]) {
  return status
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatRisk(risk: CaseRecord["risk_level"]) {
  if (!risk) {
    return "Medium";
  }

  return risk[0].toUpperCase() + risk.slice(1);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
