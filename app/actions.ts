"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { analyzeCaseWithOpenAI } from "@/lib/ai-analysis";
import { getCurrentUserContext } from "@/lib/cases";
import { retrievePolicyCitations, splitPolicyContent } from "@/lib/policies";
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
  const policyCitations = await retrievePolicyCitations(visibleCase);

  try {
    const analysis = await analyzeCaseWithOpenAI({
      title: visibleCase.title,
      rawRequest: visibleCase.raw_request,
      department: visibleCase.department,
      priority: visibleCase.priority
    });

    const latencyMs = Date.now() - startedAt;
    const policyEvidenceStatus = policyCitations.length > 0 ? "found" : "missing";
    const status = policyEvidenceStatus === "missing" ? "policy_evidence_missing" : analysis.status;
    const aiOutput = {
      ...analysis,
      status,
      policy_citations: policyCitations
    };
    const { error: updateError } = await admin
      .from("cases")
      .update({
        summary: analysis.summary,
        category: analysis.case_type,
        risk_level: analysis.risk_level,
        status,
        confidence_score: analysis.confidence_score,
        missing_information: analysis.missing_information,
        ai_output: aiOutput,
        human_review_required: analysis.human_review_required || policyEvidenceStatus === "missing",
        policy_evidence_status: policyEvidenceStatus
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
      event_type: policyEvidenceStatus === "found" ? "POLICY_EVIDENCE_FOUND" : "POLICY_EVIDENCE_MISSING",
      event_summary:
        policyEvidenceStatus === "found"
          ? `AI classified case as ${analysis.risk_level} risk with ${policyCitations.length} policy citation(s).`
          : "AI analysis completed, but no matching policy evidence was found.",
      metadata: {
        model: "gpt-4.1-mini",
        latency_ms: latencyMs,
        confidence_score: analysis.confidence_score,
        matched_rules: analysis.matched_rules,
        policy_citations: policyCitations
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

export async function checkPolicyEvidenceAction(formData: FormData) {
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
    console.error("Unauthorized or missing case for policy evidence check", readError);
    redirect("/cases?error=case_not_visible");
  }

  const policyCitations = await retrievePolicyCitations(visibleCase);
  const policyEvidenceStatus = policyCitations.length > 0 ? "found" : "missing";
  const nextStatus = policyEvidenceStatus === "found" ? "in_review" : "policy_evidence_missing";
  const admin = createAdminClient();
  const aiOutput = {
    ...(visibleCase.ai_output ?? {}),
    policy_citations: policyCitations,
    retrieval_mode: "keyword_dev"
  };

  const { error: updateError } = await admin
    .from("cases")
    .update({
      status: nextStatus,
      ai_output: aiOutput,
      human_review_required: true,
      policy_evidence_status: policyEvidenceStatus
    })
    .eq("id", visibleCase.id)
    .eq("workspace_id", profile.workspace_id);

  if (updateError) {
    console.error("Failed to update policy evidence", updateError);
    redirect(`/cases/${visibleCase.id}?error=policy_check_failed`);
  }

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "system",
    case_id: visibleCase.id,
    event_type: policyEvidenceStatus === "found" ? "POLICY_EVIDENCE_FOUND" : "POLICY_EVIDENCE_MISSING",
    event_summary:
      policyEvidenceStatus === "found"
        ? `Policy retrieval found ${policyCitations.length} matching citation(s).`
        : "Policy retrieval found no matching evidence; case remains blocked for review.",
    metadata: {
      retrieval_mode: "keyword_dev",
      policy_citations: policyCitations
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/cases");
  revalidatePath(`/cases/${visibleCase.id}`);
  revalidatePath("/audit");
  redirect(`/cases/${visibleCase.id}`);
}

export async function createPolicyAction(formData: FormData) {
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/knowledge?error=policy_forbidden");
  }

  const title = requiredString(formData, "title");
  const description = requiredString(formData, "description");
  const content = requiredString(formData, "content");
  const sourceUrl = requiredString(formData, "source_url");

  if (!title || !content) {
    redirect("/knowledge?error=missing_policy");
  }

  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .insert({
      workspace_id: profile.workspace_id,
      title,
      description: description || null,
      source_type: sourceUrl ? "url" : "manual",
      source_url: sourceUrl || null,
      created_by: user.id
    })
    .select("id")
    .single<{ id: string }>();

  if (policyError || !policy) {
    console.error("Failed to create policy", policyError);
    redirect("/knowledge?error=create_failed");
  }

  const chunks = splitPolicyContent(content);

  if (chunks.length > 0) {
    const { error: chunkError } = await supabase.from("policy_chunks").insert(
      chunks.map((chunk, index) => ({
        policy_id: policy.id,
        workspace_id: profile.workspace_id,
        chunk_index: index,
        content: chunk,
        metadata: {
          retrieval_mode: "keyword_dev",
          embedding_status: "pending_openai_credits"
        }
      }))
    );

    if (chunkError) {
      console.error("Failed to create policy chunks", chunkError);
      redirect("/knowledge?error=chunk_failed");
    }
  }

  await supabase.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "user",
    event_type: "POLICY_CREATED",
    event_summary: `Admin added policy source: ${title}.`,
    metadata: {
      chunks: chunks.length,
      retrieval_mode: "keyword_dev"
    }
  });

  revalidatePath("/knowledge");
  revalidatePath("/audit");
  redirect("/knowledge");
}
