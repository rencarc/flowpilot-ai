import { createConnectorAction } from "@/app/actions";
import { AppShell, Kv, PageHeader, Panel, Tag } from "@/components/ui";
import { formatDateTime, getCurrentUserContext } from "@/lib/cases";
import { getVisibleConnectors } from "@/lib/execution";

function errorText(error?: string) {
  if (error === "connector_forbidden") {
    return "Only admins can manage connectors.";
  }

  if (error === "missing_connector") {
    return "Connector name is required.";
  }

  if (error === "create_connector_failed") {
    return "Could not create connector.";
  }

  if (error === "invalid_connector") {
    return "Connector type is invalid.";
  }

  if (error === "missing_connector_url") {
    return "Webhook connectors require an endpoint URL.";
  }

  return null;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { profile } = await getCurrentUserContext();
  const canManageConnectors = profile?.role === "admin";
  const connectors = canManageConnectors ? await getVisibleConnectors() : [];

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Workspace roles, safety gates, and backend connector placeholders." />
      {errorText(error) ? <p className="auth-message error">{errorText(error)}</p> : null}
      <div className="settings-grid">
        <Panel title="Workspace">
          <div className="kv">
            <Kv label="Role" value={profile?.role ?? "demo"} />
            <Kv label="Workspace ID" value={profile?.workspace_id ?? "Not signed in"} />
          </div>
        </Panel>
        <Panel title="Roles">
          <div className="kv">
            <Kv label="requester" value="Create and view own cases" />
            <Kv label="reviewer" value="Analyze, review, match workflows" />
            <Kv label="admin" value="Manage policies, workflows, connectors" />
          </div>
        </Panel>
        <Panel title="Risk gates" tag={<Tag tone="approved">Enforced</Tag>}>
          <div className="kv">
            <Kv label="High risk" value="Always requires review" />
            <Kv label="Missing info" value="Blocks handoff" />
            <Kv label="Approved templates only" value="AI cannot execute unknown workflows" />
          </div>
        </Panel>
        <Panel title="Connectors" tag={<Tag tone={canManageConnectors ? "approved" : "pending"}>{canManageConnectors ? `${connectors.length} active` : "Admin only"}</Tag>}>
          {canManageConnectors ? (
            <>
              <details className="policy-maintenance">
                <summary>Add connector</summary>
                <form className="auth-form" action={createConnectorAction}>
                  <label><span>Name</span><input className="input" name="name" defaultValue="Mock internal ops API" required /></label>
                  <label>
                    <span>Type</span>
                    <select className="input" name="type" defaultValue="mock_internal_api">
                      <option value="mock_internal_api">Mock internal API</option>
                      <option value="custom_webhook">Custom webhook</option>
                    </select>
                  </label>
                  <label><span>Endpoint URL</span><input className="input" name="endpoint_url" placeholder="https://example.com/webhook/flowpilot" /></label>
                  <p className="muted">Webhook execution runs only on the backend and sends the idempotency key as a request header. Secret-based auth is intentionally not exposed in this UI yet.</p>
                  <button className="primary-btn full-width" type="submit">Create connector</button>
                </form>
              </details>
              <div className="template-list">
                {connectors.map((connector) => (
                  <article className="template-card" key={connector.id}>
                    <div className="row-between"><h3>{connector.name}</h3><Tag tone={connector.active ? "approved" : "pending"}>{connector.type}</Tag></div>
                    <p>{connector.endpoint_url ?? "No external URL. This connector runs as a local mock placeholder."}</p>
                    <div className="kv"><Kv label="Auth" value={connector.auth_type} /><Kv label="Updated" value={formatDateTime(connector.updated_at)} /></div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Connector setup is restricted to admins. Workflow runs use backend-controlled connector references, never browser secrets.</p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
