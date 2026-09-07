# FlowPilot AI Interview Talk Track

## 30-Second Pitch

### Chinese

FlowPilot AI 是一个面向公司内部运营请求的 AI 治理和工作流交接系统。它不是普通 ticket system，也不是 Make 或 Power Automate 的替代品。它做的是自动化之前的控制层：把模糊请求结构化，检索政策依据，判断风险和缺失信息，高风险进入人工审核，只有通过审核并匹配到已批准的 workflow template 后，后端 connector 才会执行外部 handoff。

### English

FlowPilot AI is a governed AI intake and workflow handoff platform for internal operations. It is not just a ticket system or a Make/Power Automate clone. It sits before automation: it structures messy requests, retrieves policy evidence, classifies risk, detects missing information, routes high-risk work to human review, and only executes backend connector handoffs after approval and an approved workflow template match.

## 2-Minute Project Explanation

### Chinese

我做这个项目是为了模拟企业里一个很常见的问题：员工或运营团队经常用自然语言提出请求，比如临时 payroll admin access、vendor bank detail change、employee data export 或 contract renewal。传统 ticket 系统只能存下来，但不能判断这个请求是否安全、缺什么信息、应该走哪个流程。

FlowPilot AI 的流程是：

```text
requester 创建 case
-> AI structured output
-> RAG policy citation
-> risk 和 missing info 判断
-> high-risk human review
-> approved workflow template match
-> workflow run queued
-> backend connector execute
-> execution attempt saved
-> audit logs / Langfuse trace
```

AI 在系统里负责理解和建议，不负责最终授权。比如 AI 可以判断 payroll admin access 是 high risk，并引用 policy 说明为什么需要 manager approval 和 expiration date。但 AI 不能直接批准，也不能直接调用外部系统。

外部执行部分我用 Make webhook + Google Sheets/Discord 做 demo。Google Sheets 不是产品目的，它只是证明 approved workflow handoff 真的发到了外部系统。真正的产品价值是前面的 governance layer：policy evidence、human gate、approved templates、connector execution tracking 和 auditability。

### English

I built this project to simulate a real internal operations problem: employees often submit unclear requests in natural language, such as temporary payroll admin access, vendor bank detail changes, employee data exports, or contract renewals. A normal ticket system can store the request, but it does not decide whether the request is safe, what information is missing, or which approved workflow should handle it.

The core flow is:

```text
requester creates case
-> AI structured output
-> RAG policy citation
-> risk and missing-info classification
-> high-risk human review
-> approved workflow template match
-> workflow run queued
-> backend connector execution
-> execution attempt saved
-> audit logs / Langfuse trace
```

AI is used for reasoning and recommendation, not final authorization. For example, it can classify payroll admin access as high risk and cite a policy requiring manager approval and expiration. But AI cannot approve the request or directly call external systems.

For the external execution demo, I integrated Make webhook with Google Sheets and optional Discord notification. Google Sheets is not the product goal; it proves that an approved workflow handoff can leave FlowPilot and reach a real external system. The real product value is the governance layer before that handoff: policy evidence, human review, approved workflow templates, connector tracking, retries, and audit logs.

## Architecture Talking Points

### Chinese

- Frontend: Next.js App Router + TypeScript，业务页面包括 cases、review queue、workflows、knowledge、settings、audit logs。
- Auth/database: Supabase Auth、workspace profile、requester/reviewer/admin 角色、RLS 保护 workspace 数据。
- AI: OpenAI structured output，把自然语言 case 转成 JSON，并在应用层再次校验。
- RAG: policy chunks + pgvector semantic search，给 AI 判断提供 policy citations。
- Workflow governance: AI 可以推荐或生成 proposal，但只有 admin-approved templates 可以执行。
- Connector layer: backend-only adapters，包括 mock internal API、custom webhook、Make webhook、Slack webhook。
- Execution: workflow runs 记录 queued/running/succeeded/failed/cancelled，execution attempts 记录 HTTP response、latency、error、retry count。
- Observability: audit logs 记录每个关键状态变化，Langfuse 用于 AI trace。

### English

- Frontend: Next.js App Router and TypeScript for cases, review queue, workflows, knowledge, settings, and audit logs.
- Auth/database: Supabase Auth, workspace profiles, requester/reviewer/admin roles, and RLS for workspace isolation.
- AI: OpenAI structured output converts natural language cases into validated JSON.
- RAG: policy chunks and pgvector semantic search provide citations for risk and missing-info decisions.
- Workflow governance: AI can recommend or draft proposals, but only admin-approved templates are executable.
- Connector layer: backend-only adapters for mock internal API, custom webhook, Make webhook, and Slack webhook.
- Execution: workflow runs track queued/running/succeeded/failed/cancelled states; execution attempts store HTTP response, latency, error, and retry data.
- Observability: audit logs capture state changes, and Langfuse can store AI traces.

## How AI Is Used

### Chinese

AI 一共用在这些地方：

- Structured analysis: 总结请求、判断 case type、risk level、missing information。
- Embedding/RAG: 把 case 和 policy 转成向量，找相关政策片段。
- Policy-grounded reasoning: 用 policy citation 解释为什么高风险或缺信息。
- Workflow recommendation: 根据 case 内容推荐 approved workflow template。
- Workflow proposal draft: 没有模板时生成不可执行的 proposal，等待 admin 转换。

为了省成本，系统不在用户提交瞬间自动调用 OpenAI。用户提交只是保存 case。reviewer/admin 触发 AI analysis 后，才调用模型。这样避免垃圾请求或测试请求浪费 token。

### English

AI is used in these controlled areas:

- Structured analysis: summarize the request, classify case type, risk level, and missing information.
- Embedding/RAG: convert case and policy text into vectors to retrieve relevant policy chunks.
- Policy-grounded reasoning: use citations to explain why a case is risky or incomplete.
- Workflow recommendation: recommend an approved workflow template.
- Workflow proposal draft: create a non-executable proposal when no template matches.

To control cost, the app does not call OpenAI immediately on every user submission. Creating a case only persists the request. A reviewer/admin triggers AI analysis when needed, which avoids spending tokens on spam, drafts, or accidental submissions.

## Why RAG Matters

### Chinese

RAG 的意义不是单纯搜索，而是让 AI 的判断有证据。没有 RAG，AI 只能说“我认为这是 high risk”。有了 RAG，它可以说“根据 Privileged Access Approval Policy，临时 payroll admin access 需要 manager approval、least privilege 和 expiration date，所以这个 case 是 high risk/needs info。”

### English

RAG is not just search. It makes AI decisions evidence-backed. Without RAG, the model can only say, "I think this is high risk." With RAG, it can say, "According to the privileged access policy, temporary payroll admin access requires manager approval, least privilege, and expiration, so this case is high risk or needs more information."

## Why Make And Google Sheets

### Chinese

Make/Google Sheets 不是系统的核心目标，只是一个低成本、可视化的 external execution demo。它证明 FlowPilot 不是只在页面里显示 succeeded，而是真的把 approved workflow payload 发到了外部系统。

生产环境里，目标系统可以换成 Jira、ServiceNow、Power Automate、IAM、HRIS、procurement system、Slack、email 或内部 API。

### English

Make and Google Sheets are not the core product goal. They are a low-cost, visible external execution demo. They prove that FlowPilot does not only show "succeeded" in the UI; it actually sends an approved workflow payload to an external system.

In production, the destination could be Jira, ServiceNow, Power Automate, IAM, HRIS, procurement systems, Slack, email, or internal APIs.

## Common Interview Questions

### 1. Is this just a ticket system?

Chinese:

不是。ticket system 主要存储请求和评论。FlowPilot 在 ticket 之前或之上增加了 AI governance：结构化请求、政策检索、风险判断、缺失信息检测、人工审核、approved workflow template 和 connector execution tracking。

English:

No. A ticket system mainly stores requests and comments. FlowPilot adds an AI governance layer: structured intake, policy retrieval, risk classification, missing-info detection, human review, approved workflow templates, and connector execution tracking.

### 2. Why not just use Make, n8n, or Power Automate?

Chinese:

Make/n8n/Power Automate 是执行层。FlowPilot 是执行之前的治理层。它决定一个请求是否完整、是否高风险、是否有政策依据、是否需要人工审批，以及是否能匹配 approved workflow。

English:

Make, n8n, and Power Automate are execution layers. FlowPilot is the governance layer before execution. It decides whether a request is complete, risky, policy-supported, reviewed, and allowed to match an approved workflow.

### 3. Can AI execute workflows directly?

Chinese:

不能。AI 可以建议、结构化、检索政策、生成 proposal，但不能绕过 reviewer/admin，也不能直接调用生产 connector。执行必须通过 backend server action、approved template、role check 和 audit log。

English:

No. AI can recommend, structure, retrieve policy evidence, and draft proposals, but it cannot bypass reviewers/admins or call production connectors directly. Execution must go through backend server actions, approved templates, role checks, and audit logs.

### 4. What happens for low-risk cases?

Chinese:

低风险 case 可以更快流转。现在逻辑是：AI 分析后，如果有 policy evidence、无缺失信息、risk 是 low，并且匹配到 approved workflow template，系统会自动 approve/match，但不会让 AI 直接执行外部系统。

English:

Low-risk cases can move faster. After AI analysis, if policy evidence exists, no required information is missing, risk is low, and an approved template matches, the system can auto-approve and auto-match the case. It still does not let AI directly execute external systems.

### 5. What happens when no workflow matches?

Chinese:

系统可以创建 AI workflow proposal，但 proposal 不能执行。admin 必须审核并转换成 approved workflow template，后续类似 case 才能匹配和执行。

English:

The system can create an AI workflow proposal, but proposals are not executable. An admin must review and convert the proposal into an approved workflow template before future similar cases can use it.

### 6. How do you handle connector failures?

Chinese:

workflow run 有状态和 execution attempts。失败时记录 HTTP status、response body、latency、error message、failure reason，并支持 retry/cancel。mock connector 还可以强制失败，用来演示失败路径。

English:

Workflow runs and execution attempts track failures. The app records HTTP status, response body, latency, error message, failure reason, and supports retry/cancel. The mock connector can force a failure to demonstrate the failure path.

### 7. How is data protected?

Chinese:

Supabase RLS 做数据库层隔离。requester 只能看自己的 case，reviewer/admin 才能看审核和执行数据。server actions 也会重新检查角色权限。connector secrets 只存 env reference，不把真实 secret 暴露到前端。

English:

Supabase RLS enforces database-level isolation. Requesters can only see their own cases, while reviewers/admins can access review and execution data. Server actions re-check role permissions. Connector secrets are stored as env references, not exposed to the frontend.

## Strong Closing

### Chinese

这个项目的核心不是自动化本身，而是自动化之前的安全决策层。它展示了我能把 AI structured output、RAG、RBAC/RLS、human-in-the-loop、workflow templates、backend connectors、execution tracking 和 audit logs 组合成一个接近真实企业场景的系统。

### English

The core of this project is not automation itself; it is the safety and governance layer before automation. It demonstrates how I combine AI structured output, RAG, RBAC/RLS, human-in-the-loop review, workflow templates, backend connectors, execution tracking, and audit logs into a realistic enterprise-style system.

