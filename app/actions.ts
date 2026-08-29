"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { analyzeCaseWithOpenAI } from "@/lib/ai-analysis";
import { getCurrentUserContext } from "@/lib/cases";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CaseRecord } from "@/lib/supabase/types";

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createCaseAction(formData: FormData) {
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  const rawRequest = requiredString(formData, "raw_request");
  const title = requiredString(formData, "title") || rawRequest.slice(0, 80);
  const department = requiredString(formData, "department");
  const priority = requiredString(formData, "priority") || "Medium";

  if (!rawRequest) {
    redirect("/new-request?error=missing_request");
  }

  const summary = `Initial persisted intake from ${department || "unknown department"}. AI analysis is pending Step 5.`;
  const { data: createdCase, error: caseError } = await supabase
    .from("cases")
    .insert({
      workspace_id: profile.workspace_id,
      created_by: user.id,
      title,
      raw_request: rawRequest,
      summary,
      requester: profile.full_name ?? user.email,
      department: department || null,
      category: "General intake",
      priority,
      risk_level: "medium",
      status: "new",
      confidence_score: null,
      missing_information: [],
      human_review_required: true,
      policy_evidence_status: "not_checked"
    })
    .select("id")
    .single<{ id: string }>();

  if (caseError || !createdCase) {
    console.error("Failed to create case", caseError);
    redirect("/new-request?error=create_failed");
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "user",
    case_id: createdCase.id,
    event_type: "CASE_CREATED",
    event_summary: "Requester created a persisted intake case.",
    metadata: {
      source: "new-request",
      status: "new",
      ai_analysis: "pending"
    }
  });

  if (auditError) {
    console.error("Failed to create audit log", auditError);
  }

  revalidatePath("/dashboard");
  revalidatePath("/cases");
  revalidatePath("/audit");
  redirect(`/cases/${createdCase.id}`);
}

export async function analyzeCaseAction(formData: FormData) {
  const caseId = requiredString(formData, "case_id");
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!["reviewer", "admin"].includes(profile.role)) {
    redirect(`/cases/${caseId}?error=analysis_forbidden`);
  }

  const { data: visibleCase, error: readError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle<CaseRecord>();

  if (readError || !visibleCase) {
    console.error("Unauthorized or missing case for AI analysis", readError);
    redirect("/cases?error=case_not_visible");
  }

  const startedAt = Date.now();
  const admin = createAdminClient();

  try {
    const analysis = await analyzeCaseWithOpenAI({
      title: visibleCase.title,
      rawRequest: visibleCase.raw_request,
      department: visibleCase.department,
      priority: visibleCase.priority
    });

    const latencyMs = Date.now() - startedAt;
    const { error: updateError } = await admin
      .from("cases")
      .update({
        summary: analysis.summary,
        category: analysis.case_type,
        risk_level: analysis.risk_level,
        status: analysis.status,
        confidence_score: analysis.confidence_score,
        missing_information: analysis.missing_information,
        ai_output: analysis,
        human_review_required: analysis.human_review_required,
        policy_evidence_status: analysis.matched_rules.length > 0 ? "found" : "missing"
      })
      .eq("id", visibleCase.id)
      .eq("workspace_id", profile.workspace_id);

    if (updateError) {
      throw updateError;
    }

    await admin.from("audit_logs").insert({
      workspace_id: profile.workspace_id,
      actor_id: user.id,
      actor_type: "ai",
      case_id: visibleCase.id,
      event_type: "AI_OUTPUT_CREATED",
      event_summary: `AI classified case as ${analysis.risk_level} risk with status ${analysis.status}.`,
      metadata: {
        model: "gpt-4.1-mini",
        latency_ms: latencyMs,
        confidence_score: analysis.confidence_score,
        matched_rules: analysis.matched_rules
      }
    });

    await admin.from("ai_traces").insert({
      workspace_id: profile.workspace_id,
      case_id: visibleCase.id,
      prompt_version: "step_5_case_analysis_v1",
      model: "gpt-4.1-mini",
      input_hash: visibleCase.id,
      output_valid: true,
      latency_ms: latencyMs
    });
  } catch (error) {
    console.error("AI analysis failed", error);
    await admin.from("cases").update({ status: "ai_output_invalid" }).eq("id", visibleCase.id).eq("workspace_id", profile.workspace_id);
    await admin.from("audit_logs").insert({
      workspace_id: profile.workspace_id,
      actor_id: user.id,
      actor_type: "system",
      case_id: visibleCase.id,
      event_type: "AI_OUTPUT_INVALID",
      event_summary: "AI analysis failed or returned invalid structured output.",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error"
      }
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/cases");
  revalidatePath(`/cases/${visibleCase.id}`);
  revalidatePath("/audit");
  redirect(`/cases/${visibleCase.id}`);
}
