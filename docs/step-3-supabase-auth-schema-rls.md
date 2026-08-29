# Step 3: Supabase Auth, Workspace Roles, Schema, And RLS

## Current Status

中文：
Step 3 正在进行中。当前项目已经加入 Supabase Auth 的前端入口、服务端 Supabase helper、数据库 schema、workspace/profile 自动创建 trigger，以及 RLS 权限规则。

English:
Step 3 is in progress. The project now has Supabase Auth entry points, server/client Supabase helpers, the database schema, automatic workspace/profile creation, and RLS policies.

## Files That Belong To Step 3

```text
.env.example
lib/supabase/client.ts
lib/supabase/server.ts
lib/supabase/middleware.ts
lib/supabase/types.ts
app/login/page.tsx
app/signup/page.tsx
app/auth/callback/route.ts
app/auth/sign-out/route.ts
proxy.ts
supabase/migrations/202608280001_initial_schema.sql
docs/step-3-supabase-auth-schema-rls.md
```

中文：
没有保留临时验证脚本或开发重置 SQL。重置数据库属于危险操作，应该在确认后手动执行，不应该作为常驻项目文件。

English:
Temporary verification scripts and development reset SQL are not kept in the repository. Database reset is risky and should be done manually only after confirmation.

## Why This Step Exists

中文：
FlowPilot AI 是企业内部请求治理系统，不只是一个前端 demo。用户、workspace、角色和数据库权限必须先立住，否则后面的 case、review queue、policy evidence、workflow handoff 都没有真实安全边界。

English:
FlowPilot AI is an internal workflow governance system, not just a frontend demo. Users, workspaces, roles, and database permissions must be established first, otherwise cases, review queues, policy evidence, and workflow handoffs have no real security boundary.

## What The Schema Covers

中文：
主迁移文件创建这些核心对象：

```text
workspaces
profiles
cases
actions
policies
policy_chunks
connectors
workflow_templates
workflow_template_proposals
workflow_runs
execution_attempts
audit_logs
ai_traces
```

English:
The main migration creates the core business objects above.

## Role Model

中文：
- `requester`: 提交 request，只能读取自己创建的 private cases。
- `reviewer`: 处理 review queue，审核高风险或信息不完整的 case。
- `admin`: 管理 policies、workflow templates、connectors、roles 和 AI traces。

English:
- `requester`: submits requests and can only read their own private cases.
- `reviewer`: handles the review queue and reviews risky or incomplete cases.
- `admin`: manages policies, workflow templates, connectors, roles, and AI traces.

## RLS Design

中文：
- 所有业务表启用 Row Level Security。
- 用户只能访问自己 workspace 内的数据。
- requester 只能读取自己创建的 cases。
- reviewer/admin 可以读取 review 和 execution 相关数据。
- admin 才能管理 policy、workflow template、connector 和 AI trace。
- connector secret 不放进浏览器，未来只保存 `secret_ref`。

English:
- Row Level Security is enabled on all business tables.
- Users can only access data inside their own workspace.
- Requesters can only read cases they created.
- Reviewers/admins can access review and execution data.
- Only admins can manage policies, workflow templates, connectors, and AI traces.
- Connector secrets are not exposed to the browser; future stages store only `secret_ref`.

## How To Apply The SQL

中文：
在 Supabase Dashboard 里：

1. 打开你的 Supabase project。
2. 进入 SQL Editor。
3. 打开本项目文件：

```text
supabase/migrations/202608280001_initial_schema.sql
```

4. 全选并复制完整 SQL。
5. 粘贴到 Supabase SQL Editor。
6. 点击 Run。

English:
In the Supabase Dashboard:

1. Open your Supabase project.
2. Go to SQL Editor.
3. Open this local file:

```text
supabase/migrations/202608280001_initial_schema.sql
```

4. Copy the full SQL.
5. Paste it into Supabase SQL Editor.
6. Click Run.

## If You See `type already exists`

中文：
如果出现：

```text
ERROR: 42710: type "user_role" already exists
```

说明 SQL 已经运行过一部分，或者你重复从第一行运行了 migration。不要盲目运行重置脚本。正确处理方式是：

1. 先看 Supabase Table Editor 里是否已经有 `workspaces`、`profiles`、`cases` 等表。
2. 如果核心表都存在，通常不用重跑完整 SQL。
3. 如果只创建了一部分对象，要先确认这是开发库，不是生产库。
4. 需要清空开发库时，再手动写 drop 语句或让我现场生成一次性 SQL，不把 reset 文件长期放在项目里。

English:
If you see the error above, the migration probably ran partially or was rerun from the beginning. Do not blindly run a reset script. First check whether the core tables already exist. If only part of the schema exists, confirm it is a development database before manually cleaning it up. Reset SQL should be generated only when needed, not stored permanently in the project.

## Local Environment

中文：
本地需要 `.env.local`，但不要提交它：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

English:
Local development needs `.env.local`, but it must not be committed.

## Acceptance Criteria

中文：
Step 3 完成前，需要验证：

- 用户可以 sign up。
- 用户可以 sign in。
- 新用户会自动创建 workspace。
- 新用户会自动创建 profile。
- RLS 能阻止 requester 读取别人的 private cases。
- reviewer/admin 权限能读取 review/execution 数据。
- service role key 没有暴露到浏览器。

English:
Before Step 3 is complete, verify sign up, sign in, automatic workspace/profile creation, RLS isolation, reviewer/admin access, and that the service role key is never exposed to the browser.

## Interview Wording

中文面试说法：
我在 Step 3 先建立 Supabase 的 workspace、role 和 RLS 基础层。原因是 FlowPilot AI 是企业内部 workflow governance 工具，权限不能只靠前端隐藏按钮。真正的安全边界必须落在数据库 RLS 和后端执行层。

English interview wording:
In Step 3, I built the Supabase workspace, role, and RLS foundation first. FlowPilot AI is an internal workflow governance platform, so permissions cannot rely on hiding frontend buttons. The real security boundary must be enforced at the database RLS layer and the backend execution layer.
