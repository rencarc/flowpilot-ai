import type { ConnectorAuthType, ConnectorRecord, ConnectorType, WorkflowRunRecord } from "@/lib/supabase/types";

export interface ConnectorExecutionResult {
  failed: boolean;
  responseStatus: number | null;
  responseBody: Record<string, unknown>;
  errorMessage: string | null;
  adapterType: ConnectorType;
}

export interface ConnectorAdapter {
  type: ConnectorType;
  validateConfig(connector: ConnectorConfig): string | null;
  execute(input: ConnectorExecutionInput): Promise<ConnectorExecutionResult>;
}

export type ConnectorConfig = Pick<ConnectorRecord, "type" | "endpoint_url" | "auth_type" | "secret_ref">;

export interface ConnectorExecutionInput {
  run: Pick<WorkflowRunRecord, "id" | "payload" | "idempotency_key">;
  connector: ConnectorConfig | null;
  payload?: Record<string, unknown>;
}

function shouldMockFail(payload: Record<string, unknown>) {
  return payload.force_failure === true;
}

function parseResponseBody(text: string) {
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return { body: text };
  }
}

function resolveEnvSecret(secretRef: string | null) {
  if (!secretRef) {
    return null;
  }

  if (!secretRef.startsWith("env:")) {
    return null;
  }

  const envName = secretRef.slice("env:".length).trim();

  if (!envName || !/^[A-Z0-9_]+$/.test(envName)) {
    return null;
  }

  return process.env[envName] ?? null;
}

function secretStatus(secretRef: string | null) {
  if (!secretRef) {
    return "none";
  }

  if (!secretRef.startsWith("env:")) {
    return "unsupported_secret_ref";
  }

  return resolveEnvSecret(secretRef) ? "resolved" : "missing_env_value";
}

function authHeaders(authType: ConnectorAuthType, secretRef: string | null): Record<string, string> {
  const secret = resolveEnvSecret(secretRef);

  if (!secret || authType === "none") {
    return {};
  }

  if (authType === "bearer_token") {
    return { Authorization: `Bearer ${secret}` };
  }

  if (authType === "api_key_header") {
    return { "x-api-key": secret };
  }

  if (authType === "basic_auth") {
    return { Authorization: `Basic ${Buffer.from(secret).toString("base64")}` };
  }

  return {};
}

class MockInternalApiAdapter implements ConnectorAdapter {
  type: ConnectorType = "mock_internal_api";

  validateConfig() {
    return null;
  }

  async execute(input: ConnectorExecutionInput): Promise<ConnectorExecutionResult> {
    const payload = input.payload ?? input.run.payload;
    const failed = shouldMockFail(payload);

    return {
      failed,
      responseStatus: failed ? 422 : 200,
      responseBody: failed
        ? { ok: false, adapter: this.type, message: "Mock connector rejected the payload." }
        : { ok: true, adapter: this.type, message: "Mock connector accepted the governed workflow payload." },
      errorMessage: failed ? "Mock connector rejected the payload." : null,
      adapterType: this.type
    };
  }
}

class CustomWebhookAdapter implements ConnectorAdapter {
  type: ConnectorType = "custom_webhook";

  validateConfig(connector: ConnectorConfig) {
    if (!connector.endpoint_url) {
      return "Webhook connector is missing an endpoint URL.";
    }

    if (connector.auth_type !== "none" && !connector.secret_ref) {
      return "Webhook connector auth requires a secret reference.";
    }

    if (connector.secret_ref && secretStatus(connector.secret_ref) === "unsupported_secret_ref") {
      return "Only env: secret references are supported in this lightweight demo.";
    }

    if (connector.auth_type !== "none" && secretStatus(connector.secret_ref) === "missing_env_value") {
      return "Connector secret reference points to a missing environment variable.";
    }

    return null;
  }

  async execute(input: ConnectorExecutionInput): Promise<ConnectorExecutionResult> {
    const connector = input.connector;
    const configError = connector ? this.validateConfig(connector) : "Connector is missing.";

    if (!connector || configError) {
      return {
        failed: true,
        responseStatus: 400,
        responseBody: { ok: false, adapter: this.type, message: configError },
        errorMessage: configError,
        adapterType: this.type
      };
    }

    try {
      const response = await fetch(connector.endpoint_url!, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": input.run.idempotency_key,
          ...authHeaders(connector.auth_type, connector.secret_ref)
        },
        body: JSON.stringify(input.payload ?? input.run.payload)
      });
      const responseBody = parseResponseBody(await response.text());

