import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { archiveCaseAction, reviewCaseAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { actions, auditEvents, cases, getTemplate } from "@/lib/mock-data";
import { SidebarNav } from "@/components/sidebar-nav";
import { formatCaseStatus, formatDateTime, formatRisk, type AuditLogRecord } from "@/lib/cases";
import type { CaseRecord } from "@/lib/supabase/types";

export function Logo() {
  return (
    <div className="brand-row">
      <Image className="logo-mark" src="/flowpilot-logo.png" alt="" width={42} height={42} priority />
      <span>FlowPilot AI</span>
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`tag ${tone.toLowerCase().replace(/\s+/g, "-")}`}>{children}</span>;
}

function initials(name?: string | null, email?: string | null) {
  const source = name || email || "FlowPilot User";
  return source
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function workspaceDisplayName(workspaces: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(workspaces)) {
    return workspaces[0]?.name;
  }

  return workspaces?.name;
}

export async function AppShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("full_name, role, workspace_id, workspaces(name)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()
    : { data: null };
  const workspaceName = workspaceDisplayName(profile?.workspaces) ?? "FlowPilot workspace";
  const displayName = profile?.full_name ?? user?.email ?? "Guest";
  const role = profile?.role ?? "demo";
  const links: Array<[string, string]> = [
    ["/dashboard", "Overview"],
    ["/cases", "Cases"],
    ["/review", "Review Queue"],
    ["/workflows", "Workflows"],
    ["/knowledge", "Knowledge"],
    ["/audit", "Audit Logs"],
    ["/settings", "Settings"],
    ["/architecture", "Architecture"]
  ];

  return (
    <section className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="no-underline"><Logo /></Link>
        <Link className="new-case" href="/new-request">+ New request</Link>
        <div className="nav-group-label">Workspace</div>
        <SidebarNav links={links} />
        <div className="workspace-card">
          <strong>{workspaceName}</strong>
          <span>{user ? `${displayName} / ${role}` : "Demo mode / not signed in"}</span>
          <div className="mini-progress"><i /></div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="crumb">Private / FlowPilot workspace</div>
          <input className="input search" placeholder="Search cases, policies, workflows..." />
          <div className="user-chip">
            {user ? <span>{user.email}</span> : <Link href="/login">Sign in</Link>}
            {user ? <form action="/auth/sign-out" method="post"><button type="submit">Sign out</button></form> : null}
            <div className="avatar">{initials(profile?.full_name, user?.email) || "FP"}</div>
          </div>
        </header>
        <section className="content">{children}</section>
      </main>
    </section>
  );
}

export function PageHeader({ title, subtitle, action, backLink }: { title: string; subtitle: string; action?: ReactNode; backLink?: ReactNode }) {
  return (
    <div className="page-header-stack">
      {backLink ? <div className="page-back">{backLink}</div> : null}
      <div className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
    </div>
  );
}

export function Panel({ title, tag, children }: { title: string; tag?: ReactNode; children: ReactNode }) {
  return <section className="panel"><div className="panel-header"><h2>{title}</h2>{tag}</div><div className="panel-body">{children}</div></section>;
}

export function Kv({ label, value }: { label: string; value: ReactNode }) {
  return <div className="kv-item"><span>{label}</span><strong>{value}</strong></div>;
}

export function CaseTable({ items = cases }) {
  return (
    <div className="table">
      <div className="table-row table-head"><span>Case</span><span>Risk</span><span>Template</span><span>Status</span><span>Handoff</span><span>Detail</span></div>
      {items.map((item) => (
        <Link className="table-row" href={`/cases/${item.id}`} key={item.id}>
          <span><strong>{item.title}</strong><small>{item.caseType}</small></span>
          <span><Tag tone={item.riskLevel}>{item.riskLevel}</Tag></span>
          <span>{getTemplate(item.templateId).name}</span>
          <span><Tag tone={item.status}>{item.status}</Tag></span>
          <span><Tag tone={item.handoffStatus}>{item.handoffStatus}</Tag></span>
          <span className="detail-link">View detail</span>
        </Link>
      ))}
    </div>
  );
}

export function PersistedCaseTable({ items, canArchive = false }: { items: CaseRecord[]; canArchive?: boolean }) {
  if (items.length === 0) {
    return <div className="panel-body"><p className="muted">No persisted cases yet. Create a new request to test Supabase persistence and RLS.</p></div>;
  }

  return (
    <div className="table">
      <div className="table-row table-head"><span>Case</span><span>Risk</span><span>Category</span><span>Status</span><span>Due / Created</span><span>Detail</span></div>
      {items.map((item) => (
        <div className="table-row" key={item.id}>
          <span><strong>{item.title}</strong><small>{item.department ?? "No department"} / {item.requester ?? "Unknown requester"}</small></span>
          <span><Tag tone={formatRisk(item.risk_level)}>{formatRisk(item.risk_level)}</Tag></span>
          <span>{item.category ?? "General intake"}</span>
          <span><Tag tone={formatCaseStatus(item.status)}>{formatCaseStatus(item.status)}</Tag></span>
          <span>
            {item.due_at ? formatDateTime(item.due_at) : "No due date"}
            <small>Created {formatDateTime(item.created_at)}</small>
          </span>
          <span className="case-actions">
            <Link className="detail-link" href={`/cases/${item.id}`}>View detail</Link>
            {canArchive && item.status !== "closed" ? (
              <form action={archiveCaseAction}>
                <input type="hidden" name="case_id" value={item.id} />
                <button className="small-btn danger" type="submit">Archive</button>
              </form>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ActionList({ caseId }: { caseId?: string }) {
  const scoped = caseId ? actions.filter((action) => action.caseId === caseId) : actions;
  return <div className="action-list">{scoped.map((action) => <article className="action-row" key={action.id}><div><h3>{action.title}</h3><p>Owner: {action.owner}</p></div><div className="tags"><Tag tone={action.risk}>{action.risk}</Tag><Tag tone={action.status}>{action.status}</Tag></div></article>)}</div>;
}

export function ReviewCaseList({ items }: { items: CaseRecord[] }) {
  if (items.length === 0) {
    return <p className="muted">No persisted cases currently require review.</p>;
  }

  return (
    <div className="action-list">
      {items.map((item) => (
        <article className="action-row" key={item.id}>
          <div>
            <h3><Link className="text-link" href={`/cases/${item.id}`}>{item.title}</Link></h3>
            <p>{item.department ?? "No department"} / {item.policy_evidence_status}</p>
          </div>
          <div className="tags">
            <Tag tone={formatRisk(item.risk_level)}>{formatRisk(item.risk_level)}</Tag>
            <Tag tone={formatCaseStatus(item.status)}>{formatCaseStatus(item.status)}</Tag>
            <form action={reviewCaseAction}>
              <input type="hidden" name="case_id" value={item.id} />
              <input type="hidden" name="decision" value="approve" />
              <button className="small-btn" type="submit">Approve</button>
            </form>
            <form className="inline-review-form" action={reviewCaseAction}>
              <input type="hidden" name="case_id" value={item.id} />
              <input type="hidden" name="decision" value="request_info" />
              <input className="mini-input" name="note" placeholder="Missing info" />
              <button className="small-btn" type="submit">Need info</button>
            </form>
            <form className="inline-review-form" action={reviewCaseAction}>
              <input type="hidden" name="case_id" value={item.id} />
              <input type="hidden" name="decision" value="reject" />
              <input className="mini-input" name="note" placeholder="Reject reason" />
              <button className="small-btn danger" type="submit">Reject</button>
            </form>
          </div>
        </article>
      ))}
    </div>
  );
}

export function Timeline() {
  return (
    <div className="timeline">
      {auditEvents.map((event) => (
        <div className="timeline-item" key={`${event.type}-${event.time}`}>
          <div className="dot" />
          <div>
            <div className="audit-meta"><code>{event.type}</code><span>{event.time}</span></div>
            <strong>{event.summary}</strong>
            <span>{event.actor}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PersistedTimeline({ events }: { events: AuditLogRecord[] }) {
  if (events.length === 0) {
    return <p className="muted">No persisted audit events yet.</p>;
  }

  return (
    <div className="timeline">
      {events.map((event) => (
        <div className="timeline-item" key={event.id}>
          <div className="dot" />
          <div>
            <div className="audit-meta"><code>{event.event_type}</code><span>{formatDateTime(event.created_at)}</span></div>
            <strong>{event.event_summary}</strong>
            <span>{event.actor_type}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
