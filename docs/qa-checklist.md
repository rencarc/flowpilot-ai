# FlowPilot AI QA Checklist

Use this checklist before sending the demo link or recording a walkthrough. The goal is to prove one complete governed path from intake to audited execution.

## Environment

- Production URL opens: `https://flowpilot-ai-eta.vercel.app`
- Supabase Auth redirect URLs include the production domain.
- Vercel environment variables are present:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
  - `OPENAI_EMBEDDING_MODEL`
  - `LANGFUSE_PUBLIC_KEY`
  - `LANGFUSE_SECRET_KEY`
  - `LANGFUSE_HOST`
- Supabase migrations applied:
  - `202608280001_initial_schema.sql`
  - `202608300001_policy_rls_refinement.sql`
  - `202608310001_policy_vector_search.sql`
  - `202609040001_case_validity_windows.sql`
  - `202609040002_policy_archive.sql`

## Roles

- Requester account can sign in.
- Requester sees their email in the top bar.
- Requester can create and view their own cases.
- Requester cannot see admin-only connector controls.
- Reviewer or admin account can sign in.
- Reviewer or admin can run AI analysis and review cases.
- Admin can manage policies, workflows, connectors, and AI traces.

## Test Cases

Create at least three cases.

### Low Risk Case

Use:

```text
Please send me the latest onboarding checklist for the marketing team.
```

Expected:

- Risk is low or medium.
- No production connector execution is available until review gates are satisfied.
- Audit log records case creation and analysis.

### High Risk Access Case

Use:

```text
Emma needs temporary admin access to the payroll system before Friday because payroll close is delayed.
```

Expected:

- Risk is high.
- Human review is required.
- Missing information includes manager approval evidence or expiration evidence if not provided.
- If `Access expires at` is provided, expiration should appear on the case detail and handoff payload.
- Policy citations include access control, HR/payroll, security, or governance evidence.
- Agent tool steps appear:
  - `retrieve_policy`
  - `check_missing_fields`
  - `recommend_workflow_template`
  - `draft_handoff_payload`

### Complete Approval Case

Use:

```text
Emma from HR needs temporary admin access to the payroll system until Friday 18:00 to complete delayed payroll close. Manager approval was provided by Alex Chen in ticket HR-4281.
```

Expected:

- Risk is high.
- Required fields are present or mostly present.
- Reviewer can approve after checking policy evidence.
- Case can be matched to an approved workflow template.
- Workflow run can be queued only after approval and template match.

## Policy Knowledge And RAG

- `/knowledge` shows governance standards and company policy supplements clearly.
- Admin can add a company-specific policy.
- Admin can archive a company-specific policy from `/knowledge/company`.
- Admin can generate semantic embeddings.
- Success message says how many policy chunks were embedded.
- Case analysis shows policy citations with source names or URLs.
- `/audit` shows citation coverage and retrieval samples.

## Human Review

- Reviewer can approve a case.
- Reviewer can reject a case.
- Reviewer can request more information.
- Requester can submit missing information.
- Review decisions create audit events.
- High-risk cases never skip review automatically.
- Admin can archive a case from the case list.
- Admin can move a garbage or test case to trash from the case detail with a reason.
- Trashed cases disappear from the normal case list, while audit logs still show the action.

## Workflow Handoff

- Approved workflow templates are visible in `/workflows`.
- A case without a matching template can create a proposal.
- Admin can convert a proposal into an approved template.
- Admin can disable and re-enable a workflow template.
- A case can be matched to an approved template.
- Workflow run cannot be queued before case approval.
- Workflow run cannot be queued before template match.
- Workflow run payload preview does not expose secrets.
- Workflow run payload includes case due date and access expiration when provided.

## Connector Execution

- Mock connector can succeed.
- Mock connector can fail when payload includes `force_failure: true`.
- Failed run records failure reason.
- Failed run can be retried until retry limit.
- Running or queued run can be cancelled.
- Execution attempt is saved with status, latency, response status, and response body.
- Audit logs include connector execution events.

## Observability

- `/audit` opens for admin.
- AI traces are visible to admin only.
- Audit event stream shows case, review, policy, workflow, and connector events.
- Langfuse status is `configured` when env vars are present.
- After AI analysis, Langfuse contains a `case-ai-analysis` trace.
- Langfuse trace includes case input, compact output, prompt version, model, and validity metadata.

## Security Checks

- `.env.local` is not committed.
- `SUPABASE_SERVICE_ROLE_KEY` is not used in client components.
- Connector credentials are represented as secret references, not visible values.
- Requester cannot execute workflow runs.
- Requester cannot manage policies, workflows, connectors, or AI traces.
- RLS prevents cross-workspace data access.

## Demo Pass Criteria

The demo is ready when this flow succeeds end to end:

```text
requester creates case
-> admin/reviewer runs AI analysis
-> semantic RAG citations appear
-> missing info or risk gate appears
-> reviewer approves or requests information
-> approved workflow is matched
-> workflow run is queued
-> connector execution creates an attempt
-> audit logs show the full trail
-> Langfuse shows the AI analysis trace
```

## Known Boundaries

- Jira, ServiceNow, and Power Automate OAuth are future integrations.
- Enterprise vault integration is future work; current secret handling uses `secret_ref` and backend-only execution.
- The product is an intake and approval layer before execution, not a full workflow builder.
