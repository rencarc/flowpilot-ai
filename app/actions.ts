"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHandoffPayloadStep, runGovernedAgentTools } from "@/lib/agent-tools";
import { analyzeCaseWithOpenAI } from "@/lib/ai-analysis";
import { getCurrentUserContext } from "@/lib/cases";
import { executeConnectorRun, testConnector } from "@/lib/connectors";
import { createEmbedding } from "@/lib/embeddings";
import { exportAiAnalysisTraceToLangfuse } from "@/lib/langfuse";
import { retrievePolicyCitations, splitPolicyContent } from "@/lib/policies";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CaseRecord, ConnectorAuthType, ConnectorRecord, ConnectorType, RiskLevel, WorkflowRunRecord, WorkflowTemplateProposalRecord, WorkflowTemplateRecord } from "@/lib/supabase/types";

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseListInput(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonObject(value: string) {
  if (!value) {
    return {};
  }

  const parsed = JSON.parse(value);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object");
  }

  return parsed as Record<string, unknown>;
}

function optionalDateTime(formData: FormData, key: string) {
  const value = requiredString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function idempotencyKeyFor(caseId: string, workflowTemplateId: string) {
  return `case:${caseId}:workflow:${workflowTemplateId}`;
}

function aiModelName() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

const CASE_ANALYSIS_PROMPT_VERSION = "step_5_case_analysis_v1";

function aiErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Missing OPENAI_API_KEY")) {
    return "missing_openai_key";
  }

  if (message.includes("insufficient_quota") || message.includes("billing") || message.includes("quota")) {
    return "openai_billing_required";
  }

  if (message.includes("rate_limit")) {
    return "openai_rate_limited";
  }

  return "ai_output_invalid";
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
  const dueAt = optionalDateTime(formData, "due_at");
  const accessExpiresAt = optionalDateTime(formData, "access_expires_at");

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
      policy_evidence_status: "not_checked",
      due_at: dueAt,
      access_expires_at: accessExpiresAt
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
      ai_analysis: "pending",
      due_at: dueAt,
      access_expires_at: accessExpiresAt
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
  const traceId = crypto.randomUUID();
  const model = aiModelName();
  const admin = createAdminClient();
  let analysisErrorCode: string | null = null;

  try {
    const { data: workflowTemplates } = await supabase
      .from("workflow_templates")
      .select("*")
      .eq("workspace_id", profile.workspace_id)
      .in("lifecycle_status", ["approved", "active"])
      .returns<WorkflowTemplateRecord[]>();
    const agentRun = await runGovernedAgentTools(visibleCase, workflowTemplates ?? []);
    const policyCitations = agentRun.citations;
    const analysis = await analyzeCaseWithOpenAI({
      title: visibleCase.title,
      rawRequest: visibleCase.raw_request,
      department: visibleCase.department,
      priority: visibleCase.priority,
      dueAt: visibleCase.due_at,
      accessExpiresAt: visibleCase.access_expires_at
    });

    const latencyMs = Date.now() - startedAt;
    const policyEvidenceStatus = policyCitations.length > 0 ? "found" : "missing";
    const status = policyEvidenceStatus === "missing" ? "policy_evidence_missing" : analysis.status;
    const handoff = createHandoffPayloadStep({
      item: visibleCase,
      citations: policyCitations,
      missingFields: analysis.missing_information,
      template: agentRun.recommendedWorkflow,
      status,
      riskLevel: analysis.risk_level
    });
    const agentSteps = [...agentRun.steps, handoff.step];
    const aiOutput = {
      ...analysis,
      status,
      policy_citations: policyCitations,
      agent_steps: agentSteps,
      handoff_payload_preview: handoff.payload
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
        trace_id: traceId,
        model,
        latency_ms: latencyMs,
        confidence_score: analysis.confidence_score,
        matched_rules: analysis.matched_rules,
        policy_citations: policyCitations,
        agent_steps: agentSteps
      }
    });

    await admin.from("ai_traces").insert({
      workspace_id: profile.workspace_id,
      case_id: visibleCase.id,
      trace_id: traceId,
      prompt_version: CASE_ANALYSIS_PROMPT_VERSION,
      model,
      input_hash: visibleCase.id,
      output_valid: true,
      latency_ms: latencyMs
    });

    await exportAiAnalysisTraceToLangfuse({
      traceId,
      caseRecord: visibleCase,
      model,
      promptVersion: CASE_ANALYSIS_PROMPT_VERSION,
      latencyMs,
      outputValid: true,
      aiOutput
    });
  } catch (error) {
    console.error("AI analysis failed", error);
    const latencyMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorCode = aiErrorCode(error);
    analysisErrorCode = errorCode;
    await admin.from("cases").update({ status: "ai_output_invalid" }).eq("id", visibleCase.id).eq("workspace_id", profile.workspace_id);
    await admin.from("ai_traces").insert({
      workspace_id: profile.workspace_id,
      case_id: visibleCase.id,
      trace_id: traceId,
      prompt_version: CASE_ANALYSIS_PROMPT_VERSION,
      model,
      input_hash: visibleCase.id,
      output_valid: false,
      latency_ms: latencyMs,
      error_message: errorMessage
    });
    await admin.from("audit_logs").insert({
      workspace_id: profile.workspace_id,
      actor_id: user.id,
      actor_type: "system",
      case_id: visibleCase.id,
      event_type: "AI_OUTPUT_INVALID",
      event_summary: "AI analysis failed or returned invalid structured output.",
      metadata: {
        trace_id: traceId,
        latency_ms: latencyMs,
        error_code: errorCode,
        error: errorMessage
      }
    });

    await exportAiAnalysisTraceToLangfuse({
      traceId,
      caseRecord: visibleCase,
      model,
      promptVersion: CASE_ANALYSIS_PROMPT_VERSION,
      latencyMs,
      outputValid: false,
      aiOutput: null,
      errorMessage
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/cases");
  revalidatePath(`/cases/${visibleCase.id}`);
  revalidatePath("/audit");
  redirect(`/cases/${visibleCase.id}${analysisErrorCode ? `?error=${analysisErrorCode}` : ""}`);
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

export async function reviewCaseAction(formData: FormData) {
  const caseId = requiredString(formData, "case_id");
  const decision = requiredString(formData, "decision");
  const note = requiredString(formData, "note");
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!["reviewer", "admin"].includes(profile.role)) {
    redirect(`/cases/${caseId}?error=review_forbidden`);
  }

  const { data: visibleCase, error: readError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle<CaseRecord>();

  if (readError || !visibleCase) {
    console.error("Unauthorized or missing case for review", readError);
    redirect("/review?error=case_not_visible");
  }

  const reviewConfig = {
    approve: {
      status: "approved" as const,
      humanReviewRequired: false,
      eventType: "CASE_APPROVED",
      eventSummary: "Reviewer approved the case for controlled workflow handoff."
    },
    request_info: {
      status: "needs_info" as const,
      humanReviewRequired: true,
      eventType: "CHANGES_REQUESTED",
      eventSummary: "Reviewer requested more information before handoff."
    },
    reject: {
      status: "rejected" as const,
      humanReviewRequired: false,
      eventType: "CASE_REJECTED",
      eventSummary: "Reviewer rejected the case."
    }
  }[decision];

  if (!reviewConfig) {
    redirect(`/cases/${visibleCase.id}?error=invalid_review_decision`);
  }

  const admin = createAdminClient();
  const existingOutput = visibleCase.ai_output ?? {};
  const reviewHistory = Array.isArray(existingOutput.review_history) ? existingOutput.review_history : [];
  const aiOutput = {
    ...existingOutput,
    review_decision: decision,
    review_note: note || null,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    review_history: [
      ...reviewHistory,
      {
        decision,
        note: note || null,
        reviewer_id: user.id,
        reviewed_at: new Date().toISOString()
      }
    ]
  };

  const { error: updateError } = await admin
    .from("cases")
    .update({
      status: reviewConfig.status,
      human_review_required: reviewConfig.humanReviewRequired,
      ai_output: aiOutput
    })
    .eq("id", visibleCase.id)
    .eq("workspace_id", profile.workspace_id);

  if (updateError) {
    console.error("Failed to update review decision", updateError);
    redirect(`/cases/${visibleCase.id}?error=review_failed`);
  }

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "user",
    case_id: visibleCase.id,
    event_type: reviewConfig.eventType,
    event_summary: reviewConfig.eventSummary,
    metadata: {
      decision,
      note: note || null,
      previous_status: visibleCase.status,
      next_status: reviewConfig.status
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/cases");
  revalidatePath("/review");
  revalidatePath(`/cases/${visibleCase.id}`);
  revalidatePath("/audit");
  redirect(`/cases/${visibleCase.id}`);
}

export async function archiveCaseAction(formData: FormData) {
  const caseId = requiredString(formData, "case_id");
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/cases?error=archive_forbidden");
  }

  const { data: visibleCase, error: readError } = await supabase
    .from("cases")
    .select("id, workspace_id, status, ai_output")
    .eq("id", caseId)
    .maybeSingle<Pick<CaseRecord, "id" | "workspace_id" | "status" | "ai_output">>();

  if (readError || !visibleCase) {
    console.error("Unauthorized or missing case for archive", readError);
    redirect("/cases?error=case_not_visible");
  }

  const archivedAt = new Date().toISOString();
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("cases")
    .update({
      status: "closed",
      human_review_required: false,
      ai_output: {
        ...(visibleCase.ai_output ?? {}),
        archived_by: user.id,
        archived_at: archivedAt,
        previous_status: visibleCase.status
      }
    })
    .eq("id", visibleCase.id)
    .eq("workspace_id", profile.workspace_id);

  if (updateError) {
    console.error("Failed to archive case", updateError);
    redirect("/cases?error=archive_failed");
  }

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "user",
    case_id: visibleCase.id,
    event_type: "CASE_ARCHIVED",
    event_summary: "Admin archived the case.",
    metadata: {
      previous_status: visibleCase.status,
      next_status: "closed",
      archived_at: archivedAt
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/cases");
  revalidatePath(`/cases/${visibleCase.id}`);
  revalidatePath("/review");
  revalidatePath("/audit");
  redirect("/cases");
}

export async function provideCaseInfoAction(formData: FormData) {
  const caseId = requiredString(formData, "case_id");
  const update = requiredString(formData, "update");
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!update) {
    redirect(`/cases/${caseId}?error=missing_update`);
  }

  const { data: visibleCase, error: readError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle<CaseRecord>();

  if (readError || !visibleCase) {
    console.error("Unauthorized or missing case for requester update", readError);
    redirect("/cases?error=case_not_visible");
  }

  if (visibleCase.created_by !== user.id) {
    redirect(`/cases/${visibleCase.id}?error=update_forbidden`);
  }

  const admin = createAdminClient();
  const existingOutput = visibleCase.ai_output ?? {};
  const requesterUpdates = Array.isArray(existingOutput.requester_updates) ? existingOutput.requester_updates : [];
  const submittedAt = new Date().toISOString();
  const aiOutput = {
    ...existingOutput,
    requester_updates: [
      ...requesterUpdates,
      {
        update,
        submitted_by: user.id,
        submitted_at: submittedAt
      }
    ],
    latest_requester_update: update,
    latest_requester_update_at: submittedAt
  };

  const { error: updateError } = await admin
    .from("cases")
    .update({
      status: "in_review",
      human_review_required: true,
      ai_output: aiOutput
    })
    .eq("id", visibleCase.id)
    .eq("workspace_id", profile.workspace_id);

  if (updateError) {
    console.error("Failed to save requester update", updateError);
    redirect(`/cases/${visibleCase.id}?error=update_failed`);
  }

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "user",
    case_id: visibleCase.id,
    event_type: "REQUESTER_INFO_PROVIDED",
    event_summary: "Requester provided additional information for review.",
    metadata: {
      previous_status: visibleCase.status,
      next_status: "in_review",
      update
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/cases");
  revalidatePath("/review");
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

export async function generatePolicyEmbeddingsAction() {
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/knowledge?error=policy_forbidden");
  }

  const { data: chunks, error } = await supabase
    .from("policy_chunks")
    .select("id, content, metadata")
    .eq("workspace_id", profile.workspace_id)
    .is("embedding", null)
    .order("created_at", { ascending: true })
    .limit(20)
    .returns<Array<{ id: string; content: string; metadata: Record<string, unknown> | null }>>();

  if (error) {
    console.error("Failed to load chunks for embedding", error);
    redirect("/knowledge?error=embedding_failed");
  }

  if (!chunks || chunks.length === 0) {
    redirect("/knowledge?embedded=0");
  }

  const admin = createAdminClient();
  let embedded = 0;

  try {
    for (const chunk of chunks) {
      const embedding = await createEmbedding(chunk.content);
      const { error: updateError } = await admin
        .from("policy_chunks")
        .update({
          embedding: embedding.vector,
          metadata: {
            ...(chunk.metadata ?? {}),
            retrieval_mode: "semantic_pgvector",
            embedding_status: "embedded",
            embedding_model: embedding.model,
            embedded_at: new Date().toISOString()
          }
        })
        .eq("id", chunk.id)
        .eq("workspace_id", profile.workspace_id);

      if (updateError) {
        throw updateError;
      }

      embedded += 1;
    }
  } catch (embeddingError) {
    console.error("Failed to generate policy embeddings", embeddingError);
    await admin.from("audit_logs").insert({
      workspace_id: profile.workspace_id,
      actor_id: user.id,
      actor_type: "system",
      event_type: "POLICY_EMBEDDING_FAILED",
      event_summary: "Policy embedding generation failed.",
      metadata: {
        embedded,
        error: embeddingError instanceof Error ? embeddingError.message : "Unknown embedding error"
      }
    });
    redirect("/knowledge?error=embedding_failed");
  }

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "system",
    event_type: "POLICY_EMBEDDINGS_CREATED",
    event_summary: `Generated semantic embeddings for ${embedded} policy chunk(s).`,
    metadata: {
      embedded,
      retrieval_mode: "semantic_pgvector"
    }
  });

  revalidatePath("/knowledge");
  revalidatePath("/audit");
  redirect(`/knowledge?embedded=${embedded}`);
}

export async function createWorkflowTemplateAction(formData: FormData) {
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/workflows?error=workflow_forbidden");
  }

  const name = requiredString(formData, "name");
  const description = requiredString(formData, "description");
  const category = requiredString(formData, "category");
  const triggerCondition = requiredString(formData, "trigger_condition");
  const requiredFields = parseListInput(requiredString(formData, "required_fields"));
  const riskLevel = requiredString(formData, "risk_level") || "medium";
  const requiresReview = formData.get("requires_review") === "on";
  const payloadSchemaInput = requiredString(formData, "payload_schema");

  if (!name || !category || !triggerCondition) {
    redirect("/workflows?error=missing_workflow");
  }

  if (!["low", "medium", "high"].includes(riskLevel)) {
    redirect("/workflows?error=invalid_workflow");
  }

  let payloadSchema: Record<string, unknown>;

  try {
    payloadSchema = parseJsonObject(payloadSchemaInput);
  } catch (error) {
    console.error("Invalid workflow payload schema", error);
    redirect("/workflows?error=invalid_payload_schema");
  }

  const { data: workflow, error: workflowError } = await supabase
    .from("workflow_templates")
    .insert({
      workspace_id: profile.workspace_id,
      name,
      description: description || null,
      category,
      trigger_condition: triggerCondition,
      required_fields: requiredFields,
      risk_level: riskLevel,
      requires_review: requiresReview,
      payload_schema: payloadSchema,
      active: true,
      lifecycle_status: "approved"
    })
    .select("id")
    .single<{ id: string }>();

  if (workflowError || !workflow) {
    console.error("Failed to create workflow template", workflowError);
    redirect("/workflows?error=create_workflow_failed");
  }

  await supabase.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "user",
    event_type: "WORKFLOW_TEMPLATE_CREATED",
    event_summary: `Admin created approved workflow template: ${name}.`,
    metadata: {
      workflow_template_id: workflow.id,
      category,
      risk_level: riskLevel,
      required_fields: requiredFields,
      requires_review: requiresReview
    }
  });

  revalidatePath("/workflows");
  revalidatePath("/audit");
  redirect("/workflows");
}

