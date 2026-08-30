import { AppShell, PageHeader, Panel, ReviewCaseList, Tag } from "@/components/ui";
import { getCurrentUserContext, getReviewCases, getVisibleCases } from "@/lib/cases";

export default async function ReviewPage() {
  const { profile } = await getCurrentUserContext();
  const canReview = profile?.role === "reviewer" || profile?.role === "admin";
  const reviewCases = getReviewCases(await getVisibleCases());

  return (
    <AppShell>
      <PageHeader title="Review queue" subtitle="Persisted cases that require human judgment before handoff." />
      {canReview ? (
        <Panel title="Human review required" tag={<Tag tone="review">{reviewCases.length} cases</Tag>}><ReviewCaseList items={reviewCases} /></Panel>
      ) : (
        <Panel title="Requester view" tag={<Tag tone="pending">Read only</Tag>}>
          <p className="muted">Requesters do not make review decisions. They can follow the progress of their own cases from the Cases page.</p>
        </Panel>
      )}
    </AppShell>
  );
}
