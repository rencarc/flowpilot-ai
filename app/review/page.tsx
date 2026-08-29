import { AppShell, PageHeader, Panel, ReviewCaseList, Tag } from "@/components/ui";
import { getReviewCases, getVisibleCases } from "@/lib/cases";

export default async function ReviewPage() {
  const reviewCases = getReviewCases(await getVisibleCases());
  return <AppShell><PageHeader title="Review queue" subtitle="Persisted cases that require human judgment before handoff." /><Panel title="Human review required" tag={<Tag tone="review">{reviewCases.length} cases</Tag>}><ReviewCaseList items={reviewCases} /></Panel></AppShell>;
}