export async function matchWorkflowTemplateAction(formData: FormData) {
  const caseId = requiredString(formData, "case_id");
  const workflowTemplateId = requiredString(formData, "workflow_template_id");
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!["reviewer", "admin"].includes(profile.role)) {
    redirect(`/cases/${caseId}?error=workflow_forbidden`);
  }

  if (!workflowTemplateId) {
    redirect(`/cases/${caseId}?error=missing_workflow_match`);
  }

  const { data: visibleCase, error: caseError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle<CaseRecord>();

  if (caseError || !visibleCase) {
    console.error("Unauthorized or missing case for workflow match", caseError);
    redirect("/cases?error=case_not_visible");
  }

  const { data: template, error: templateError } = await supabase
    .from("workflow_templates")
    .select("id, name, lifecycle_status, active")
    .eq("id", workflowTemplateId)
    .maybeSingle<{ id: string; name: string; lifecycle_status: string; active: boolean }>();

  if (templateError || !template || !["approved", "active"].includes(template.lifecycle_status)) {
    console.error("Missing or unapproved workflow template", templateError);
    redirect(`/cases/${visibleCase.id}?error=workflow_match_failed`);
  }

  const admin = createAdminClient();
  const existingOutput = visibleCase.ai_output ?? {};
  const aiOutput = {
    ...existingOutput,
    matched_workflow: {
      id: template.id,
      name: template.name,
      matched_by: user.id,
      matched_at: new Date().toISOString()
    }
  };

  const { error: updateError } = await admin
    .from("cases")
    .update({
      matched_workflow_template_id: template.id,
      workflow_template_proposal_id: null,
      ai_output: aiOutput
    })
    .eq("id", visibleCase.id)
    .eq("workspace_id", profile.workspace_id);

  if (updateError) {
    console.error("Failed to match workflow template", updateError);
    redirect(`/cases/${visibleCase.id}?error=workflow_match_failed`);
  }

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "user",
    case_id: visibleCase.id,
    event_type: "WORKFLOW_TEMPLATE_MATCHED",
    event_summary: `Reviewer matched approved workflow template: ${template.name}.`,
    metadata: {
      workflow_template_id: template.id,
      workflow_template_name: template.name,
      previous_status: visibleCase.status
    }
  });

  revalidatePath("/cases");
  revalidatePath("/review");
  revalidatePath(`/cases/${visibleCase.id}`);
  revalidatePath("/audit");
  redirect(`/cases/${visibleCase.id}`);
}

