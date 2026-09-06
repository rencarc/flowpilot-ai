import Link from "next/link";
import { AppShell, Kv, PageHeader, Panel, Tag } from "@/components/ui";
import { NewRequestForm } from "@/components/new-request-form";
import { cases, getTemplate } from "@/lib/mock-data";

function toStockholmDatetimeLocalValue(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

function defaultDatetimeLocalValue(hoursFromNow: number) {
  return toStockholmDatetimeLocalValue(new Date(Date.now() + hoursFromNow * 60 * 60 * 1000));
}

const requestSuggestions = [
  {
    title: "Payroll admin access request",
    department: "HR",
    priority: "High",
    details: "Emma needs temporary admin access to the payroll system before Friday because payroll close is delayed. Manager approval has not been attached yet."
  },
  {
    title: "Vendor bank details change request",
    department: "Finance",
    priority: "High",
    details: "Please update the bank account details for vendor Nordic Office Supplies before today payment run. The vendor sent the new IBAN by email, and Finance needs the change approved urgently so the invoice can be paid on time."
  },
  {
    title: "Contract renewal approval request",
    department: "Legal",
    priority: "Medium",
    details: "The sales team needs approval to renew the Acme Analytics contract for another 12 months. The renewal includes a data processing addendum and a price increase that needs legal and finance review."
  }
];

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const preview = cases[0];
  const dueAtDefault = defaultDatetimeLocalValue(2);
  const errorMessage = error === "missing_request" ? "Raw request is required." : error === "create_failed" ? "Could not create the case. Check your Supabase profile/workspace and RLS policies." : null;
  return (
    <AppShell>
      <PageHeader title="New request" subtitle="Create a persisted Supabase case for governed AI analysis, policy retrieval, and human review." backLink={<Link className="secondary-btn" href="/cases">Back to cases</Link>} />
      <Panel title="Submit request" tag={<Tag tone="pending">Persisted case</Tag>}>
        <NewRequestForm defaultDueAt={dueAtDefault} suggestions={requestSuggestions} />
        {errorMessage ? <p className="auth-message error">{errorMessage}</p> : null}
      </Panel>
      <Panel title="AI structure preview" tag={<Tag tone={preview.riskLevel}>{preview.riskLevel}</Tag>}><div className="structure-grid"><div className="kv"><Kv label="Case type" value={preview.caseType} /><Kv label="Priority" value={preview.priority} /><Kv label="Suggested workflow" value={getTemplate(preview.templateId).name} /><Kv label="Review required" value="Yes" /></div><div className="pill-list">{preview.missingInfo.map((info) => <Tag tone="review" key={info}>{info}</Tag>)}</div><ol className="clean-list"><li>Request manager approval evidence</li><li>Confirm least-privilege role</li><li>Prepare approved backend handoff only after review</li></ol></div></Panel>
    </AppShell>
  );
}
