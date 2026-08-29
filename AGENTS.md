# FlowPilot AI Codex Project Guidance

## Workspace Safety

- The source of truth is `D:\PROJECTS\flowpilot-ai`.
- Before changing files, verify the working directory with `Get-Location` (PowerShell) or `pwd`.
- If the directory is not `D:\PROJECTS\flowpilot-ai`, stop and tell the user to reopen the correct workspace.
- Do not use `C:\Users\79834\Documents\Codex\...` as the project source. It is an old temporary workspace.
- Never overwrite or revert user changes that are unrelated to the current task.

## Project Status

- Current implementation: HTML + CSS + JavaScript + a small Node static server.
- Current entry points: `index.html`, `assets/app.js`, `assets/styles.css`, and `server.js`.
- The static prototype is the baseline. Preserve its behavior and visual direction while migrating.
- The next planned stage is Step 2: migrate the prototype to Next.js + TypeScript + Tailwind.
- Do not claim Step 2 is complete until all required routes render, TypeScript compiles, Tailwind is active, and the static prototype has been replaced.

## Product Definition

FlowPilot AI is an AI intake, risk-control, human-review, and workflow-handoff platform for internal business operations. It turns unclear employee and operations requests into structured, policy-aware, auditable handoffs.

The core flow is:

`raw request -> structured AI output -> policy retrieval/RAG -> risk classification -> missing information detection -> human review when needed -> approved workflow handoff -> execution tracking -> audit log`

This is not a chatbot, generic ticket system, Jira/ServiceNow clone, n8n/Make clone, or a system where AI directly executes unapproved production actions.

Non-negotiable safety rule: AI may suggest, structure, draft, and classify. AI must not bypass approval or directly execute an unapproved production workflow.

## UI Direction

Keep the established visual language; do not redesign it from scratch.

- Brand feeling: calm enterprise AI, forest green, trustworthy, controlled, operational, auditable, premium SaaS.
- Avoid purple AI-startup styling, crypto-dashboard styling, cartoon automation, and generic admin-dashboard treatment.
- Homepage: deep forest green mood, misty forest/mountain/lake background, cinematic lighting, glass workflow panel, elegant serif headline, simple navigation, visible FlowPilot AI logo, and subtle motion.
- Preserve the homepage headline: `Turn unclear requests into safe, auditable workflows.`
- Preserve the supporting copy: `FlowPilot AI structures messy employee and operations requests, checks policy rules, detects missing information, and routes approved handoffs to the right workflow template.`
- Interior pages: light green/ivory background, dark forest-green text, compact data-focused SaaS layout, clear sidebar, thin borders, restrained shadows, and approximately 8px card/button radius.
- Use compact, readable, business-focused cards. Do not nest cards or add decorative clutter.
- Buttons need clear hover/active states, a green primary action, and pale or outline secondary actions.
- Motion should be subtle: homepage drift, hover transitions, and button press feedback only.
- Preserve the correct logo direction: double green leaf with three white nodes. Do not replace it with a branch icon or an `F` icon.

## Engineering Rules

- Start each task by verifying the project path and inspecting the smallest relevant code surface.
- Prefer the existing project patterns and the smallest focused change.
- Keep AI output structured and validate it before saving or using it.
- Sensitive or incomplete requests must remain blocked or enter human review.
- Backend code must perform external workflow handoffs; do not put connector secrets or privileged calls in the browser.
- Record meaningful state changes, review decisions, AI results, and execution events in audit logs.
- Use `.env.local` for local secrets and never commit secrets. Maintain `.env.example` as the project grows.
- Explain implementation changes in Chinese and include concise English interview wording for important architecture decisions.

## Delivery Sequence

1. Confirm the current static prototype and local run path.
2. Migrate to Next.js + TypeScript + Tailwind while preserving the UI direction.
3. Add Supabase authentication, workspace roles, schema, and RLS.
4. Replace mock cases with persisted case data and audit logging.
5. Add an OpenAI backend route with validated structured output.
6. Add policy knowledge, pgvector retrieval, and source citations.
7. Add the human review workflow for high-risk and incomplete cases.
8. Add governed workflow templates and AI proposals; proposals cannot execute directly.
9. Add connectors, workflow runs, payload preview, idempotency, retry, and failure tracking.
10. Add Langfuse observability and RAG evaluation.
11. Add deployment, CI, README, interview materials, and end-to-end demos.

Work on one stage at a time. State which stage is active and do not silently skip acceptance criteria.

## Step 2 Route Checklist

The migrated app must render these routes without blank pages:

`/`, `/dashboard`, `/cases`, `/cases/[id]`, `/new-request`, `/review`, `/workflows`, `/knowledge`, `/audit`, `/settings`, `/architecture`

Verify that the logo and favicon are correct, the homepage direction is preserved, sidebar navigation works, mock data appears, TypeScript compiles, Tailwind styles are active, and the Architecture page includes Before/After and failure states.

## Validation

For the current prototype:

```powershell
Get-Location
npm run dev
```

Open `http://localhost:4173` and verify the homepage, dashboard, cases, new request, case detail, review queue, workflows, knowledge, audit logs, and settings.

For the Next.js migration, run `npm install` and `npm run dev`, then verify every Step 2 route and compile/typecheck output. Do not report completion from a command result alone when visual acceptance is required.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