export async function createWorkflowProposalAction(formData: FormData) {
  const caseId = requiredString(formData, "case_id");
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!["reviewer", "admin"].includes(profile.role)) {
    redirect(`/cases/${caseId}?error=workflow_forbidden`);
  }

  const { data: visibleCase, error: caseError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle<CaseRecord>();

  if (caseError || !visibleCase) {
    console.error("Unauthorized or missing case for workflow proposal", caseError);
    redirect("/cases?error=case_not_visible");
  }

  const requiredFields = [
    "requester",
    "business justification",
    "approval evidence",
    ...(visibleCase.department ? ["department"] : []),
    ...(visibleCase.policy_evidence_status !== "found" ? ["policy evidence"] : [])
  ];
  const proposalName = `${visibleCase.category ?? visibleCase.department ?? "Operations"} workflow proposal`;
  const admin = createAdminClient();
  const { data: proposal, error: proposalError } = await admin
    .from("workflow_template_proposals")
    .insert({
      workspace_id: profile.workspace_id,
      source_case_id: visibleCase.id,
      name: proposalName,
      description: `Governed workflow proposal drafted from case: ${visibleCase.title}.`,
      category: visibleCase.category ?? "General intake",
      trigger_condition: visibleCase.raw_request.slice(0, 220),
      required_fields: requiredFields,
      risk_level: (visibleCase.risk_level ?? "medium") as RiskLevel,
      requires_review: true,
      suggested_steps: [
        "Validate requester authority and business justification.",
        "Confirm required policy evidence and missing information.",
        "Preview payload before any backend connector handoff.",
        "Require reviewer/admin approval before execution."
      ],
      payload_schema: {
        case_id: "string",
        requester: "string",
        department: "string",
        approval_evidence: "string",
        policy_citations: "array"
      },
      connector_type_suggestion: "mock_internal_api",
      policy_evidence: Array.isArray(visibleCase.ai_output?.policy_citations) ? visibleCase.ai_output.policy_citations : [],
      limitations: [
        "Draft proposal only.",
        "Cannot execute until an admin converts it into an approved workflow template.",
        "Connector configuration is required before production handoff."
      ],
      status: "under_review"
    })
    .select("id")
    .single<{ id: string }>();

  if (proposalError || !proposal) {
    console.error("Failed to create workflow proposal", proposalError);
    redirect(`/cases/${visibleCase.id}?error=proposal_failed`);
  }

  const existingOutput = visibleCase.ai_output ?? {};
  await admin
    .from("cases")
    .update({
      status: "no_template_match",
      workflow_template_proposal_id: proposal.id,
      ai_output: {
        ...existingOutput,
        workflow_proposal: {
          id: proposal.id,
          name: proposalName,
          status: "under_review",
          created_at: new Date().toISOString()
        }
      },
      human_review_required: true
    })
    .eq("id", visibleCase.id)
    .eq("workspace_id", profile.workspace_id);

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "system",
    case_id: visibleCase.id,
    event_type: "WORKFLOW_PROPOSAL_CREATED",
    event_summary: "Draft workflow proposal created for a case without an approved template match.",
    metadata: {
      workflow_template_proposal_id: proposal.id,
      proposal_name: proposalName,
      source: "governed_fallback"
    }
  });

  revalidatePath("/cases");
  revalidatePath("/review");
  revalidatePath("/workflows");
  revalidatePath(`/cases/${visibleCase.id}`);
  revalidatePath("/audit");
  redirect(`/cases/${visibleCase.id}`);
}

