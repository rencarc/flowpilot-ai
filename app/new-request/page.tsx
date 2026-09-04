import Link from "next/link";
import { AppShell, Kv, PageHeader, Panel, Tag } from "@/components/ui";
import { createCaseAction } from "@/app/actions";
import { cases, getTemplate } from "@/lib/mock-data";

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const preview = cases[0];
  const errorMessage = error === "missing_request" ? "Raw request is required." : error === "create_failed" ? "Could not create the case. Check your Supabase profile/workspace and RLS policies." : null;
  return (
    <AppShell>
      <PageHeader title="New request" subtitle="Create a persisted Supabase case for governed AI analysis, policy retrieval, and human review." action={<Link className="secondary-btn" href="/cases">Back to cases</Link>} />
      <div className="create-layout">
        <Panel title="Raw request" tag={<Tag tone="pending">Persisted case</Tag>}>
          <form className="auth-form" action={createCaseAction}>
            <label><span>Title</span><input className="input" name="title" defaultValue="Payroll admin access request" required /></label>
            <label><span>Department</span><input className="input" name="department" defaultValue="HR" /></label>
            <label><span>Priority</span><input className="input" name="priority" defaultValue="High" /></label>
            <label><span>Raw request</span><textarea className="textarea" name="raw_request" defaultValue={preview.raw} required /></label>
            <div className="split-actions"><button className="primary-btn" type="submit">Create case</button><Link className="secondary-btn" href="/cases">Cancel</Link></div>
            {errorMessage ? <p className="auth-message error">{errorMessage}</p> : null}
          </form>
        </Panel>
        <Panel title="Demo scenarios">{cases.map((item) => <Link className="example-btn" href={`/cases/${item.id}`} key={item.id}><strong>{item.caseType}</strong><span>{item.raw}</span></Link>)}</Panel>
      </div>
      <Panel title="AI structure preview" tag={<Tag tone={preview.riskLevel}>{preview.riskLevel}</Tag>}><div className="structure-grid"><div className="kv"><Kv label="Case type" value={preview.caseType} /><Kv label="Priority" value={preview.priority} /><Kv label="Suggested workflow" value={getTemplate(preview.templateId).name} /><Kv label="Review required" value="Yes" /></div><div className="pill-list">{preview.missingInfo.map((info) => <Tag tone="review" key={info}>{info}</Tag>)}</div><ol className="clean-list"><li>Request manager approval evidence</li><li>Confirm least-privilege role</li><li>Prepare approved backend handoff only after review</li></ol></div></Panel>
    </AppShell>
  );
}
