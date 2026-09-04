import Link from "next/link";
import { analyzeCaseAction, cancelWorkflowRunAction, checkPolicyEvidenceAction, createWorkflowProposalAction, createWorkflowRunAction, executeWorkflowRunAction, matchWorkflowTemplateAction, provideCaseInfoAction, retryWorkflowRunAction, reviewCaseAction, trashCaseAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { ActionList, AppShell, Kv, PageHeader, Panel, PersistedTimeline, Tag, Timeline } from "@/components/ui";
import { formatCaseStatus, formatDateTime, formatRisk, getAuditLogsForCase, getCurrentUserContext, getVisibleCase } from "@/lib/cases";
import { getCase, getTemplate } from "@/lib/mock-data";
import { getExecutionAttemptsForRuns, getVisibleConnectors, getWorkflowRunsForCase } from "@/lib/execution";
import { getVisibleWorkflowTemplateProposals, getVisibleWorkflowTemplates, recommendWorkflowTemplate } from "@/lib/workflows";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function nextActionFor(status: string, missingCount: number) {
  if (status === "ai_output_invalid") {
    return "Waiting for reviewer/admin to retry AI analysis.";
  }

  if (missingCount > 0 || status === "needs_info") {
    return "Requester needs to provide missing information.";
  }

  if (status === "in_review") {
    return "Waiting for human review.";
  }

  if (status === "approved" || status === "ready_to_run") {
    return "Approved for controlled backend handoff.";
  }

  return "Waiting for reviewer/admin analysis.";
}

function policyCitationsFrom(output: Record<string, unknown> | null) {
  const citations = output?.policy_citations;

  if (!Array.isArray(citations)) {
    return [];
  }

  return citations.filter((citation): citation is Record<string, unknown> => citation !== null && typeof citation === "object");
}

function agentStepsFrom(output: Record<string, unknown> | null) {
  const steps = output?.agent_steps;

  if (!Array.isArray(steps)) {
    return [];
  }

  return steps.filter((step): step is Record<string, unknown> => step !== null && typeof step === "object");
}

function citationKindLabel(citation: Record<string, unknown>) {
  return citation.source_kind === "governance_standard" ? "Governance standard" : "Workspace policy";
}

function formatLooseStatus(status: string) {
  return status
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function formatMissingInformation(value: string) {
  const normalized = value
    .replace(/_/g, " ")
    .replace(/employeeaccess\s*le(?:vel)?/i, "employee, access level")
    .replace(/accessle(?:vel)?/i, "access level")
    .replace(/managerapproval/i, "manager approval")
    .replace(/businessreason/i, "business reason")
    .replace(/expirationdate/i, "expiration date")
    .trim();

  return normalized || "Missing information";
}

function latestReviewNote(output: Record<string, unknown> | null) {
  const history = output?.review_history;

  if (!Array.isArray(history)) {
    return null;
  }

  const latest = history.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object").at(-1);

  if (!latest) {
    return null;
  }

  return {
    decision: typeof latest.decision === "string" ? latest.decision : "review",
    note: typeof latest.note === "string" && latest.note ? latest.note : null
  };
}

function latestRequesterUpdate(output: Record<string, unknown> | null) {
  const updates = output?.requester_updates;

  if (!Array.isArray(updates)) {
    return null;
  }

  const latest = updates.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object").at(-1);

  if (!latest) {
    return null;
  }

  return typeof latest.update === "string" && latest.update ? latest.update : null;
}

function aiErrorMessage(error?: string) {
  if (error === "missing_openai_key") {
    return "OpenAI API key is missing. Add OPENAI_API_KEY locally and in Vercel, then redeploy.";
  }

  if (error === "openai_billing_required") {
    return "OpenAI billing credits are required for real AI analysis. Other workflow features still work.";
  }

  if (error === "openai_rate_limited") {
    return "OpenAI rate limit reached. Wait briefly before retrying to avoid wasting attempts.";
  }

  if (error === "ai_output_invalid") {
    return "AI analysis failed validation. Retry once after checking the audit trace.";
  }

  return null;
}

export default async function CaseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const persistedCase = isUuid(id) ? await getVisibleCase(id) : null;
  const auditLogs = persistedCase ? await getAuditLogsForCase(persistedCase.id) : [];
  const { profile } = await getCurrentUserContext();
  const canAnalyze = profile?.role === "reviewer" || profile?.role === "admin";
  const canTrash = profile?.role === "admin";
  const canProvideInfo = profile?.user_id === persistedCase?.created_by && persistedCase?.status === "needs_info";
  const workflowTemplates = canAnalyze ? await getVisibleWorkflowTemplates() : [];
  const workflowProposals = canAnalyze ? await getVisibleWorkflowTemplateProposals() : [];
  const connectors = profile?.role === "admin" ? await getVisibleConnectors() : [];
  const workflowRuns = persistedCase && canAnalyze ? await getWorkflowRunsForCase(persistedCase.id) : [];
  const executionAttempts = await getExecutionAttemptsForRuns(workflowRuns.map((run) => run.id));
  const approvedWorkflowTemplates = workflowTemplates.filter((template) => template.lifecycle_status === "approved" || template.lifecycle_status === "active");
  const matchedWorkflow = approvedWorkflowTemplates.find((template) => template.id === persistedCase?.matched_workflow_template_id);
  const recommendedWorkflow = persistedCase ? recommendWorkflowTemplate(persistedCase, approvedWorkflowTemplates) : null;
  const workflowProposal = workflowProposals.find((proposal) => proposal.id === persistedCase?.workflow_template_proposal_id);
  const policyCitations = persistedCase ? policyCitationsFrom(persistedCase.ai_output) : [];
  const agentSteps = persistedCase ? agentStepsFrom(persistedCase.ai_output) : [];
  const reviewNote = persistedCase ? latestReviewNote(persistedCase.ai_output) : null;
  const requesterUpdate = persistedCase ? latestRequesterUpdate(persistedCase.ai_output) : null;

  if (persistedCase) {
    return (
      <AppShell>
        <PageHeader
          title={persistedCase.title}
          subtitle="Persisted case record loaded through Supabase RLS."
          backLink={<Link className="secondary-btn" href="/cases">Back to cases</Link>}
          action={
            <div className="split-actions">
              {canAnalyze ? (
                <>
                  <form action={checkPolicyEvidenceAction}><input type="hidden" name="case_id" value={persistedCase.id} /><SubmitButton className="secondary-btn" pendingText="Checking...">Check policy evidence</SubmitButton></form>
                  <form action={analyzeCaseAction}><input type="hidden" name="case_id" value={persistedCase.id} /><SubmitButton className="primary-btn" pendingText="Analyzing...">{persistedCase.status === "ai_output_invalid" ? "Retry AI analysis" : "Analyze with AI"}</SubmitButton></form>
                </>
              ) : null}
            </div>
          }
        />
        {error === "analysis_forbidden" ? <p className="auth-message error">AI analysis is restricted to reviewer/admin roles.</p> : null}
        {aiErrorMessage(error) ? <p className="auth-message error">{aiErrorMessage(error)}</p> : null}
        {error === "policy_check_failed" ? <p className="auth-message error">Policy evidence check failed. Review the policy source and Supabase logs.</p> : null}
        {error === "review_forbidden" ? <p className="auth-message error">Review decisions are restricted to reviewer/admin roles.</p> : null}
        {error === "review_failed" ? <p className="auth-message error">Review decision could not be saved. Check Supabase logs and try again.</p> : null}
        {error === "invalid_review_decision" ? <p className="auth-message error">Invalid review decision.</p> : null}
        {error === "missing_update" ? <p className="auth-message error">Please add the requested information before submitting.</p> : null}
        {error === "update_forbidden" ? <p className="auth-message error">Only the original requester can add information to this case.</p> : null}
        {error === "update_failed" ? <p className="auth-message error">Additional information could not be saved. Check Supabase logs and try again.</p> : null}
        {error === "workflow_forbidden" ? <p className="auth-message error">Workflow matching is restricted to reviewer/admin roles.</p> : null}
        {error === "missing_workflow_match" ? <p className="auth-message error">Choose an approved workflow before matching this case.</p> : null}
        {error === "workflow_match_failed" ? <p className="auth-message error">Workflow match could not be saved.</p> : null}
        {error === "proposal_failed" ? <p className="auth-message error">Workflow proposal could not be created.</p> : null}
        {error === "workflow_run_forbidden" ? <p className="auth-message error">Workflow runs are restricted to reviewer/admin roles.</p> : null}
        {error === "workflow_run_not_ready" ? <p className="auth-message error">Case must be approved and matched to an approved workflow before a run can be queued.</p> : null}
        {error === "workflow_run_failed" ? <p className="auth-message error">Workflow run could not be queued.</p> : null}
        {error === "workflow_execute_failed" ? <p className="auth-message error">Workflow run could not be executed.</p> : null}
        {error === "workflow_retry_failed" ? <p className="auth-message error">Workflow run could not be retried.</p> : null}
        {error === "workflow_cancel_failed" ? <p className="auth-message error">Workflow run could not be cancelled.</p> : null}
        {error === "trash_forbidden" ? <p className="auth-message error">Only admins can move cases to trash.</p> : null}
        {error === "trash_reason_required" ? <p className="auth-message error">Add a reason before moving this case to trash.</p> : null}
        {error === "trash_failed" ? <p className="auth-message error">Case could not be moved to trash.</p> : null}
        <div className="detail-grid">
          <Panel title="Request" tag={<Tag tone={formatRisk(persistedCase.risk_level)}>{formatRisk(persistedCase.risk_level)}</Tag>}>
            <div className="raw-box">{persistedCase.raw_request}</div>
            <div className="kv">
              <Kv label="Requester" value={persistedCase.requester ?? "Unknown"} />
              <Kv label="Department" value={persistedCase.department ?? "Not provided"} />
              <Kv label="Priority" value={persistedCase.priority ?? "Medium"} />
              <Kv label="Case due" value={persistedCase.due_at ? formatDateTime(persistedCase.due_at) : "Not set"} />
              <Kv label="Access expires" value={persistedCase.access_expires_at ? formatDateTime(persistedCase.access_expires_at) : "Not set"} />
              <Kv label="Created" value={formatDateTime(persistedCase.created_at)} />
            </div>
          </Panel>
          <Panel title="Risk control" tag={<Tag tone={formatCaseStatus(persistedCase.status)}>{formatCaseStatus(persistedCase.status)}</Tag>}>
            <h3>Summary</h3>
            <p className="muted">{persistedCase.summary ?? "AI analysis has not run yet. This case is ready for structured output, policy retrieval, and review routing."}</p>
            <h3>Recommendation</h3>
            <p>{typeof persistedCase.ai_output?.recommendation === "string" ? persistedCase.ai_output.recommendation : "Run AI analysis to generate a governed recommendation."}</p>
            <h3>Matched rules</h3>
            <div className="pill-list">
              {Array.isArray(persistedCase.ai_output?.matched_rules) ? persistedCase.ai_output.matched_rules.map((rule) => <Tag key={String(rule)}>{String(rule)}</Tag>) : <Tag>pending_step_5</Tag>}
            </div>
            {agentSteps.length > 0 ? (
              <>
                <h3>Agent tool steps</h3>
                <div className="action-list compact-list">
                  {agentSteps.map((step) => (
                    <article className="policy-row" key={String(step.tool)}>
                      <div>
                        <h3>{String(step.tool ?? "agent_tool")}</h3>
                        <p>{String(step.summary ?? "Tool step completed.")}</p>
                      </div>
                      <div className="tags"><Tag tone={step.status === "completed" ? "approved" : "review"}>{String(step.status ?? "completed")}</Tag></div>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
            <h3>Policy evidence</h3>
            <div className="pill-list"><Tag tone={persistedCase.policy_evidence_status === "found" ? "approved" : "review"}>{persistedCase.policy_evidence_status}</Tag></div>
            {policyCitations.length > 0 ? (
              <div className="action-list compact-list">
                {policyCitations.map((citation) => (
                  <article className="policy-row" key={String(citation.chunk_id)}>
                    <div>
                      <h3>{String(citation.policy_title ?? "Policy citation")}</h3>
                      <p>{String(citation.excerpt ?? "")}</p>
                      <p><strong>Evidence type:</strong> {citationKindLabel(citation)}</p>
                      {typeof citation.source_url === "string" && citation.source_url ? <p><strong>Source:</strong> {citation.source_url}</p> : null}
                    </div>
                    <div className="tags"><Tag tone="approved">score {String(citation.score ?? 0)}</Tag></div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">No policy citation has been attached yet.</p>
            )}
            <h3>Missing information</h3>
            <div className="pill-list">
              {persistedCase.missing_information.length > 0 ? persistedCase.missing_information.map((info) => <Tag tone="review" key={info}>{formatMissingInformation(info)}</Tag>) : <Tag tone="approved">None recorded</Tag>}
            </div>
            {reviewNote ? (
              <>
                <h3>Latest review note</h3>
                <div className="quote-box">
                  <strong>{reviewNote.decision.replace("_", " ")}</strong>
                  <p>{reviewNote.note ?? "No note was provided."}</p>
                </div>
              </>
            ) : null}
            {requesterUpdate ? (
              <>
                <h3>Latest requester update</h3>
                <div className="quote-box">
                  <p>{requesterUpdate}</p>
                </div>
              </>
            ) : null}
          </Panel>
          {canAnalyze ? (
            <Panel title="Handoff control" tag={<Tag tone={persistedCase.human_review_required ? "review" : "approved"}>{persistedCase.human_review_required ? "Review required" : "No review required"}</Tag>}>
              <h3>Current status</h3>
              <p className="muted">{formatCaseStatus(persistedCase.status)}</p>
              <h3>Review decision</h3>
              <div className="review-actions">
                <form className="review-form" action={reviewCaseAction}>
                  <input type="hidden" name="case_id" value={persistedCase.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <SubmitButton className="primary-btn" pendingText="Approving...">Approve</SubmitButton>
                </form>
                <form className="review-form" action={reviewCaseAction}>
                  <input type="hidden" name="case_id" value={persistedCase.id} />
                  <input type="hidden" name="decision" value="request_info" />
                  <input className="input" name="note" placeholder="What information is missing?" />
                  <SubmitButton className="secondary-btn" pendingText="Saving...">Request info</SubmitButton>
                </form>
                <form className="review-form" action={reviewCaseAction}>
                  <input type="hidden" name="case_id" value={persistedCase.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <input className="input" name="note" placeholder="Reason for rejection" />
                  <SubmitButton className="danger-btn" pendingText="Rejecting...">Reject</SubmitButton>
                </form>
              </div>
              <h3>Workflow match</h3>
              <div className="quote-box">
                {matchedWorkflow ? (
                  <>
                    <strong>{matchedWorkflow.name}</strong>
                    <p>{matchedWorkflow.description ?? "Approved workflow template selected for this case."}</p>
                  </>
                ) : workflowProposal ? (
                  <>
                    <strong>{workflowProposal.name}</strong>
                    <p>Proposal status: {workflowProposal.status}. It cannot execute until admin conversion.</p>
                  </>
                ) : (
                  <p>No approved workflow has been matched yet.</p>
                )}
              </div>
              {recommendedWorkflow && !matchedWorkflow ? (
                <>
                  <h3>Recommended workflow</h3>
                  <div className="quote-box">
                    <strong>{recommendedWorkflow.template.name}</strong>
                    <p>{recommendedWorkflow.template.trigger_condition}</p>
                    <div className="pill-list">
                      <Tag tone="approved">score {recommendedWorkflow.score}</Tag>
                      <Tag>{recommendedWorkflow.template.category}</Tag>
                      <Tag tone={formatRisk(recommendedWorkflow.template.risk_level)}>{formatRisk(recommendedWorkflow.template.risk_level)}</Tag>
                    </div>
                  </div>
                </>
              ) : null}
              <h3>Workflow routing</h3>
              <div className="review-actions">
                <form className="review-form" action={matchWorkflowTemplateAction}>
                  <input type="hidden" name="case_id" value={persistedCase.id} />
                  <select className="input" name="workflow_template_id" defaultValue={matchedWorkflow?.id ?? recommendedWorkflow?.template.id ?? ""}>
                    <option value="">Choose approved workflow</option>
                    {approvedWorkflowTemplates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                  <SubmitButton className="secondary-btn" pendingText="Matching...">Match workflow</SubmitButton>
                </form>
                <form action={createWorkflowProposalAction}>
                  <input type="hidden" name="case_id" value={persistedCase.id} />
                  <SubmitButton className="secondary-btn full-width" pendingText="Creating...">Create no-match proposal</SubmitButton>
                </form>
              </div>
              <h3>Workflow run</h3>
              {matchedWorkflow && persistedCase.status === "approved" ? (
                <form className="review-form" action={createWorkflowRunAction}>
                  <input type="hidden" name="case_id" value={persistedCase.id} />
                  <select className="input" name="connector_id" defaultValue="">
                    <option value="">No connector / mock queue only</option>
                    {connectors.map((connector) => <option key={connector.id} value={connector.id}>{connector.name}</option>)}
                  </select>
                  <SubmitButton className="primary-btn" pendingText="Queueing...">Queue workflow run</SubmitButton>
                </form>
              ) : (
                <p className="muted">A workflow run can be queued only after the case is approved and matched to an approved workflow.</p>
              )}
              {workflowRuns.length > 0 ? (
                <div className="template-list">
                  {workflowRuns.map((run) => (
                    <article className="template-card" key={run.id}>
                      <div className="row-between"><h3>Run {run.id.slice(0, 8)}</h3><Tag tone={formatLooseStatus(run.status)}>{formatLooseStatus(run.status)}</Tag></div>
                      <div className="kv">
                        <Kv label="Idempotency key" value={run.idempotency_key} />
                        <Kv label="Retry" value={`${run.retry_count} / ${run.max_retries}`} />
                        <Kv label="Created" value={formatDateTime(run.created_at)} />
                        <Kv label="Failure reason" value={run.failure_reason ?? "None"} />
                      </div>
                      <div className="split-actions review-actions">
                        {["pending", "queued", "retrying"].includes(run.status) ? (
                          <form action={executeWorkflowRunAction}>
                            <input type="hidden" name="workflow_run_id" value={run.id} />
                            <SubmitButton className="primary-btn" pendingText="Executing...">Execute run</SubmitButton>
                          </form>
                        ) : null}
                        {run.status === "failed" && run.retry_count < run.max_retries ? (
                          <form action={retryWorkflowRunAction}>
                            <input type="hidden" name="workflow_run_id" value={run.id} />
                            <SubmitButton className="secondary-btn" pendingText="Retrying...">Retry run</SubmitButton>
                          </form>
                        ) : null}
                        {["pending", "queued", "running", "failed", "retrying"].includes(run.status) ? (
                          <form className="inline-review-form" action={cancelWorkflowRunAction}>
                            <input type="hidden" name="workflow_run_id" value={run.id} />
                            <input className="mini-input" name="reason" placeholder="Cancel reason" />
                            <SubmitButton className="danger-btn" pendingText="Cancelling...">Cancel run</SubmitButton>
                          </form>
                        ) : null}
                      </div>
                      <h3>Payload preview</h3>
                      <pre className="payload">{JSON.stringify(run.payload, null, 2)}</pre>
                      <h3>Execution attempts</h3>
                      <div className="timeline">
                        {executionAttempts.filter((attempt) => attempt.workflow_run_id === run.id).map((attempt) => (
                          <div className="timeline-item" key={attempt.id}>
                            <div className="dot" />
                            <div>
                              <div className="audit-meta"><code>ATTEMPT_{attempt.attempt_number}</code><span>{formatDateTime(attempt.created_at)}</span></div>
                              <strong>{formatLooseStatus(attempt.status)}</strong>
                              <span>{attempt.error_message ?? (attempt.response_status ? `Response ${attempt.response_status}` : "Pending backend connector execution.")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
              <h3>AI output</h3>
              <pre className="payload">{JSON.stringify(persistedCase.ai_output ?? { status: "pending_step_5" }, null, 2)}</pre>
              <h3>Audit trail</h3>
              <PersistedTimeline events={auditLogs} />
              {canTrash ? (
                <>
                  <h3>Danger zone</h3>
                  <form className="inline-review-form" action={trashCaseAction}>
                    <input type="hidden" name="case_id" value={persistedCase.id} />
                    <input className="mini-input" name="reason" placeholder="Trash reason" required />
                    <SubmitButton className="danger-btn" pendingText="Moving...">Move to trash</SubmitButton>
                  </form>
                </>
              ) : null}
            </Panel>
          ) : (
            <Panel title="Progress" tag={<Tag tone={persistedCase.human_review_required ? "review" : "approved"}>{formatCaseStatus(persistedCase.status)}</Tag>}>
              <div className="kv">
                <Kv label="Current stage" value={formatCaseStatus(persistedCase.status)} />
                <Kv label="Next action" value={nextActionFor(persistedCase.status, persistedCase.missing_information.length)} />
                <Kv label="Review" value={persistedCase.human_review_required ? "Required" : "Not required"} />
              </div>
              {reviewNote ? (
                <>
                  <h3>Latest review note</h3>
                  <div className="quote-box">
                    <strong>{reviewNote.decision.replace("_", " ")}</strong>
                    <p>{reviewNote.note ?? "No note was provided."}</p>
                  </div>
                </>
              ) : null}
              {canProvideInfo ? (
                <>
                  <h3>Provide requested information</h3>
                  <form className="auth-form" action={provideCaseInfoAction}>
                    <input type="hidden" name="case_id" value={persistedCase.id} />
                    <textarea className="textarea compact-textarea" name="update" placeholder="Add the missing information requested by the reviewer." required />
                    <SubmitButton className="primary-btn full-width" pendingText="Submitting...">Submit update</SubmitButton>
                  </form>
                </>
              ) : null}
              <h3>Visible timeline</h3>
              <PersistedTimeline events={auditLogs} />
            </Panel>
          )}
        </div>
      </AppShell>
    );
  }

  const item = getCase(id);
  const template = getTemplate(item.templateId);
  return (
    <AppShell>
      <PageHeader title={item.title} subtitle="AI structure, policy gates, review decisions, handoff payload, and audit trail." backLink={<Link className="secondary-btn" href="/cases">Back to cases</Link>} />
      <div className="detail-grid">
        <Panel title="Request" tag={<Tag tone={item.riskLevel}>{item.riskLevel}</Tag>}><div className="raw-box">{item.raw}</div><div className="kv">{Object.entries(item.extractedFields).map(([label, value]) => <Kv key={label} label={label} value={value} />)}</div></Panel>
        <Panel title="Risk control" tag={<Tag tone="approved">Policy matched</Tag>}><h3>Summary</h3><p className="muted">{item.summary}</p><h3>Recommendation</h3><p>{item.recommendation}</p><h3>Matched rules</h3><div className="pill-list">{item.matchedRules.map((rule) => <Tag key={rule}>{rule}</Tag>)}</div><h3>Missing information</h3><div className="pill-list">{item.missingInfo.map((info) => <Tag tone="review" key={info}>{info}</Tag>)}</div><div className="quote-box"><strong>{template.name}</strong><br />Reviewer: {template.reviewer}<br />Target: {template.handoffTarget}</div></Panel>
        <Panel title="Handoff control" tag={<Tag tone={item.handoffStatus}>{item.handoffStatus}</Tag>}><ActionList caseId={item.id} /><h3>Payload preview</h3><pre className="payload">{JSON.stringify(item.handoffPayload, null, 2)}</pre><h3>Audit trail</h3><Timeline /></Panel>
      </div>
    </AppShell>
  );
}
