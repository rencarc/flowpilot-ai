# FlowPilot AI Interview Notes

## One-Minute Pitch

FlowPilot AI is a governed AI intake platform for internal business operations. It takes messy employee or operations requests, turns them into structured cases, checks policy evidence, detects missing information, routes risky work to human review, and only then creates approved backend workflow handoffs.

The key point is separation of responsibility: AI reasons and recommends; the platform controls authorization, review, execution, and auditability.

## Architecture Decision

The most important design choice is separating AI reasoning from production execution.

AI can classify, summarize, retrieve policy context, and draft recommendations. It cannot approve high-risk requests or call production systems directly. Actual execution happens only through backend workflow runs after role checks, policy evidence checks, human review gates, approved workflow templates, and idempotent connector execution.

## Why It Is Not Just A Chatbot

FlowPilot AI is not a free-form assistant. It has:

- persisted cases
- strict structured output validation
- policy citations
- missing information gates
- role-based access control
- human review decisions
- approved workflow templates
- backend-only connectors
- execution attempts and retries
- audit logs and AI traces

The AI output is useful, but it is not trusted blindly.

## Why It Is Not Just Jira Or ServiceNow

Traditional ticketing systems store tasks and comments. FlowPilot adds an AI governance layer before a request becomes executable work:

- normalizes unclear requests
- identifies sensitive systems and data
- checks policy evidence
- determines whether review is required
- proposes the safest workflow template
- blocks unsupported or incomplete requests

## Why It Is Not Just n8n Or Make

Automation tools execute workflows. FlowPilot decides whether a workflow should be allowed to execute.

It sits before automation platforms as a governance and approval layer. The output can later be handed off to n8n, Make, Pipedream, Power Automate, Jira, ServiceNow, Slack, email, or internal APIs.

## Security And RLS

Supabase RLS is used as a database-level security boundary.

- Requesters can create and read their own cases.
- Reviewers and admins can see review and execution data.
- Admins can manage policies, workflow templates, connectors, and AI traces.
- Server actions re-check role permissions before privileged actions.
- Service role access is server-only.
- Connector credentials are represented as secret references, not stored in browser-visible payloads.

Interview wording:

> Permissions are not just hidden in the UI. The database enforces workspace and role boundaries with RLS, and privileged server actions re-check authorization before writing sensitive state.

## AI Structured Output

The OpenAI call uses a strict JSON schema for case analysis.

The application validates the model output again before saving it. If the output is missing fields, has an invalid status, or fails validation, the case is marked `ai_output_invalid` and an audit event is written.

Interview wording:

> I treat AI output as untrusted input. The model is constrained with a schema, then the application validates the result before any state transition.

## Policy Knowledge And RAG

Policy knowledge has two layers:

- Governance standards: baseline policy frameworks such as EU AI Act, GDPR, security, IAM, HR/payroll, handoff safety, vendor risk, and legal review.
- Company policy supplements: workspace-specific policies added by admins for real internal rules.

Current retrieval uses pgvector semantic similarity search when embeddings exist, with keyword retrieval as a development fallback.

Interview wording:

> I separated baseline governance standards from company-specific policy supplements. That gives the AI a consistent compliance framework while still letting each workspace add local policy details.

## Human Review

High-risk, incomplete, unsupported, or policy-evidence-missing cases cannot move directly to execution.

Reviewers and admins can:

- approve a case
- reject a case
- request missing information
- provide review notes

Requesters mainly submit cases and track progress.

## Workflow Templates And Proposals

Workflow templates are approved execution patterns. AI can recommend or draft a proposal, but proposals cannot execute directly.

Admins can convert approved proposals into workflow templates. Actual workflow runs are created only from approved templates.

Interview wording:

> AI can draft a workflow template proposal, but conversion into an executable template is an admin-controlled step.

## Connector Execution

Connector execution is backend-only.

The connector layer uses an adapter interface so each integration can validate configuration and execute payloads consistently.

Workflow runs include:

- payload preview
- idempotency key
- status transitions
- execution attempts
- retry count
- cancellation
- failure reason

Implemented adapters include mock internal API, custom webhook, and Slack Incoming Webhook. Connector secrets are stored as lightweight `env:` references such as `env:SLACK_WEBHOOK_URL`; the real values live in backend environment variables.

## Observability

The project records:

- audit logs for major state transitions
- AI traces for analysis attempts
- success and invalid output signals
- workflow execution attempts
- RAG evaluation samples with citation coverage

AI analysis traces are exported to Langfuse from the backend when Langfuse environment variables are configured. If Langfuse is unavailable, the app keeps the local Supabase audit trail and does not block the user flow.

## Current Limitations

- Real OpenAI analysis requires available API credits.
- Semantic retrieval requires generated embeddings; otherwise the app falls back to keyword retrieval.
- Connector secret values are resolved from backend environment variables in the demo; enterprise vault integration is future work.
- External Langfuse trace export is environment-dependent and does not block the user flow if Langfuse is unavailable.
- End-to-end hosted demo QA should be repeated after each production deployment.

## Demo Path

1. Show the homepage and product boundary.
2. Sign in and open `/dashboard`.
3. Create a requester case from `/new-request`.
4. Open `/cases` and prove persistence.
5. Use reviewer/admin to run analysis or policy evidence checks.
6. Show risk, missing information, policy citations, and audit trail on case detail.
7. Use `/review` to approve, reject, or request more information.
8. Open `/workflows` to show approved templates and proposals.
9. Create a governed workflow run after approval.
10. Execute, retry, or cancel the run.
11. Open `/audit` to show traces, failure signals, and RAG evaluation samples.

## Strong Closing Line

FlowPilot AI is designed around a simple governance rule: AI can accelerate decision-making, but it cannot become the authorization boundary.
