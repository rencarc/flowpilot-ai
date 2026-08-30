import Link from "next/link";
import { createPolicyAction } from "@/app/actions";
import { AppShell, PageHeader, Panel, Tag } from "@/components/ui";
import { formatDateTime, getCurrentUserContext } from "@/lib/cases";
import { starterPolicies } from "@/lib/policy-starter-pack";
import { getVisiblePolicies, getVisiblePolicyChunks, splitPolicyContent, type PolicyChunkRecord, type PolicyRecord } from "@/lib/policies";

type PolicyView =
  | {
      id: string;
      title: string;
      description: string | null;
      sourceType: string;
      sourceUrl: string | null;
      createdAt: string | null;
      chunks: Array<{ id: string; heading: string; content: string }>;
      origin: "starter" | "workspace";
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

function starterPolicyView(index: number): PolicyView {
  const policy = starterPolicies[index];
  const chunks = splitPolicyContent(policy.content);

  return {
    id: `starter:${index}`,
    title: policy.title,
    description: policy.description,
    sourceType: policy.sourceUrl.startsWith("internal://") ? "internal_starter" : "regulatory_reference",
    sourceUrl: policy.sourceUrl.startsWith("internal://") ? null : policy.sourceUrl,
    createdAt: null,
    origin: "starter",
    chunks: chunks.map((chunk, chunkIndex) => ({
      id: `starter:${index}:${chunkIndex}`,
      heading: headingFromText(chunk, `Section ${chunkIndex + 1}`),
      content: chunk
    }))
  };
}

function sourceLabel(policy: PolicyView) {
  if (policy.origin === "starter") {
    return policy.sourceUrl ? "Reference framework" : "Internal template";
  }

  return policy.sourceUrl ? "Attached source" : "Manual source";
}

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ error?: string; policy?: string }> }) {
  const { error, policy: selectedId } = await searchParams;
  const { profile } = await getCurrentUserContext();
  const policies = await getVisiblePolicies();
  const chunks = await getVisiblePolicyChunks();
  const canManagePolicies = profile?.role === "admin";
  const canReadPolicyLibrary = profile?.role === "reviewer" || profile?.role === "admin";
  const message = errorText(error);
  const latestPolicy = policies[0] ? workspacePolicyView(policies[0], chunks) : null;
  const starterViews = starterPolicies.map((_, index) => starterPolicyView(index));
  const selectedPolicy = starterViews.find((policy) => policy.id === selectedId) ?? starterViews[0];

  return (
    <AppShell>
      <PageHeader title="Knowledge" subtitle="Policy sources used to ground risk checks, missing information, and case citations." />
      {message ? <p className="auth-message error">{message}</p> : null}
      {canReadPolicyLibrary ? (
        <>
          <div className="knowledge-top-grid">
            <Panel title="Add policy" tag={<Tag tone={canManagePolicies ? "approved" : "review"}>{canManagePolicies ? "Admin" : "Read only"}</Tag>}>
              {canManagePolicies ? (
                <details className="policy-maintenance" open={policies.length === 0}>
                  <summary>Add company policy</summary>
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
              ) : (
                <p className="muted">Reviewers can inspect policy content and citations, but only admins can add or update policy sources.</p>
              )}
            </Panel>
            <Panel
              title="Latest policy"
              tag={
                <div className="split-actions">
                  {policies.length > 0 ? <Link className="small-btn" href="/knowledge/company">View all</Link> : null}
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
                <p className="muted">No custom policy has been added yet. The eight starter policies below are available as readable templates.</p>
              )}
            </Panel>
          </div>
          <div className="policy-library-layout">
            <Panel title="Starter policies" tag={<Tag tone="pending">{starterViews.length} templates</Tag>}>
              <div className="policy-nav-list">
                {starterViews.map((policy) => (
                  <Link className={`policy-nav-item${selectedPolicy.id === policy.id ? " active" : ""}`} href={`/knowledge?policy=${policy.id}`} key={policy.id}>
                    <strong>{policy.title}</strong>
                    <span>{policy.description}</span>
                    <small>{sourceLabel(policy)} / {policy.chunks.length} sections</small>
                  </Link>
                ))}
              </div>
            </Panel>
            <Panel title="Policy detail" tag={<Tag tone="approved">{selectedPolicy.origin === "starter" ? "Template" : "Workspace policy"}</Tag>}>
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
