import { createConnectorAction, testConnectorAction, toggleConnectorAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { AppShell, Kv, PageHeader, Panel, Tag } from "@/components/ui";
import { formatDateTime, getCurrentUserContext } from "@/lib/cases";
import { maskSecretRef } from "@/lib/connectors";
import { getVisibleConnectors } from "@/lib/execution";
import { getLangfuseConfigStatus } from "@/lib/observability";

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

  if (error === "invalid_connector_auth") {
    return "Connector auth type is invalid.";
  }

  if (error === "missing_secret_ref") {
    return "Secret ref is required for this auth type.";
  }

  if (error === "connector_test_failed") {
    return "Connector test could not be started.";
  }

  if (error === "connector_update_failed") {
    return "Connector status could not be updated.";
  }

  return null;
}

function successText(status?: string) {
  if (status === "succeeded") {
    return "Connector test succeeded. Check audit logs for the recorded response.";
  }

  if (status === "failed") {
    return "Connector test failed. Check audit logs for the response and error message.";
  }

  return null;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; connector_test?: string }> }) {
  const { error, connector_test: connectorTest } = await searchParams;
  const { profile } = await getCurrentUserContext();
  const canManageConnectors = profile?.role === "admin";
  const connectors = canManageConnectors ? await getVisibleConnectors() : [];
  const langfuse = getLangfuseConfigStatus();

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle="Workspace roles, safety gates, and backend connector placeholders." />
      {errorText(error) ? <p className="auth-message error">{errorText(error)}</p> : null}
      {successText(connectorTest) ? <p className={`auth-message ${connectorTest === "succeeded" ? "success" : "error"}`}>{successText(connectorTest)}</p> : null}
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
        <Panel title="Observability" tag={<Tag tone={langfuse.enabled ? "approved" : "pending"}>{langfuse.status}</Tag>}>
          <div className="kv">
            <Kv label="Local traces" value="Stored in Supabase ai_traces and audit_logs" />
            <Kv label="External provider" value="Langfuse" />
            <Kv label="Host" value={langfuse.host} />
            <Kv label="Missing env" value={langfuse.missing.length > 0 ? langfuse.missing.join(", ") : "None"} />
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
                      <option value="slack">Slack incoming webhook</option>
                    </select>
                  </label>
                  <label><span>Endpoint URL</span><input className="input" name="endpoint_url" placeholder="Required for custom webhook only" /></label>
                  <label>
                    <span>Auth type</span>
                    <select className="input" name="auth_type" defaultValue="none">
                      <option value="none">None</option>
                      <option value="bearer_token">Bearer token</option>
                      <option value="api_key_header">API key header</option>
                      <option value="hmac_signature">HMAC signature</option>
                      <option value="basic_auth">Basic auth</option>
                    </select>
                  </label>
                  <label><span>Secret ref</span><input className="input" name="secret_ref" placeholder="env:SLACK_WEBHOOK_URL" /></label>
                  <p className="muted">Store only a secret reference here. For this demo, use env variables such as env:SLACK_WEBHOOK_URL. The actual credential stays in Vercel or .env.local.</p>
                  <SubmitButton className="primary-btn full-width" pendingText="Creating...">Create connector</SubmitButton>
                </form>
              </details>
              <div className="template-list">
                {connectors.map((connector) => (
                  <article className="template-card" key={connector.id}>
                    <div className="row-between"><h3>{connector.name}</h3><Tag tone={connector.active ? "approved" : "pending"}>{connector.type}</Tag></div>
                    <p>{connector.endpoint_url ?? "No external URL. This connector runs as a local mock placeholder."}</p>
                    <div className="kv">
                      <Kv label="Auth" value={connector.auth_type} />
                      <Kv label="Secret" value={maskSecretRef(connector.secret_ref)} />
                      <Kv label="Updated" value={formatDateTime(connector.updated_at)} />
                    </div>
                    <div className="button-row">
                      <form action={testConnectorAction}>
                        <input type="hidden" name="connector_id" value={connector.id} />
                        <SubmitButton className="secondary-btn" pendingText="Testing...">Test connector</SubmitButton>
                      </form>
                      <form action={toggleConnectorAction}>
                        <input type="hidden" name="connector_id" value={connector.id} />
                        <input type="hidden" name="active" value={connector.active ? "false" : "true"} />
                        <SubmitButton className={connector.active ? "danger-btn" : "secondary-btn"} pendingText="Saving...">{connector.active ? "Disable" : "Enable"}</SubmitButton>
                      </form>
                    </div>
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
