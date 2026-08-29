import { AppShell, PageHeader, Panel, Tag } from "@/components/ui";
import { policies } from "@/lib/mock-data";

export default function KnowledgePage() {
  return <AppShell><PageHeader title="Knowledge" subtitle="Policy rules that ground risk checks today and become pgvector RAG citations later." /><Panel title="Policy sources" tag={<Tag tone="pending">RAG ready</Tag>}>{policies.map((policy) => <article className="policy-row" key={policy.title}><div><h3>{policy.title}</h3><p><strong>Trigger:</strong> {policy.trigger}</p><p><strong>Requirement:</strong> {policy.requirement}</p></div><div className="tags"><Tag>{policy.usedBy}</Tag><Tag tone="approved">{policy.citations} citations</Tag></div></article>)}</Panel></AppShell>;
}