export async function convertWorkflowProposalAction(formData: FormData) {
  const proposalId = requiredString(formData, "proposal_id");
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/workflows?error=workflow_forbidden");
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("workflow_template_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle<WorkflowTemplateProposalRecord>();

  if (proposalError || !proposal || proposal.status === "converted") {
    console.error("Missing or already converted workflow proposal", proposalError);
    redirect("/workflows?error=convert_proposal_failed");
  }

  const admin = createAdminClient();
  const { data: template, error: templateError } = await admin
    .from("workflow_templates")
    .insert({
      workspace_id: profile.workspace_id,
      name: proposal.name,
      description: proposal.description,
      category: proposal.category,
      trigger_condition: proposal.trigger_condition,
      required_fields: proposal.required_fields,
      risk_level: proposal.risk_level,
      requires_review: proposal.requires_review,
      payload_schema: proposal.payload_schema,
      active: true,
      lifecycle_status: "approved",
      created_from_proposal_id: proposal.id
    })
    .select("id")
    .single<{ id: string }>();

  if (templateError || !template) {
    console.error("Failed to convert workflow proposal", templateError);
    redirect("/workflows?error=convert_proposal_failed");
  }

  await admin
    .from("workflow_template_proposals")
    .update({
      status: "converted",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", proposal.id)
    .eq("workspace_id", profile.workspace_id);

  await admin
    .from("cases")
    .update({
      matched_workflow_template_id: template.id
    })
    .eq("workflow_template_proposal_id", proposal.id)
    .eq("workspace_id", profile.workspace_id);

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "user",
    case_id: proposal.source_case_id,
    event_type: "WORKFLOW_PROPOSAL_CONVERTED",
    event_summary: `Admin converted workflow proposal into approved template: ${proposal.name}.`,
    metadata: {
      workflow_template_proposal_id: proposal.id,
      workflow_template_id: template.id
    }
  });

  revalidatePath("/workflows");
  revalidatePath("/cases");
  if (proposal.source_case_id) {
    revalidatePath(`/cases/${proposal.source_case_id}`);
  }
  revalidatePath("/audit");
  redirect("/workflows");
}

export async function createConnectorAction(formData: FormData) {
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/settings?error=connector_forbidden");
  }

  const name = requiredString(formData, "name");
  const endpointUrl = requiredString(formData, "endpoint_url");
  const connectorType = requiredString(formData, "type") || "mock_internal_api";
  const authType = requiredString(formData, "auth_type") || "none";
  const secretRef = requiredString(formData, "secret_ref");

  if (!name) {
    redirect("/settings?error=missing_connector");
  }

  if (!["mock_internal_api", "custom_webhook", "slack"].includes(connectorType)) {
    redirect("/settings?error=invalid_connector");
  }

  if (!["none", "bearer_token", "api_key_header", "hmac_signature", "basic_auth"].includes(authType)) {
    redirect("/settings?error=invalid_connector_auth");
  }

  if (connectorType === "custom_webhook" && !endpointUrl) {
    redirect("/settings?error=missing_connector_url");
  }

  if ((authType !== "none" || connectorType === "slack") && !secretRef) {
    redirect("/settings?error=missing_secret_ref");
  }

  const { data: connector, error } = await supabase
    .from("connectors")
    .insert({
      workspace_id: profile.workspace_id,
      name,
      type: connectorType as ConnectorType,
      endpoint_url: endpointUrl || null,
      auth_type: authType as ConnectorAuthType,
      secret_ref: secretRef || null,
      headers: {},
      active: true,
      created_by: user.id
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !connector) {
    console.error("Failed to create connector", error);
    redirect("/settings?error=create_connector_failed");
  }

  await supabase.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "user",
    event_type: "CONNECTOR_CREATED",
    event_summary: `Admin created connector: ${name}.`,
    metadata: { connector_id: connector.id, type: connectorType, auth_type: authType, has_secret_ref: Boolean(secretRef) }
  });

  revalidatePath("/settings");
  revalidatePath("/audit");
  redirect("/settings");
}