      return {
        failed: !response.ok,
        responseStatus: response.status,
        responseBody: { adapter: this.type, ...responseBody },
        errorMessage: response.ok ? null : `Webhook returned HTTP ${response.status}.`,
        adapterType: this.type
      };
    } catch (error) {
      return {
        failed: true,
        responseStatus: null,
        responseBody: { ok: false, adapter: this.type, message: error instanceof Error ? error.message : "Unknown webhook error" },
        errorMessage: error instanceof Error ? error.message : "Unknown webhook error",
        adapterType: this.type
      };
    }
  }
}

class SlackWebhookAdapter implements ConnectorAdapter {
  type: ConnectorType = "slack";

  validateConfig(connector: ConnectorConfig) {
    if (!connector.secret_ref?.startsWith("env:")) {
      return "Slack connector requires a secret reference such as env:SLACK_WEBHOOK_URL.";
    }

    if (!resolveEnvSecret(connector.secret_ref)) {
      return "Slack webhook URL environment variable is missing.";
    }

    return null;
  }

  async execute(input: ConnectorExecutionInput): Promise<ConnectorExecutionResult> {
    const connector = input.connector;
    const configError = connector ? this.validateConfig(connector) : "Connector is missing.";

    if (!connector || configError) {
      return {
        failed: true,
        responseStatus: 400,
        responseBody: { ok: false, adapter: this.type, message: configError },
        errorMessage: configError,
        adapterType: this.type
      };
    }

    const payload = input.payload ?? input.run.payload;
    const webhookUrl = resolveEnvSecret(connector.secret_ref)!;
    const message = {
      text: `FlowPilot AI workflow handoff: ${String(payload.title ?? payload.case_id ?? input.run.id)}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*FlowPilot AI workflow handoff*\nCase: ${String(payload.case_id ?? "unknown")}\nRisk: ${String(payload.risk_level ?? "unknown")}\nRequester: ${String(payload.requester ?? "unknown")}`
          }
        }
      ]
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(message)
      });
      const text = await response.text();

      return {
        failed: !response.ok,
        responseStatus: response.status,
        responseBody: { ok: response.ok, adapter: this.type, body: text || "ok", secret_ref: connector.secret_ref },
        errorMessage: response.ok ? null : `Slack webhook returned HTTP ${response.status}.`,
        adapterType: this.type
      };
    } catch (error) {
      return {
        failed: true,
        responseStatus: null,
        responseBody: { ok: false, adapter: this.type, message: error instanceof Error ? error.message : "Unknown Slack webhook error" },
        errorMessage: error instanceof Error ? error.message : "Unknown Slack webhook error",
        adapterType: this.type
      };
    }
  }
}

const adapters: ConnectorAdapter[] = [
  new MockInternalApiAdapter(),
  new CustomWebhookAdapter(),
  new SlackWebhookAdapter()
];

export function getConnectorAdapter(type: ConnectorType | null | undefined) {
  return adapters.find((adapter) => adapter.type === (type ?? "mock_internal_api")) ?? adapters[0];
}

export function validateConnectorConfig(connector: ConnectorConfig | null) {
  return getConnectorAdapter(connector?.type).validateConfig(connector ?? { type: "mock_internal_api", endpoint_url: null, auth_type: "none", secret_ref: null });
}

export function maskSecretRef(secretRef: string | null) {
  if (!secretRef) {
    return "None";
  }

  if (secretRef.startsWith("env:")) {
    return secretStatus(secretRef) === "resolved" ? `${secretRef} (resolved)` : `${secretRef} (missing)`;
  }

  return "Unsupported secret reference";
}

export async function executeConnectorRun(run: WorkflowRunRecord, connector: ConnectorConfig | null) {
  return getConnectorAdapter(connector?.type).execute({ run, connector });
}

export async function testConnector(connector: ConnectorConfig) {
  const testRun = {
    id: "connector-test",
    idempotency_key: `connector-test:${crypto.randomUUID()}`,
    payload: {
      title: "Connector test from FlowPilot AI",
      case_id: "test",
      requester: "system",
      department: "demo",
      risk_level: "low"
    }
  };

  return getConnectorAdapter(connector.type).execute({ run: testRun, connector, payload: testRun.payload });
}
