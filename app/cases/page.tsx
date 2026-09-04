import Link from "next/link";
import { AppShell, PageHeader, PersistedCaseTable } from "@/components/ui";
import { getCurrentUserContext, getVisibleCases } from "@/lib/cases";

function errorText(error?: string) {
  if (error === "archive_forbidden") {
    return "Only admins can archive cases.";
  }

  if (error === "archive_failed") {
    return "Case could not be archived.";
  }

  return null;
}

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { profile } = await getCurrentUserContext();
  const items = await getVisibleCases();
  const canArchive = profile?.role === "admin";

  return <AppShell><PageHeader title="Cases" subtitle="Persisted Supabase cases filtered by workspace RLS." action={<Link className="primary-btn" href="/new-request">+ New request</Link>} />{errorText(error) ? <p className="auth-message error">{errorText(error)}</p> : null}<div className="tabs"><button className="tab active">All</button><button className="tab">High risk</button><button className="tab">Needs info</button><button className="tab">Handoff ready</button></div><section className="panel"><PersistedCaseTable canArchive={canArchive} items={items} /></section></AppShell>;
}