export async function testConnectorAction(formData: FormData) {
  const connectorId = requiredString(formData, "connector_id");
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/settings?error=connector_forbidden");
  }

  const { data: connector, error } = await supabase
    .from("connectors")
    .select("id, type, endpoint_url, auth_type, secret_ref")
    .eq("id", connectorId)
    .eq("workspace_id", profile.workspace_id)
    .maybeSingle<Pick<ConnectorRecord, "id" | "type" | "endpoint_url" | "auth_type" | "secret_ref">>();

  if (error || !connector) {
    console.error("Missing connector for test", error);
    redirect("/settings?error=connector_test_failed");
  }

  const result = await testConnector(connector);
  const admin = createAdminClient();

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "connector",
    event_type: result.failed ? "CONNECTOR_TEST_FAILED" : "CONNECTOR_TEST_SUCCEEDED",
    event_summary: result.failed ? "Connector test failed." : "Connector test succeeded.",
    metadata: {
      connector_id: connector.id,
      connector_type: connector.type,
      adapter_type: result.adapterType,
      response_status: result.responseStatus,
      response_body: result.responseBody,
      error_message: result.errorMessage
    }
  });

  revalidatePath("/settings");
  revalidatePath("/audit");
  redirect(`/settings?connector_test=${result.failed ? "failed" : "succeeded"}`);
}

