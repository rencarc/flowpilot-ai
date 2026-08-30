import Link from "next/link";
import { createPolicyAction, seedStarterPoliciesAction } from "@/app/actions";
import { AppShell, PageHeader, Panel, Tag } from "@/components/ui";
import { getCurrentUserContext } from "@/lib/cases";
import { starterPolicies } from "@/lib/policy-starter-pack";
import { getVisiblePolicies, getVisiblePolicyChunks, type PolicyChunkRecord } from "@/lib/policies";

function errorText(error?: string) {
  if (error === "policy_forbidden") {
    return "Only admins can add policy sources.";
  }

  if (error === "missing_policy") {
    return "Policy title and content are required.";
  }

  if (error === "create_failed") {
    return "Could not create the policy source.";
  }

  if (error === "chunk_failed") {
    return "Policy was created, but chunking failed.";
  }

  return null;
}

function chunkHeading(chunk: PolicyChunkRecord) {
  const firstLine = chunk.content.split("\n").find(Boolean);
  return firstLine && firstLine.length < 80 ? firstLine : `Section ${chunk.chunk_index + 1}`;
}

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ error?: string; policy?: string }> }) {
  const { error, policy: selectedPolicyId } = await searchParams;
  const { profile } = await getCurrentUserContext();
  const policies = await getVisiblePolicies();
  const chunks = await getVisiblePolicyChunks();
  const canManagePolicies = profile?.role === "admin";
  const canReadPolicyLibrary = profile?.role === "reviewer" || profile?.role === "admin";
  const message = errorText(error);
  const selectedPolicy = policies.find((policy) => policy.id === selectedPolicyId) ?? policies[0];
  const selectedChunks = selectedPolicy ? chunks.filter((chunk) => chunk.policy_id === selectedPolicy.id).sort((a, b) => a.chunk_index - b.chunk_index) : [];

  return (
    <AppShell>
      <PageHeader title="Knowledge" subtitle="Workspace policy library used to ground risk checks, missing information, and citations." />
      {message ? <p className="auth-message error">{message}</p> : null}
      {canReadPolicyLibrary ? (
        <>
          <div className="policy-library-layout">
            <Panel title="Policy library" tag={<Tag tone="pending">{policies.length} sources</Tag>}>
              {policies.length === 0 ? <p className="muted">No policy sources yet. Admins can seed the starter pack below.</p> : null}
              <div className="policy-nav-list">
                {policies.map((policy) => {
                  const policyChunks = chunks.filter((chunk) => chunk.policy_id === policy.id);
                  const isActive = selectedPolicy?.id === policy.id;

                  return (
                    <Link className={`policy-nav-item${isActive ? " active" : ""}`} href={`/knowledge?policy=${policy.id}`} key={policy.id}>
                      <strong>{policy.title}</strong>
                      <span>{policy.description ?? "No description provided."}</span>
                      <small>{policy.source_type} / {policyChunks.length} chunks</small>
                    </Link>
                  );
                })}
              </div>
            </Panel>
            <Panel title="Policy detail" tag={<Tag tone={selectedPolicy ? "approved" : "review"}>{selectedPolicy ? "Readable source" : "No source"}</Tag>}>
              {selectedPolicy ? (
                <div className="policy-detail">
                  <div className="policy-detail-head">
                    <div>
                      <h3>{selectedPolicy.title}</h3>
                      <p className="muted">{selectedPolicy.description ?? "No description provided."}</p>
                    </div>
                    {selectedPolicy.source_url ? (
                      <a className="secondary-btn" href={selectedPolicy.source_url} target="_blank" rel="noreferrer">Open source</a>
                    ) : null}
                  </div>
                  <div className="structure-grid">
                    <div className="quote-box"><strong>Source type</strong><br />{selectedPolicy.source_type}</div>
                    <div className="quote-box"><strong>Chunk count</strong><br />{selectedChunks.length}</div>
                    <div className="quote-box"><strong>Visibility</strong><br />Reviewer/admin library; requester sees case citations only.</div>
                  </div>
                  <h3>Outline</h3>
                  <ol className="clean-list">
                    {selectedChunks.map((chunk) => <li key={chunk.id}>{chunkHeading(chunk)}</li>)}
                  </ol>
                  <h3>Policy text</h3>
                  <div className="policy-source-reader">
                    {selectedChunks.map((chunk) => (
                      <article className="quote-box" key={chunk.id}>
                        <strong>{chunkHeading(chunk)}</strong>
                        <p>{chunk.content}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="muted">Select a policy source from the library.</p>
              )}
            </Panel>
          </div>
          <Panel title="Admin controls" tag={<Tag tone={canManagePolicies ? "approved" : "review"}>{canManagePolicies ? "Admin" : "Read only"}</Tag>}>
            {canManagePolicies ? (
              <div className="admin-policy-controls">
                <div className="stack">
                  <form action={seedStarterPoliciesAction}>
                    <button className="primary-btn full-width" type="submit">Seed starter pack</button>
                  </form>
                  <div className="quote-box"><strong>Starter pack</strong><br />{starterPolicies.length} internal policy documents covering AI Act, GDPR, security, IAM, HR/payroll, handoff, vendor risk, and legal review.</div>
                </div>
                <form className="auth-form" action={createPolicyAction}>
                  <label><span>Title</span><input className="input" name="title" defaultValue="Privileged access approval policy" required /></label>
                  <label><span>Description</span><input className="input" name="description" defaultValue="Controls temporary admin access and approval evidence." /></label>
                  <label><span>Source URL</span><input className="input" name="source_url" placeholder="https://company.example/policies/access" /></label>
                  <label>
                    <span>Policy content</span>
                    <textarea
                      className="textarea"
                      name="content"
                      defaultValue={"Temporary admin access to payroll, finance, HR, production, or identity systems requires manager approval, least-privilege scope, a time limit, and review by an authorized admin before any workflow handoff.\n\nRequests missing approver, business justification, target system, access duration, or rollback plan must enter needs_info or human review."}
                      required
                    />
                  </label>
                  <button className="secondary-btn full-width" type="submit">Add custom policy</button>
                </form>
              </div>
            ) : (
              <p className="muted">Policy management is limited to admins. Reviewers can inspect policy content and citations, but cannot modify sources.</p>
            )}
          </Panel>
        </>
      ) : (
        <Panel title="Policy citations only" tag={<Tag tone="review">Requester view</Tag>}>
          <p className="muted">Requesters do not browse the full internal policy library. Relevant policy citations appear on their own case detail pages when a reviewer or admin checks policy evidence.</p>
        </Panel>
      )}
      <Panel title="Retrieval status" tag={<Tag tone="pending">Step 6</Tag>}>
        <div className="structure-grid">
          <div className="quote-box"><strong>Current mode</strong><br />Keyword-based retrieval for local development without OpenAI credits.</div>
          <div className="quote-box"><strong>Next mode</strong><br />Generate embeddings for policy chunks and replace keyword ranking with pgvector similarity search.</div>
          <div className="quote-box"><strong>Safety behavior</strong><br />If no policy evidence matches, the case is held for human review instead of moving to handoff.</div>
        </div>
      </Panel>
    </AppShell>
  );
}
