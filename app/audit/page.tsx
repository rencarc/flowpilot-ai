import { AppShell, Kv, PageHeader, Panel, Tag } from "@/components/ui";
import { formatDateTime, getCurrentUserContext, getVisibleAuditLogs } from "@/lib/cases";
import { getLangfuseConfigStatus, getObservabilitySummary, getVisibleAiTraces } from "@/lib/observability";

export default async function AuditPage() {
  const { profile } = await getCurrentUserContext();
  const auditEvents = await getVisibleAuditLogs(30);
  const summary = await getObservabilitySummary(auditEvents);
  const aiTraces = await getVisibleAiTraces(12);
  const canSeeAiTraces = profile?.role === "admin";
  const langfuse = getLangfuseConfigStatus();

  return (
    <AppShell>
      <PageHeader title="Audit logs" subtitle="Persisted audit records, trace summaries, and local RAG evaluation signals." />
      <div className="metric-strip">
        <div className="metric"><span>Cases</span><strong>{summary.totalCases}</strong><small>Visible through RLS</small></div>
        <div className="metric"><span>Citation coverage</span><strong>{summary.citationCoverage}%</strong><small>{summary.casesWithCitations} cases with citations</small></div>
        <div className="metric"><span>Policy evidence</span><strong>{summary.casesWithPolicyEvidence}</strong><small>Cases with found evidence</small></div>
        <div className="metric"><span>Workflow events</span><strong>{summary.workflowEvents}</strong><small>Queue, execute, retry, cancel</small></div>
        <div className="metric"><span>Failure signals</span><strong>{summary.failedEvents}</strong><small>Failed or invalid events</small></div>
      </div>
      <div className="grid-2">
        <Panel title="RAG evaluation" tag={<Tag tone={summary.citationCoverage > 0 ? "approved" : "pending"}>local</Tag>}>
          <div className="kv">
            <Kv label="Current retrieval mode" value="keyword_dev" />
            <Kv label="Cases with citations" value={`${summary.casesWithCitations} / ${summary.totalCases}`} />
            <Kv label="Review decisions observed" value={summary.reviewEvents} />
            <Kv label="Next eval upgrade" value="Compare pgvector citations after OpenAI credits are available" />
          </div>
        </Panel>
        <Panel title="External tracing" tag={<Tag tone={langfuse.enabled ? "approved" : "pending"}>{langfuse.status}</Tag>}>
          <div className="kv">
            <Kv label="Provider" value="Langfuse" />
            <Kv label="Host" value={langfuse.host} />
            <Kv label="Mode" value={langfuse.enabled ? "Ready for SDK trace export" : "Local audit only"} />
            <Kv label="Missing env" value={langfuse.missing.length > 0 ? langfuse.missing.join(", ") : "None"} />
          </div>
        </Panel>
        <Panel title="AI traces" tag={<Tag tone={canSeeAiTraces ? "approved" : "pending"}>{canSeeAiTraces ? `${aiTraces.length} traces` : "Admin only"}</Tag>}>
          {canSeeAiTraces ? (
            <div className="timeline">
              {aiTraces.length === 0 ? <p className="muted">No AI trace records yet.</p> : null}
              {aiTraces.map((trace) => (
                <div className="timeline-item" key={trace.id}>
                  <div className="dot" />
                  <div>
                    <div className="audit-meta"><code>{trace.prompt_version}</code><span>{formatDateTime(trace.created_at)}</span></div>
                    <strong>{trace.model} / {trace.output_valid ? "valid" : "invalid"}</strong>
                    <span>{trace.case_id ? `Case ${trace.case_id.slice(0, 8)}` : "Workspace trace"} / {trace.latency_ms ?? 0}ms</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">AI trace summaries are restricted to admins. Requesters and reviewers rely on case audit logs and visible citations.</p>
          )}
        </Panel>
      </div>
      <section className="panel">
        <div className="table audit-table">
          <div className="table-row table-head"><span>Event</span><span>Actor</span><span>Case</span><span>Type</span><span>Time</span><span>Trace</span></div>
          {auditEvents.length === 0 ? <div className="panel-body"><p className="muted">No persisted audit logs yet.</p></div> : null}
          {auditEvents.map((event) => (
            <div className="table-row" key={event.id}>
              <span><strong>{event.event_summary}</strong><small>Recorded in workspace audit trail</small></span>
              <span>{event.actor_type}</span>
              <span>{event.case_id ? event.case_id.slice(0, 8) : "Workspace"}</span>
              <span><Tag>{event.event_type}</Tag></span>
              <span>{formatDateTime(event.created_at)}</span>
              <span className="detail-link">View event</span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