export async function toggleConnectorAction(formData: FormData) {
  const connectorId = requiredString(formData, "connector_id");
  const active = requiredString(formData, "active") === "true";
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (profile.role !== "admin") {
    redirect("/settings?error=connector_forbidden");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("connectors")
    .update({ active })
    .eq("id", connectorId)
    .eq("workspace_id", profile.workspace_id);

  if (error) {
    console.error("Failed to update connector status", error);
    redirect("/settings?error=connector_update_failed");
  }

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "user",
    event_type: active ? "CONNECTOR_ENABLED" : "CONNECTOR_DISABLED",
    event_summary: active ? "Admin enabled connector." : "Admin disabled connector.",
    metadata: {
      connector_id: connectorId,
      active
    }
  });

  revalidatePath("/settings");
  revalidatePath("/audit");
  redirect("/settings");
}

export async function createWorkflowRunAction(formData: FormData) {
  const caseId = requiredString(formData, "case_id");
  const connectorId = requiredString(formData, "connector_id");
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!["reviewer", "admin"].includes(profile.role)) {
    redirect(`/cases/${caseId}?error=workflow_run_forbidden`);
  }

  const { data: visibleCase, error: caseError } = await supabase.from("cases").select("*").eq("id", caseId).maybeSingle<CaseRecord>();

  if (caseError || !visibleCase || !visibleCase.matched_workflow_template_id || visibleCase.status !== "approved") {
    console.error("Case is not ready for workflow run", caseError);
    redirect(`/cases/${caseId}?error=workflow_run_not_ready`);
  }

  const { data: template, error: templateError } = await supabase
    .from("workflow_templates")
    .select("id, name, payload_schema, lifecycle_status, connector_id")
    .eq("id", visibleCase.matched_workflow_template_id)
    .maybeSingle<{ id: string; name: string; payload_schema: Record<string, unknown>; lifecycle_status: string; connector_id: string | null }>();

  if (templateError || !template || !["approved", "active"].includes(template.lifecycle_status)) {
    console.error("Workflow template is not executable", templateError);
    redirect(`/cases/${caseId}?error=workflow_run_not_ready`);
  }

  const payload = {
    case_id: visibleCase.id,
    title: visibleCase.title,
    requester: visibleCase.requester,
    department: visibleCase.department,
    risk_level: visibleCase.risk_level,
    policy_citations: Array.isArray(visibleCase.ai_output?.policy_citations) ? visibleCase.ai_output.policy_citations : [],
    schema: template.payload_schema
  };
  const idempotencyKey = idempotencyKeyFor(visibleCase.id, template.id);
  const admin = createAdminClient();
  const { data: run, error: runError } = await admin
    .from("workflow_runs")
    .upsert({
      workspace_id: profile.workspace_id,
      case_id: visibleCase.id,
      workflow_template_id: template.id,
      connector_id: connectorId || template.connector_id,
      status: "queued",
      payload,
      idempotency_key: idempotencyKey,
      approved_by: user.id,
      approved_at: new Date().toISOString()
    }, { onConflict: "idempotency_key" })
    .select("id")
    .single<{ id: string }>();

  if (runError || !run) {
    console.error("Failed to create workflow run", runError);
    redirect(`/cases/${caseId}?error=workflow_run_failed`);
  }

  await admin.from("execution_attempts").insert({
    workflow_run_id: run.id,
    workspace_id: profile.workspace_id,
    attempt_number: 1,
    status: "pending",
    request_payload: payload
  });

  await admin.from("cases").update({ status: "ready_to_run" }).eq("id", visibleCase.id).eq("workspace_id", profile.workspace_id);
  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "system",
    case_id: visibleCase.id,
    workflow_run_id: run.id,
    event_type: "WORKFLOW_RUN_QUEUED",
    event_summary: `Workflow run queued for approved template: ${template.name}.`,
    metadata: { workflow_template_id: template.id, idempotency_key: idempotencyKey, connector_id: connectorId || template.connector_id }
  });

  revalidatePath("/dashboard");
  revalidatePath("/cases");
  revalidatePath(`/cases/${visibleCase.id}`);
  revalidatePath("/audit");
  redirect(`/cases/${visibleCase.id}`);
}

