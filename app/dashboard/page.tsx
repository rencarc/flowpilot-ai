import Link from "next/link";
import { AppShell, PageHeader, Panel, PersistedCaseTable, PersistedTimeline, ReviewCaseList, Tag } from "@/components/ui";
import { getReviewCases, getVisibleAuditLogs, getVisibleCases } from "@/lib/cases";

export default async function DashboardPage() {
  const [persistedCases, auditLogs] = await Promise.all([getVisibleCases(), getVisibleAuditLogs(5)]);
  const reviewCases = getReviewCases(persistedCases);
  const review = reviewCases.length;
  const missingInfo = persistedCases.filter((item) => item.status === "needs_info" || item.missing_information.length > 0).length;
  const handoffReady = persistedCases.filter((item) => item.status === "ready_to_run" || item.status === "approved").length;
  const highRisk = persistedCases.filter((item) => item.risk_level === "high").length;
  const before = ["Email/chat intake", "Missing fields found late", "Manual triage", "Inconsistent risk calls", "No audit trail"];
  const after = ["Structured case", "Missing info detected upfront", "Policy evidence attached", "Reviewer queue", "Tracked execution"];
  return (
    <AppShell>
      <PageHeader title="Workflow health" subtitle="Track how messy requests become structured, governed, and ready for safe handoff." action={<Link className="primary-btn" href="/new-request">+ New request</Link>} />
      <div className="metric-strip">
        {[["Total cases", persistedCases.length, "Persisted Supabase records"], ["Review required", review, "Human decision needed"], ["Missing info", missingInfo, "Blocked before handoff"], ["Handoff ready", handoffReady, "Approved payloads"], ["High risk", highRisk, "Policy gated"]].map(([label, value, note]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}
      </div>
      <div className="monitor-grid">
        <Panel title="Before / After operating model" tag={<Tag tone="approved">Policy gated</Tag>}>
          <div className="compare-table product-compare">
            <div><strong>Before FlowPilot</strong>{before.map((item) => <span key={item}>{item}</span>)}</div>
            <div><strong>After FlowPilot</strong>{after.map((item) => <span key={item}>{item}</span>)}</div>
          </div>
        </Panel>
        <Panel title="Recent audit"><PersistedTimeline events={auditLogs} /></Panel>
      </div>
      <div className="grid-2"><Panel title="Recent cases"><PersistedCaseTable items={persistedCases.slice(0, 3)} /></Panel><Panel title="Review queue" tag={<Tag tone="review">{review} items</Tag>}><ReviewCaseList items={reviewCases.slice(0, 5)} /></Panel></div>
    </AppShell>
  );
}
