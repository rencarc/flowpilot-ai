# FlowPilot AI

FlowPilot AI is a governed AI intake and workflow handoff platform for internal business operations.

It turns unclear employee and operations requests into structured, policy-aware, auditable cases. AI can structure, classify, retrieve policy context, and recommend next steps, but it cannot approve high-risk work or execute unapproved production workflows.

## Product Flow

```text
raw request
-> structured AI output
-> policy retrieval and citations
-> risk classification
-> missing information detection
-> human review
-> approved workflow template
-> backend connector execution
-> audit and observability
```

## Current Implementation

- Next.js App Router, TypeScript, and Tailwind CSS
- Supabase Auth with workspace profiles and role-based access
- Supabase RLS for requester, reviewer, and admin boundaries
- Persisted cases, policy documents, policy chunks, audit logs, AI traces, workflow templates, workflow runs, and execution attempts
- Server-side OpenAI structured output path with application validation
- Semantic pgvector policy retrieval with source citations and keyword fallback
- Human review decisions for approve, reject, and request-more-info flows
- Admin case lifecycle controls for archive and soft-delete trash handling
- Governed workflow template matching and AI proposal conversion
- Backend-only connector adapter execution with mock, custom webhook, and Slack webhook support
- Lightweight `env:` secret references with idempotency, retry, failure tracking, cancellation, and audit logs
- Observability dashboard for audit logs, AI traces, RAG evaluation samples, and optional Langfuse trace export

## Role Model

- `requester`: submits cases and tracks their own case progress
- `reviewer`: analyzes cases, requests missing information, and approves or rejects review items
- `admin`: manages policies, governance standards, workflow templates, connectors, execution settings, and AI traces

## Safety Boundary

AI is intentionally separated from production execution.

AI can:

- classify risk
- summarize and structure messy requests
- detect missing fields
- retrieve policy evidence
- recommend workflow templates
- draft workflow template proposals

AI cannot:

- approve high-risk requests
- bypass human review
- execute unapproved workflows
- call production connectors from the browser
- store connector secrets in frontend code
- advance invalid structured output

## Local Setup

Create `.env.local` from `.env.example`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://cloud.langfuse.com
SLACK_WEBHOOK_URL=
```

`OPENAI_API_KEY` is only required for real AI analysis. Langfuse variables are optional and the app works with local Supabase audit logs when they are blank.

Run locally:

```powershell
npm install
npm run dev
```

Open:

```text
http://localhost:4173
```

Useful checks:

```powershell
npm run typecheck
npm run lint
npm run build
```

## Supabase

Apply the schema in Supabase SQL Editor:

```text
supabase/migrations/202608280001_initial_schema.sql
```

Then apply later migrations in order, including:

```text
supabase/migrations/202608300001_policy_rls_refinement.sql
supabase/migrations/202608310001_policy_vector_search.sql
supabase/migrations/202609040001_case_validity_windows.sql
```

Do not commit `.env.local`. The service role key is server-only and must never be exposed to browser code.

## Connectors

Connector execution runs on the backend. The app currently supports:

- `mock_internal_api`: local demo adapter for success and failure paths
- `custom_webhook`: generic HTTP POST adapter for webhook.site, n8n, Make, or Power Automate HTTP triggers
- `slack`: Slack Incoming Webhook adapter

For Slack, put the real webhook URL in `.env.local` or Vercel:

```text
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

Then create a Slack connector with:

```text
type = slack
secret_ref = env:SLACK_WEBHOOK_URL
auth_type = none
```

The database stores only the `env:` reference. The real secret stays in backend environment variables.

## Demo Script

For a full production demo validation path, see:

```text
docs/qa-checklist.md
```

1. Sign in as a requester and create a new case from `/new-request`.
2. Show that the case is persisted and visible in `/cases`.
3. Sign in as reviewer or admin and run AI analysis from the case detail page.
4. Show risk classification, missing information, policy citations, and audit events.
5. Request more information or approve the case from `/review`.
6. Match or create a governed workflow template from `/workflows`.
7. Create a workflow run only after approval.
8. Execute the run through a mock connector or configured webhook.
9. Show execution attempts, retry/cancel behavior, and audit logs.
10. Open `/audit` to explain observability, AI traces, failure signals, and RAG evaluation samples.

## Interview Wording

The key architecture decision is to separate AI reasoning from workflow execution. FlowPilot AI lets AI structure messy requests, classify risk, retrieve policy evidence, and propose next steps. But execution is governed by deterministic validation, role-based access, human review, approved workflow templates, backend-only connectors, and audit logs.

This makes the system different from a generic chatbot or automation tool: AI assists the decision process, while the platform controls authorization, handoff, execution, and traceability.