export async function executeWorkflowRunAction(formData: FormData) {
  const runId = requiredString(formData, "workflow_run_id");
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!["reviewer", "admin"].includes(profile.role)) {
    redirect("/cases?error=workflow_run_forbidden");
  }

  const { data: run, error: runError } = await supabase.from("workflow_runs").select("*").eq("id", runId).maybeSingle<WorkflowRunRecord>();

  if (runError || !run || !["pending", "queued", "retrying"].includes(run.status)) {
    console.error("Workflow run is not executable", runError);
    redirect(run?.case_id ? `/cases/${run.case_id}?error=workflow_execute_failed` : "/cases?error=workflow_execute_failed");
  }

  const admin = createAdminClient();
  const startedAt = Date.now();
  const { data: connector } = run.connector_id
    ? await admin.from("connectors").select("type, endpoint_url, auth_type, secret_ref, active").eq("id", run.connector_id).eq("workspace_id", profile.workspace_id).maybeSingle<Pick<ConnectorRecord, "type" | "endpoint_url" | "auth_type" | "secret_ref" | "active">>()
    : { data: null };
  const { data: attempts } = await admin
    .from("execution_attempts")
    .select("attempt_number")
    .eq("workflow_run_id", run.id)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .returns<Array<{ attempt_number: number }>>();
  const attemptNumber = attempts?.[0]?.attempt_number ?? 1;

  await admin.from("workflow_runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", run.id).eq("workspace_id", profile.workspace_id);
  await admin
    .from("execution_attempts")
    .update({ status: "running" })
    .eq("workflow_run_id", run.id)
    .eq("attempt_number", attemptNumber)
    .eq("workspace_id", profile.workspace_id);

  const result = connector?.active === false
    ? {
        failed: true,
        responseStatus: 400,
        responseBody: { ok: false, message: "Connector is disabled." },
        errorMessage: "Connector is disabled.",
        adapterType: connector.type
      }
    : await executeConnectorRun(run, connector);
  const failed = result.failed;
  const latencyMs = Date.now() - startedAt;
  const completedAt = new Date().toISOString();

  await admin
    .from("execution_attempts")
    .update({
      status: failed ? "failed" : "succeeded",
      response_status: result.responseStatus,
      response_body: result.responseBody,
      error_message: result.errorMessage,
      latency_ms: latencyMs
    })
    .eq("workflow_run_id", run.id)
    .eq("attempt_number", attemptNumber)
    .eq("workspace_id", profile.workspace_id);

  await admin
    .from("workflow_runs")
    .update({
      status: failed ? "failed" : "succeeded",
      completed_at: completedAt,
      failure_reason: result.errorMessage
    })
    .eq("id", run.id)
    .eq("workspace_id", profile.workspace_id);

  await admin
    .from("cases")
    .update({ status: failed ? "failed" : "completed" })
    .eq("id", run.case_id)
    .eq("workspace_id", profile.workspace_id);

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "connector",
    case_id: run.case_id,
    workflow_run_id: run.id,
    event_type: failed ? "WORKFLOW_RUN_FAILED" : "WORKFLOW_RUN_SUCCEEDED",
    event_summary: failed ? "Backend connector failed the workflow run." : "Backend connector completed the workflow run.",
    metadata: {
      attempt_number: attemptNumber,
      latency_ms: latencyMs,
      response_status: result.responseStatus,
      response_body: result.responseBody,
      connector_type: connector?.type ?? "mock_internal_api",
      adapter_type: result.adapterType
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/cases");
  revalidatePath(`/cases/${run.case_id}`);
  revalidatePath("/audit");
  redirect(`/cases/${run.case_id}`);
}

