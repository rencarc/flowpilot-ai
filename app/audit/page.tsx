import { AppShell, PageHeader, Tag } from "@/components/ui";
import { formatDateTime, getVisibleAuditLogs } from "@/lib/cases";

export default async function AuditPage() {
  const auditEvents = await getVisibleAuditLogs(30);
  return (
    <AppShell>
      <PageHeader title="Audit logs" subtitle="Persisted audit records for case creation, AI decisions, review actions, and workflow handoff events." />
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
