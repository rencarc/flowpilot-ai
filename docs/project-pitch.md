# FlowPilot AI Project Pitch

## Chinese Explanation

FlowPilot AI is not a spreadsheet automation tool and it is not a Make or Power Automate clone.

It is an AI governance layer before workflow execution.

The product goal is:

```text
unclear internal request
-> structured case
-> policy evidence
-> risk decision
-> missing information check
-> human review when needed
-> approved workflow template
-> backend connector execution
-> audit trail
```

In Chinese:

```text
FlowPilot AI 把公司内部模糊请求变成可审核、可追踪、可安全执行的工作流入口。
```

For example, an employee writes:

```text
Emma needs temporary admin access to the payroll system before Friday because payroll close is delayed.
```

FlowPilot does more than create a ticket. It structures the request, checks policy evidence, detects missing approval or expiration details, decides whether the request is high risk, routes it to human review, matches an approved workflow template, and only then sends a controlled payload to an external automation system.

Google Sheets is only a demo destination. It proves that the approved handoff actually left FlowPilot and reached an external system.

The real product value is the controlled decision layer:

```text
Should this request be executed?
Who approved it?
What policy evidence supported the decision?
What workflow template was allowed?
What connector ran?
What happened after execution?
```

## What AI Does

AI is used for reasoning and drafting, not direct authorization.

AI can:

- summarize messy requests
- classify case type and risk
- detect missing information
- retrieve policy evidence through RAG
- recommend an approved workflow template
- draft a workflow template proposal when no template matches

AI cannot:

- approve high-risk requests
- bypass reviewer or admin controls
- directly call external production systems
- execute workflow proposals before admin approval

## Why Policy Citations Matter

Policy citations make the AI decision explainable.

Without policy evidence, the system would only say:

```text
This looks high risk.
```

With policy evidence, it can say:

```text
This is high risk because temporary admin access to payroll systems requires manager approval, least privilege, expiration, and authorized review.
```

That matters for governance, auditability, and trust. A reviewer can see why the AI made a recommendation and whether the request is missing required information.

## Low-Risk And High-Risk Logic

High-risk requests require human review.

Examples:

- payroll or HR admin access
- vendor bank details change
- employee data export
- production system change
- security exception

Low-risk requests can be processed faster when they meet safe conditions:

- AI output is valid
- policy check does not block the case
- no required information is missing
- an approved workflow template is matched
- the connector is enabled
- audit logging is recorded

The design principle is:

```text
low-risk work can move faster; high-risk work must pass a human gate.
```

## Workflow Templates And Proposals

Workflow templates are approved execution patterns.

Examples:

- Payroll access review
- Vendor bank change verification
- Contract review and legal approval
- Employee data export review
- Security exception review

If no approved template matches a case, FlowPilot can create an AI workflow proposal.

That proposal is not executable. It is a draft that an admin must review and convert into an approved workflow template.

This avoids letting AI invent a new production workflow and execute it immediately.

## Connector Execution

After a case is approved and matched to an approved workflow template, FlowPilot can create a workflow run.

The connector layer executes from the backend only.

Implemented connector paths:

- Mock enterprise API for reliable demo and fallback
- Custom webhook for generic integrations
- Make webhook for a real external automation demo
- Slack webhook for direct notification

The Make demo is:

```text
FlowPilot approved workflow run
-> Make custom webhook
-> Google Sheets row
-> optional Discord notification
```

This proves real external handoff. It does not mean the product is only for spreadsheets.

## Interview Pitch

FlowPilot AI is a governed AI intake and workflow handoff platform for internal business operations. It uses AI to structure unclear employee requests, retrieve policy evidence, classify risk, and recommend the right workflow, but execution is controlled by role permissions, human review, approved workflow templates, backend-only connectors, and audit logs.

The key architecture decision is separating AI reasoning from execution. AI helps decide what should happen, but the platform controls whether it is allowed to happen.

## Resume Bullet

Built FlowPilot AI, a governed AI workflow handoff platform using Next.js, TypeScript, Supabase, OpenAI structured outputs, pgvector RAG, RBAC/RLS, human-in-the-loop review, connector adapters, execution tracking, retries, and audit logs, integrating approved workflow runs with Make webhooks for external automation.