export async function cancelWorkflowRunAction(formData: FormData) {
  const runId = requiredString(formData, "workflow_run_id");
  const reason = requiredString(formData, "reason");
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!["reviewer", "admin"].includes(profile.role)) {
    redirect("/cases?error=workflow_run_forbidden");
  }

  const { data: run, error: runError } = await supabase.from("workflow_runs").select("*").eq("id", runId).maybeSingle<WorkflowRunRecord>();

  if (runError || !run || !["pending", "queued", "running", "failed", "retrying"].includes(run.status)) {
    console.error("Workflow run is not cancellable", runError);
    redirect(run?.case_id ? `/cases/${run.case_id}?error=workflow_cancel_failed` : "/cases?error=workflow_cancel_failed");
  }

  const admin = createAdminClient();
  await admin
    .from("workflow_runs")
    .update({
      status: "cancelled",
      failure_reason: reason || "Cancelled by reviewer/admin.",
      completed_at: new Date().toISOString()
    })
    .eq("id", run.id)
    .eq("workspace_id", profile.workspace_id);

  await admin
    .from("cases")
    .update({ status: "closed" })
    .eq("id", run.case_id)
    .eq("workspace_id", profile.workspace_id);

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "user",
    case_id: run.case_id,
    workflow_run_id: run.id,
    event_type: "WORKFLOW_RUN_CANCELLED",
    event_summary: "Reviewer/admin cancelled the workflow run.",
    metadata: {
      previous_status: run.status,
      next_status: "cancelled",
      reason: reason || null
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/cases");
  revalidatePath(`/cases/${run.case_id}`);
  revalidatePath("/audit");
  redirect(`/cases/${run.case_id}`);
}

export async function retryWorkflowRunAction(formData: FormData) {
  const runId = requiredString(formData, "workflow_run_id");
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!["reviewer", "admin"].includes(profile.role)) {
    redirect("/cases?error=workflow_run_forbidden");
  }

  const { data: run, error: runError } = await supabase.from("workflow_runs").select("*").eq("id", runId).maybeSingle<WorkflowRunRecord>();

  if (runError || !run || run.status !== "failed" || run.retry_count >= run.max_retries) {
    console.error("Workflow run is not retryable", runError);
    redirect(run?.case_id ? `/cases/${run.case_id}?error=workflow_retry_failed` : "/cases?error=workflow_retry_failed");
  }

  const admin = createAdminClient();
  const nextAttemptNumber = run.retry_count + 2;
  const nextRetryCount = run.retry_count + 1;

  await admin
    .from("workflow_runs")
    .update({
      status: "retrying",
      retry_count: nextRetryCount,
      failure_reason: null
    })
    .eq("id", run.id)
    .eq("workspace_id", profile.workspace_id);

  await admin.from("execution_attempts").insert({
    workflow_run_id: run.id,
    workspace_id: profile.workspace_id,
    attempt_number: nextAttemptNumber,
    status: "pending",
    request_payload: run.payload
  });

  await admin.from("audit_logs").insert({
    workspace_id: profile.workspace_id,
    actor_id: user.id,
    actor_type: "system",
    case_id: run.case_id,
    workflow_run_id: run.id,
    event_type: "WORKFLOW_RUN_RETRY_QUEUED",
    event_summary: `Workflow run retry queued as attempt ${nextAttemptNumber}.`,
    metadata: {
      attempt_number: nextAttemptNumber,
      retry_count: nextRetryCount,
      max_retries: run.max_retries
    }
  });

  revalidatePath("/cases");
  revalidatePath(`/cases/${run.case_id}`);
  revalidatePath("/audit");
  redirect(`/cases/${run.case_id}`);
}
