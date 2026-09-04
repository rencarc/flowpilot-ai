# FlowPilot AI Architecture

## Core Idea

FlowPilot AI separates AI reasoning from production execution.

AI can structure messy requests, classify risk, retrieve policy evidence, detect missing information, and recommend next actions. It cannot approve high-risk work or execute production workflows by itself.

## System Flow

```text
requester intake
-> persisted case
-> OpenAI structured output
-> policy retrieval with pgvector RAG
-> risk and missing-info gates
-> reviewer/admin decision
-> approved workflow template match
-> backend connector execution
-> audit logs and Langfuse traces
```

## Main Boundaries

- Database boundary: Supabase RLS limits requester, reviewer, and admin access.
- AI boundary: model output is schema-constrained and validated before state changes.
- Review boundary: high-risk or incomplete cases must pass human review.
- Execution boundary: only backend server actions can run connector handoffs.
- Secret boundary: connectors store `env:` references; raw secrets stay in Vercel or `.env.local`.

## Why This Architecture

FlowPilot is not a chatbot because it persists cases, validates AI output, attaches policy citations, records decisions, and blocks unsafe handoffs.

FlowPilot is not a ticket system because it adds risk classification, policy retrieval, missing-info detection, and controlled workflow execution before a request becomes operational work.

FlowPilot is not an n8n/Zapier clone because it decides whether execution should be allowed. Automation tools execute workflows; FlowPilot governs the intake and approval layer before execution.

## Failure Handling

- Missing OpenAI credits: case stays usable; AI analysis shows a clear error.
- Invalid AI output: case is marked `ai_output_invalid` and audit logs capture the failure.
- Missing policy evidence: case cannot move directly to handoff.
- Missing required fields: case enters `needs_info`.
- Connector failure: execution attempt stores status, latency, response, and failure reason.
- Duplicate execution: idempotency key prevents unsafe repeated handoffs.

## Interview Wording

> I designed FlowPilot around a governance boundary: AI can accelerate triage and recommendations, but authorization and execution remain deterministic. Supabase RLS protects workspace data, structured output validation treats AI as untrusted input, reviewers approve high-risk work, and backend-only connectors perform the final handoff with auditability.

