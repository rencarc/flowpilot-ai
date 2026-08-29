import Link from "next/link";
import { AppShell, PageHeader, PersistedCaseTable } from "@/components/ui";
import { getVisibleCases } from "@/lib/cases";

export default async function CasesPage() {
  const items = await getVisibleCases();
  return <AppShell><PageHeader title="Cases" subtitle="Persisted Supabase cases filtered by workspace RLS." action={<Link className="primary-btn" href="/new-request">+ New request</Link>} /><div className="tabs"><button className="tab active">All</button><button className="tab">High risk</button><button className="tab">Needs info</button><button className="tab">Handoff ready</button></div><section className="panel"><PersistedCaseTable items={items} /></section></AppShell>;
}
