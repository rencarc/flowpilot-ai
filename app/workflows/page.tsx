import { AppShell, Kv, PageHeader, Panel, Tag } from "@/components/ui";
import { formatDateTime, formatRisk, getCurrentUserContext } from "@/lib/cases";
import { getVisibleWorkflowTemplateProposals, getVisibleWorkflowTemplates } from "@/lib/workflows";
import type { WorkflowTemplateProposalRecord, WorkflowTemplateRecord } from "@/lib/supabase/types";

function workflowTone(template: WorkflowTemplateRecord) {
  if (template.active || template.lifecycle_status === "active") {
    return "approved";
  }

  if (template.lifecycle_status === "disabled" || template.lifecycle_status === "deprecated") {
    return "rejected";
  }

  return "pending";
}

function proposalTone(proposal: WorkflowTemplateProposalRecord) {
  if (proposal.status === "approved" || proposal.status === "converted") {
    return "approved";
  }

  if (proposal.status === "rejected") {
    return "rejected";
  }

  return "review";
}

function RequiredFields({ fields }: { fields: string[] }) {
  if (fields.length === 0) {
    return <Tag tone="pending">No required fields</Tag>;
  }

  return <>{fields.map((field) => <Tag key={field}>{field}</Tag>)}</>;
}

function WorkflowTemplateCard({ template }: { template: WorkflowTemplateRecord }) {
  return (
    <article className="template-card">
      <div className="row-between">
        <h3>{template.name}</h3>
        <Tag tone={workflowTone(template)}>{template.lifecycle_status}</Tag>
      </div>
      <p>{template.description ?? "No description provided."}</p>
      <div className="kv">
        <Kv label="Category" value={template.category} />
        <Kv label="Trigger" value={template.trigger_condition} />
        <Kv label="Risk" value={formatRisk(template.risk_level)} />
        <Kv label="Review" value={template.requires_review ? "Required" : "Optional"} />
        <Kv label="Version" value={`v${template.version}`} />
        <Kv label="Updated" value={formatDateTime(template.updated_at)} />
      </div>
      <h3>Required fields</h3>
      <div className="pill-list"><RequiredFields fields={template.required_fields} /></div>
    </article>
  );
}

function ProposalCard({ proposal }: { proposal: WorkflowTemplateProposalRecord }) {
  return (
    <article className="template-card">
      <div className="row-between">
        <h3>{proposal.name}</h3>
        <Tag tone={proposalTone(proposal)}>{proposal.status}</Tag>
      </div>
      <p>{proposal.description ?? "No description provided."}</p>
      <div className="kv">
        <Kv label="Category" value={proposal.category} />
        <Kv label="Trigger" value={proposal.trigger_condition} />
        <Kv label="Risk" value={formatRisk(proposal.risk_level)} />
        <Kv label="Execution" value="Cannot execute until admin converts it" />
      </div>
      <h3>Suggested steps</h3>
      {proposal.suggested_steps.length > 0 ? (
        <ol className="clean-list">{proposal.suggested_steps.map((step) => <li key={step}>{step}</li>)}</ol>
      ) : (
        <p className="muted">No suggested steps recorded.</p>
      )}
    </article>
  );
}

export default async function WorkflowsPage() {
  const { profile } = await getCurrentUserContext();
  const canReadWorkflows = profile?.role === "reviewer" || profile?.role === "admin";
  const canManageWorkflows = profile?.role === "admin";
  const templates = canReadWorkflows ? await getVisibleWorkflowTemplates() : [];
  const proposals = canReadWorkflows ? await getVisibleWorkflowTemplateProposals() : [];
  const approvedTemplates = templates.filter((template) => template.lifecycle_status === "approved" || template.lifecycle_status === "active");

  return (
    <AppShell>
      <PageHeader
        title="Workflows"
        subtitle="Approved workflow templates and AI proposals. AI can draft, but only admin-approved templates can become executable."
      />
      {canReadWorkflows ? (
        <>
          <div className="metric-strip">
            <div className="metric"><span>Approved workflows</span><strong>{approvedTemplates.length}</strong><small>Executable after review gate</small></div>
            <div className="metric"><span>AI proposals</span><strong>{proposals.length}</strong><small>Draft only until admin conversion</small></div>
            <div className="metric"><span>Admin controls</span><strong>{canManageWorkflows ? "On" : "Off"}</strong><small>{canManageWorkflows ? "Can manage workflows" : "Read-only role"}</small></div>
            <div className="metric"><span>Safety rule</span><strong>No bypass</strong><small>AI cannot execute proposals</small></div>
            <div className="metric"><span>Next stage</span><strong>Step 8</strong><small>Create and convert templates</small></div>
          </div>
          <div className="workflow-grid">
            <Panel title="Approved workflows" tag={<Tag tone="approved">{approvedTemplates.length} active</Tag>}>
              <div className="template-list">
                {approvedTemplates.length > 0 ? approvedTemplates.map((template) => <WorkflowTemplateCard key={template.id} template={template} />) : <p className="muted">No approved workflow templates have been created yet.</p>}
              </div>
            </Panel>
            <Panel title="AI proposed workflows" tag={<Tag tone="review">{proposals.length} proposals</Tag>}>
              <div className="template-list">
                {proposals.length > 0 ? proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />) : <p className="muted">No AI workflow proposals have been recorded yet.</p>}
              </div>
            </Panel>
          </div>
        </>
      ) : (
        <Panel title="Requester view" tag={<Tag tone="pending">Read only</Tag>}>
          <p className="muted">Requesters do not manage workflow templates. Approved handoff progress appears on their own case detail pages.</p>
        </Panel>
      )}
    </AppShell>
  );
}
