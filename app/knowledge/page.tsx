import Link from "next/link";
import { createPolicyAction, generatePolicyEmbeddingsAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { AppShell, PageHeader, Panel, Tag } from "@/components/ui";
import { formatDateTime, getCurrentUserContext } from "@/lib/cases";
import { governanceStandards } from "@/lib/governance-standards";
import { getVisiblePolicies, getVisiblePolicyChunks, isWorkspaceAuthoredPolicy, splitPolicyContent, type PolicyChunkRecord, type PolicyRecord } from "@/lib/policies";

type PolicyView =
  | {
      id: string;
      title: string;
      description: string | null;
      sourceType: string;
      sourceUrl: string | null;
      createdAt: string | null;
      chunks: Array<{ id: string; heading: string; content: string }>;
      origin: "standard" | "workspace";
    };

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

  if (error === "embedding_failed") {
    return "Policy embedding generation failed. Check OpenAI billing, environment variables, and Supabase vector search migration.";
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

function workspacePolicyView(policy: PolicyRecord, chunks: PolicyChunkRecord[]): PolicyView {
  const policyChunks = chunks.filter((chunk) => chunk.policy_id === policy.id).sort((a, b) => a.chunk_index - b.chunk_index);

  return {
    id: `workspace:${policy.id}`,
    title: policy.title,
    description: policy.description,
    sourceType: policy.source_type,
    sourceUrl: policy.source_url,
    createdAt: policy.created_at,
    origin: "workspace",
    chunks: policyChunks.map((chunk) => ({
      id: chunk.id,
      heading: chunkHeading(chunk),
      content: chunk.content
    }))
  };
}

function governanceStandardView(index: number): PolicyView {
  const policy = governanceStandards[index];
  const chunks = splitPolicyContent(policy.content);

  return {
    id: `standard:${index}`,
    title: policy.title,
    description: policy.description,
    sourceType: policy.sourceUrl.startsWith("internal://") ? "internal_starter" : "regulatory_reference",
    sourceUrl: policy.sourceUrl.startsWith("internal://") ? null : policy.sourceUrl,
    createdAt: null,
    origin: "standard",
    chunks: chunks.map((chunk, chunkIndex) => ({
      id: `standard:${index}:${chunkIndex}`,
      heading: headingFromText(chunk, `Section ${chunkIndex + 1}`),
      content: chunk
    }))
  };
}

function sourceLabel(policy: PolicyView) {
  if (policy.origin === "standard") {
    return policy.sourceUrl ? "Regulatory basis" : "Operating standard";
  }

  return policy.sourceUrl ? "Workspace source" : "Workspace policy";
}

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ embedded?: string; error?: string; policy?: string }> }) {
  const { embedded, error, policy: selectedId } = await searchParams;
  const { profile } = await getCurrentUserContext();
  const policies = await getVisiblePolicies();
  const chunks = await getVisiblePolicyChunks();
  const canManagePolicies = profile?.role === "admin";
  const canReadPolicyLibrary = profile?.role === "reviewer" || profile?.role === "admin";
  const message = errorText(error);
  const workspacePolicies = policies.filter(isWorkspaceAuthoredPolicy);
  const latestPolicy = workspacePolicies[0] ? workspacePolicyView(workspacePolicies[0], chunks) : null;
  const standardViews = governanceStandards.map((_, index) => governanceStandardView(index));
  const selectedPolicy = standardViews.find((policy) => policy.id === selectedId) ?? standardViews[0];

  return (
    <AppShell>
      <PageHeader title="Knowledge" subtitle="Governance standards define the baseline rules. Workspace policies add company-specific evidence for real cases." />
      {message ? <p className="auth-message error">{message}</p> : null}
      {embedded ? <p className="auth-message success">Generated semantic embeddings for {embedded} policy chunk(s).</p> : null}
      {canReadPolicyLibrary ? (
        <>
          <div className="knowledge-top-grid">
            <Panel title="Add policy" tag={<Tag tone={canManagePolicies ? "approved" : "review"}>{canManagePolicies ? "Admin" : "Read only"}</Tag>}>
              {canManagePolicies ? (
                <>
                  <details className="policy-maintenance" open={policies.length === 0}>
                    <summary>Add workspace policy</summary>
                    <form className="auth-form" action={createPolicyAction}>
                      <label><span>Title</span><input className="input" name="title" defaultValue="Privileged access approval policy" required /></label>
                      <label><span>Description</span><input className="input" name="description" defaultValue="Controls temporary admin access and approval evidence." /></label>
                      <label><span>Reference URL</span><input className="input" name="source_url" placeholder="https://company.example/policies/access" /></label>
                      <label>
                        <span>Policy text</span>
                        <textarea
                          className="textarea"
                          name="content"
                          defaultValue={"Temporary admin access to payroll, finance, HR, production, or identity systems requires manager approval, least-privilege scope, a time limit, and review by an authorized admin before any workflow handoff.\n\nRequests missing approver, business justification, target system, access duration, or rollback plan must enter needs_info or human review."}
                          required
                        />
                      </label>
                      <button className="primary-btn full-width" type="submit">Add policy</button>
                    </form>
                  </details>
                  <form action={generatePolicyEmbeddingsAction}>
                    <SubmitButton className="secondary-btn full-width" pendingText="Generating embeddings...">Generate semantic embeddings</SubmitButton>
                  </form>
                  <p className="muted">This only embeds workspace policy chunks that do not already have vectors. Use it after adding or changing company policies.</p>
                </>
              ) : (
                <p className="muted">Reviewers can inspect standards, workspace policies, and citations, but only admins can add or update workspace policies.</p>
              )}
            </Panel>
            <Panel
              title="Latest workspace policy"
              tag={
                <div className="split-actions">
                  {workspacePolicies.length > 0 ? <Link className="small-btn" href="/knowledge/company">View all</Link> : null}
                  <Tag tone={latestPolicy ? "approved" : "pending"}>{latestPolicy ? "Workspace" : "None yet"}</Tag>
                </div>
              }
            >
              {latestPolicy ? (
                <Link className="policy-nav-item active" href={`/knowledge/company?policy=${latestPolicy.id.replace("workspace:", "")}`}>
                  <strong>{latestPolicy.title}</strong>
                  <span>{latestPolicy.description ?? "No description provided."}</span>
                  <small>{latestPolicy.createdAt ? formatDateTime(latestPolicy.createdAt) : "Recently added"} / {latestPolicy.chunks.length} chunks</small>
                </Link>
              ) : (
                <p className="muted">No workspace policy has been added yet. The standards below still provide the baseline governance framework.</p>
              )}
            </Panel>
          </div>
          <div className="policy-library-layout">
            <Panel title="Governance standards" tag={<Tag tone="pending">{standardViews.length} standards</Tag>}>
              <div className="policy-nav-list">
                {standardViews.map((policy) => (
                  <Link className={`policy-nav-item${selectedPolicy.id === policy.id ? " active" : ""}`} href={`/knowledge?policy=${policy.id}`} key={policy.id}>
                    <strong>{policy.title}</strong>
                    <span>{policy.description}</span>
                    <small>{sourceLabel(policy)} / {policy.chunks.length} sections</small>
                  </Link>
                ))}
              </div>
            </Panel>
            <Panel title="Standard detail" tag={<Tag tone="approved">{selectedPolicy.origin === "standard" ? "Governance standard" : "Workspace policy"}</Tag>}>
              <div className="policy-detail">
                <div className="policy-detail-head">
                  <div>
                    <h3>{selectedPolicy.title}</h3>
                    <p className="muted">{selectedPolicy.description ?? "No description provided."}</p>
                  </div>
                </div>
                <div className="structure-grid">
                  <div className="quote-box"><strong>Type</strong><br />{selectedPolicy.sourceType}</div>
                  <div className="quote-box"><strong>Sections</strong><br />{selectedPolicy.chunks.length}</div>
                  <div className="quote-box">
                    <strong>{sourceLabel(selectedPolicy)}</strong><br />
                    {selectedPolicy.sourceUrl ? <a className="text-link" href={selectedPolicy.sourceUrl} target="_blank" rel="noreferrer">{selectedPolicy.sourceUrl}</a> : "No external link is attached to this internal policy."}
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
            </Panel>
          </div>
        </>
      ) : (
        <Panel title="Policy citations only" tag={<Tag tone="review">Requester view</Tag>}>
          <p className="muted">Requesters do not browse the full internal policy library. Relevant policy citations appear on their own case detail pages when a reviewer or admin checks policy evidence.</p>
        </Panel>
      )}
    </AppShell>
  );
}
