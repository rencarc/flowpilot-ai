import Link from "next/link";
import { analyzeCaseAction } from "@/app/actions";
import { ActionList, AppShell, Kv, PageHeader, Panel, PersistedTimeline, Tag, Timeline } from "@/components/ui";
import { formatCaseStatus, formatDateTime, formatRisk, getAuditLogsForCase, getCurrentUserContext, getVisibleCase } from "@/lib/cases";
import { getCase, getTemplate } from "@/lib/mock-data";

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

export default async function CaseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const persistedCase = isUuid(id) ? await getVisibleCase(id) : null;
  const auditLogs = persistedCase ? await getAuditLogsForCase(persistedCase.id) : [];
  const { profile } = await getCurrentUserContext();
  const canAnalyze = profile?.role === "reviewer" || profile?.role === "admin";

  if (persistedCase) {
    return (
      <AppShell>
        <PageHeader title={persistedCase.title} subtitle="Persisted case record loaded through Supabase RLS." action={<div className="split-actions">{canAnalyze ? <form action={analyzeCaseAction}><input type="hidden" name="case_id" value={persistedCase.id} /><button className="primary-btn" type="submit">{persistedCase.status === "ai_output_invalid" ? "Retry AI analysis" : "Analyze with AI"}</button></form> : null}<Link className="secondary-btn" href="/cases">Back to cases</Link></div>} />
        {error === "analysis_forbidden" ? <p className="auth-message error">AI analysis is restricted to reviewer/admin roles.</p> : null}
        <div className="detail-grid">
          <Panel title="Request" tag={<Tag tone={formatRisk(persistedCase.risk_level)}>{formatRisk(persistedCase.risk_level)}</Tag>}>
            <div className="raw-box">{persistedCase.raw_request}</div>
            <div className="kv">
              <Kv label="Requester" value={persistedCase.requester ?? "Unknown"} />
              <Kv label="Department" value={persistedCase.department ?? "Not provided"} />
              <Kv label="Priority" value={persistedCase.priority ?? "Medium"} />
              <Kv label="Created" value={formatDateTime(persistedCase.created_at)} />
            </div>
          </Panel>
          <Panel title="Risk control" tag={<Tag tone={formatCaseStatus(persistedCase.status)}>{formatCaseStatus(persistedCase.status)}</Tag>}>
            <h3>Summary</h3>
            <p className="muted">{persistedCase.summary ?? "AI analysis has not run yet. This case is persisted and ready for Step 5 structured output."}</p>
            <h3>Recommendation</h3>
            <p>{typeof persistedCase.ai_output?.recommendation === "string" ? persistedCase.ai_output.recommendation : "Run AI analysis to generate a governed recommendation."}</p>
            <h3>Matched rules</h3>
            <div className="pill-list">
              {Array.isArray(persistedCase.ai_output?.matched_rules) ? persistedCase.ai_output.matched_rules.map((rule) => <Tag key={String(rule)}>{String(rule)}</Tag>) : <Tag>pending_step_5</Tag>}
            </div>
            <h3>Policy evidence</h3>
            <div className="pill-list"><Tag>{persistedCase.policy_evidence_status}</Tag></div>
            <h3>Missing information</h3>
            <div className="pill-list">
              {persistedCase.missing_information.length > 0 ? persistedCase.missing_information.map((info) => <Tag tone="review" key={info}>{info}</Tag>) : <Tag tone="approved">None recorded</Tag>}
            </div>
          </Panel>
          {canAnalyze ? (
            <Panel title="Handoff control" tag={<Tag tone={persistedCase.human_review_required ? "review" : "approved"}>{persistedCase.human_review_required ? "Review required" : "No review required"}</Tag>}>
              <h3>Current status</h3>
              <p className="muted">{formatCaseStatus(persistedCase.status)}</p>
              <h3>AI output</h3>
              <pre className="payload">{JSON.stringify(persistedCase.ai_output ?? { status: "pending_step_5" }, null, 2)}</pre>
              <h3>Audit trail</h3>
              <PersistedTimeline events={auditLogs} />
            </Panel>
          ) : (
            <Panel title="Progress" tag={<Tag tone={persistedCase.human_review_required ? "review" : "approved"}>{formatCaseStatus(persistedCase.status)}</Tag>}>
              <div className="kv">
                <Kv label="Current stage" value={formatCaseStatus(persistedCase.status)} />
                <Kv label="Next action" value={nextActionFor(persistedCase.status, persistedCase.missing_information.length)} />
                <Kv label="Review" value={persistedCase.human_review_required ? "Required" : "Not required"} />
              </div>
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
      <PageHeader title={item.title} subtitle="AI structure, policy gates, review decisions, handoff payload, and audit trail." action={<Link className="secondary-btn" href="/cases">Back to cases</Link>} />
      <div className="detail-grid">
        <Panel title="Request" tag={<Tag tone={item.riskLevel}>{item.riskLevel}</Tag>}><div className="raw-box">{item.raw}</div><div className="kv">{Object.entries(item.extractedFields).map(([label, value]) => <Kv key={label} label={label} value={value} />)}</div></Panel>
        <Panel title="Risk control" tag={<Tag tone="approved">Policy matched</Tag>}><h3>Summary</h3><p className="muted">{item.summary}</p><h3>Recommendation</h3><p>{item.recommendation}</p><h3>Matched rules</h3><div className="pill-list">{item.matchedRules.map((rule) => <Tag key={rule}>{rule}</Tag>)}</div><h3>Missing information</h3><div className="pill-list">{item.missingInfo.map((info) => <Tag tone="review" key={info}>{info}</Tag>)}</div><div className="quote-box"><strong>{template.name}</strong><br />Reviewer: {template.reviewer}<br />Target: {template.handoffTarget}</div></Panel>
        <Panel title="Handoff control" tag={<Tag tone={item.handoffStatus}>{item.handoffStatus}</Tag>}><ActionList caseId={item.id} /><h3>Payload preview</h3><pre className="payload">{JSON.stringify(item.handoffPayload, null, 2)}</pre><h3>Audit trail</h3><Timeline /></Panel>
      </div>
    </AppShell>
  );
}
