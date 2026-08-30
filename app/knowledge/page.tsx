import { createPolicyAction } from "@/app/actions";
import { AppShell, PageHeader, Panel, Tag } from "@/components/ui";
import { getCurrentUserContext } from "@/lib/cases";
import { getVisiblePolicies, getVisiblePolicyChunks } from "@/lib/policies";

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

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { profile } = await getCurrentUserContext();
  const policies = await getVisiblePolicies();
  const chunks = await getVisiblePolicyChunks();
  const canManagePolicies = profile?.role === "admin";
  const message = errorText(error);

  return (
    <AppShell>
      <PageHeader title="Knowledge" subtitle="Workspace policy sources used to ground case risk checks and citations." />
      {message ? <p className="auth-message error">{message}</p> : null}
      <div className="knowledge-layout">
        <Panel title="Add policy" tag={<Tag tone={canManagePolicies ? "approved" : "review"}>{canManagePolicies ? "Admin" : "Read only"}</Tag>}>
          {canManagePolicies ? (
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
              <button className="primary-btn" type="submit">Add policy source</button>
            </form>
          ) : (
            <p className="muted">Policy management is limited to admins. Requesters can still benefit from policy-grounded status updates on their cases.</p>
          )}
        </Panel>
        <Panel title="Policy sources" tag={<Tag tone="pending">Keyword retrieval</Tag>}>
          {policies.length === 0 ? <p className="muted">No policy sources yet. Add one as an admin to test governed evidence retrieval.</p> : null}
          {policies.map((policy) => {
            const policyChunks = chunks.filter((chunk) => chunk.policy_id === policy.id);

            return (
              <article className="policy-row" key={policy.id}>
                <div>
                  <h3>{policy.title}</h3>
                  <p>{policy.description ?? "No description provided."}</p>
                  <p><strong>Source:</strong> {policy.source_url ?? policy.source_type}</p>
                </div>
                <div className="tags">
                  <Tag>{policy.source_type}</Tag>
                  <Tag tone="approved">{policyChunks.length} chunks</Tag>
                </div>
              </article>
            );
          })}
        </Panel>
      </div>
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
