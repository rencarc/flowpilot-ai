# FlowPilot AI Demo Script

Use this script for a short interview demo. Keep it focused on the governed workflow, not every button.

## 1. Product Boundary

Open:

```text
https://flowpilot-ai-eta.vercel.app
```

Say:

> FlowPilot AI turns unclear internal requests into structured, policy-aware, auditable workflow handoffs. The important rule is that AI can recommend, but it cannot approve or execute high-risk work by itself.

## 2. Create A Case

Open `/new-request` and create a case:

```text
Emma from HR needs temporary admin access to the payroll system until Friday 18:00 to complete delayed payroll close. Manager approval was provided by Alex Chen in ticket HR-4281.
```

Show:

- requester creates a persisted case
- due date and access expiration can be captured
- requester is not running admin-only actions

## 3. Run AI Analysis

Open the case as reviewer/admin and click `Analyze with AI`.

Show:

- structured summary
- case type
- risk level
- missing information
- matched rules
- agent tool steps
- policy citations with scores and sources

Say:

> I treat AI output as untrusted. The response is structured, validated, and saved only if it matches the expected schema.

## 4. Explain RAG

Point to policy citations.

Say:

> The system retrieves policy evidence before recommending a handoff. If no evidence is found, the case is blocked for review instead of silently moving forward.

## 5. Human Review

Open `/review` or the case detail review controls.

Show:

- approve
- reject
- request more information

Say:

> High-risk requests require a human decision. AI is not the authorization boundary.

## 6. Workflow Template

Open `/workflows`.

Show:

- approved workflow templates
- AI proposals
- admin conversion
- enable/disable controls

Say:

> AI can draft a workflow proposal, but only admin-approved templates become executable.

## 7. Workflow Run And Connector

Back on the approved case:

- match an approved workflow
- queue workflow run
- execute with mock or webhook connector
- show execution attempt, retry count, idempotency key, and failure reason if any

Say:

> Connector execution is backend-only. Secrets are represented as `env:` references and are never exposed in the browser.

## 8. Audit And Observability

Open `/audit`.

Show:

- case created
- AI classified case
- policy evidence found
- review decision
- workflow matched
- run queued
- connector succeeded or failed
- Langfuse trace status when configured

Say:

> The value is not just automation. The value is traceable, policy-aware automation that blocks unsafe execution.

## 9. Strong Close

Say:

> This project is a governed AI workflow layer for internal operations. It demonstrates RAG, structured outputs, RBAC/RLS, human-in-the-loop review, backend connector execution, retries, audit logs, and observability.

