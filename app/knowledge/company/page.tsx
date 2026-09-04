import Link from "next/link";
import { archivePolicyAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { AppShell, PageHeader, Panel, Tag } from "@/components/ui";
import { formatDateTime, getCurrentUserContext } from "@/lib/cases";
import { getVisiblePolicies, getVisiblePolicyChunks, isWorkspaceAuthoredPolicy, type PolicyChunkRecord, type PolicyRecord } from "@/lib/policies";

type CompanyPolicyView = {
  id: string;
  title: string;
  description: string | null;
  sourceType: string;
  sourceUrl: string | null;
  createdAt: string;
  chunks: Array<{ id: string; heading: string; content: string }>;
};

function errorText(error?: string) {
  if (error === "policy_archive_forbidden") {
    return "Only admins can archive workspace policies.";
  }

  if (error === "policy_archive_failed") {
    return "Policy could not be archived.";
  }

  return null;
}

function headingFromText(content: string, fallback: string) {
  const firstLine = content.split("\n").find(Boolean);
  return firstLine && firstLine.length < 80 ? firstLine : fallback;
}

function chunkHeading(chunk: PolicyChunkRecord) {
  return headingFromText(chunk.content, `Section ${chunk.chunk_index + 1}`);
}

function companyPolicyView(policy: PolicyRecord, chunks: PolicyChunkRecord[]): CompanyPolicyView {
  const policyChunks = chunks.filter((chunk) => chunk.policy_id === policy.id).sort((a, b) => a.chunk_index - b.chunk_index);

  return {
    id: policy.id,
    title: policy.title,
    description: policy.description,
    sourceType: policy.source_type,
    sourceUrl: policy.source_url,
    createdAt: policy.created_at,
    chunks: policyChunks.map((chunk) => ({
      id: chunk.id,
      heading: chunkHeading(chunk),
      content: chunk.content
    }))
  };
}

export default async function CompanyPoliciesPage({ searchParams }: { searchParams: Promise<{ error?: string; policy?: string }> }) {
  const { error, policy: selectedId } = await searchParams;
  const { profile } = await getCurrentUserContext();
  const canReadPolicyLibrary = profile?.role === "reviewer" || profile?.role === "admin";
  const canManagePolicies = profile?.role === "admin";
  const policies = canReadPolicyLibrary ? (await getVisiblePolicies()).filter(isWorkspaceAuthoredPolicy) : [];
  const chunks = canReadPolicyLibrary ? await getVisiblePolicyChunks() : [];
  const companyPolicies = policies.map((policy) => companyPolicyView(policy, chunks));
  const selectedPolicy = companyPolicies.find((policy) => policy.id === selectedId) ?? companyPolicies[0];
  const message = errorText(error);

  return (
    <AppShell>
      <PageHeader title="Workspace policies" subtitle="Company-specific policies added by admins to supplement the baseline governance standards." backLink={<Link className="secondary-btn" href="/knowledge">Back to Knowledge</Link>} />
      {message ? <p className="auth-message error">{message}</p> : null}
      {canReadPolicyLibrary ? (
        <div className="policy-library-layout">
          <Panel title="Company-specific policies" tag={<Tag tone={companyPolicies.length > 0 ? "approved" : "pending"}>{companyPolicies.length} total</Tag>}>
            {companyPolicies.length === 0 ? <p className="muted">No company-specific workspace policies have been added yet.</p> : null}
            <div className="policy-nav-list">
              {companyPolicies.map((policy) => (
                <Link className={`policy-nav-item${selectedPolicy?.id === policy.id ? " active" : ""}`} href={`/knowledge/company?policy=${policy.id}`} key={policy.id}>
                  <strong>{policy.title}</strong>
                  <span>{policy.description ?? "No description provided."}</span>
                  <small>{formatDateTime(policy.createdAt)} / {policy.chunks.length} chunks</small>
                </Link>
              ))}
            </div>
          </Panel>
          <Panel title="Policy detail" tag={<Tag tone={selectedPolicy ? "approved" : "review"}>{selectedPolicy ? "Workspace policy" : "No policy"}</Tag>}>
            {selectedPolicy ? (
              <div className="policy-detail">
                <div className="policy-detail-head">
                  <div>
                    <h3>{selectedPolicy.title}</h3>
                    <p className="muted">{selectedPolicy.description ?? "No description provided."}</p>
                  </div>
                  {canManagePolicies ? (
                    <form action={archivePolicyAction}>
                      <input type="hidden" name="policy_id" value={selectedPolicy.id} />
                      <SubmitButton className="danger-btn" pendingText="Archiving...">Archive policy</SubmitButton>
                    </form>
                  ) : null}
                </div>
                <div className="structure-grid">
                  <div className="quote-box"><strong>Type</strong><br />{selectedPolicy.sourceType}</div>
                  <div className="quote-box"><strong>Chunks</strong><br />{selectedPolicy.chunks.length}</div>
                  <div className="quote-box">
                    <strong>Reference</strong><br />
                    {selectedPolicy.sourceUrl ? <a className="text-link" href={selectedPolicy.sourceUrl} target="_blank" rel="noreferrer">{selectedPolicy.sourceUrl}</a> : "No external reference URL."}
                  </div>
                </div>
                <h3>Outline</h3>
                <ol className="clean-list">
                  {selectedPolicy.chunks.map((chunk) => <li key={chunk.id}>{chunk.heading}</li>)}
                </ol>
                <h3>Policy text</h3>
                <div className="policy-source-reader">
                  {selectedPolicy.chunks.map((chunk) => (
                    <article className="quote-box" key={chunk.id}>
                      <strong>{chunk.heading}</strong>
                      <p>{chunk.content}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted">Add a company-specific workspace policy from the Knowledge page to see details here.</p>
            )}
          </Panel>
        </div>
      ) : (
        <Panel title="Policy citations only" tag={<Tag tone="review">Requester view</Tag>}>
          <p className="muted">Requesters cannot browse the full workspace policy library. Relevant citations appear on their own case detail pages.</p>
        </Panel>
      )}
    </AppShell>
  );
}
