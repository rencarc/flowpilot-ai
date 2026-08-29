create extension if not exists "pgcrypto";
create extension if not exists "vector";

create type public.user_role as enum ('requester', 'reviewer', 'admin');
create type public.risk_level as enum ('low', 'medium', 'high');
create type public.case_status as enum (
  'new',
  'analyzing',
  'needs_info',
  'policy_evidence_missing',
  'in_review',
  'approved',
  'rejected',
  'ready_to_run',
  'running',
  'failed',
  'completed',
  'closed',
  'ai_output_invalid',
  'no_template_match'
);
create type public.action_status as enum ('pending', 'in_review', 'approved', 'done', 'rejected', 'changes_requested');
create type public.workflow_lifecycle_status as enum ('approved', 'active', 'deprecated', 'disabled');
create type public.proposal_status as enum ('draft', 'under_review', 'approved', 'rejected', 'converted');
create type public.connector_type as enum ('mock_internal_api', 'custom_webhook', 'internal_api', 'n8n', 'make', 'pipedream', 'slack', 'email', 'jira', 'service_now', 'power_automate');
create type public.connector_auth_type as enum ('none', 'bearer_token', 'api_key_header', 'hmac_signature', 'basic_auth');
create type public.workflow_run_status as enum ('pending', 'queued', 'running', 'succeeded', 'failed', 'retrying', 'cancelled');
create type public.execution_attempt_status as enum ('pending', 'running', 'succeeded', 'failed', 'timeout');
create type public.actor_type as enum ('user', 'ai', 'system', 'connector');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'requester',
  created_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  raw_request text not null,
  summary text,
  requester text,
  department text,
  category text,
  priority text,
  risk_level public.risk_level,
  status public.case_status not null default 'new',
  confidence_score numeric(4, 3),
  missing_information jsonb not null default '[]'::jsonb,
  ai_output jsonb,
  human_review_required boolean not null default true,
  policy_evidence_status text not null default 'not_checked',
  matched_workflow_template_id uuid,
  workflow_template_proposal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  action_type text not null,
  status public.action_status not null default 'pending',
  owner_role public.user_role not null default 'reviewer',
  requires_review boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  source_type text not null default 'manual',
  source_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.policy_chunks (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (policy_id, chunk_index)
);

create table public.connectors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  type public.connector_type not null default 'mock_internal_api',
  endpoint_url text,
  auth_type public.connector_auth_type not null default 'none',
  secret_ref text,
  headers jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  category text not null,
  trigger_condition text not null,
  required_fields jsonb not null default '[]'::jsonb,
  risk_level public.risk_level not null default 'medium',
  requires_review boolean not null default true,
  payload_schema jsonb not null default '{}'::jsonb,
  connector_id uuid references public.connectors(id),
  active boolean not null default false,
  version integer not null default 1,
  lifecycle_status public.workflow_lifecycle_status not null default 'approved',
  created_from_proposal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workflow_template_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_case_id uuid references public.cases(id) on delete set null,
  proposed_by_ai_trace_id text,
  name text not null,
  description text,
  category text not null,
  trigger_condition text not null,
  required_fields jsonb not null default '[]'::jsonb,
  risk_level public.risk_level not null default 'medium',
  requires_review boolean not null default true,
  suggested_steps jsonb not null default '[]'::jsonb,
  payload_schema jsonb not null default '{}'::jsonb,
  connector_type_suggestion public.connector_type,
  policy_evidence jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  status public.proposal_status not null default 'draft',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cases
  add constraint cases_matched_template_fk foreign key (matched_workflow_template_id) references public.workflow_templates(id),
  add constraint cases_template_proposal_fk foreign key (workflow_template_proposal_id) references public.workflow_template_proposals(id);

alter table public.workflow_templates
  add constraint workflow_templates_created_from_proposal_fk foreign key (created_from_proposal_id) references public.workflow_template_proposals(id);

create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  workflow_template_id uuid not null references public.workflow_templates(id),
  connector_id uuid references public.connectors(id),
  status public.workflow_run_status not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.execution_attempts (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  attempt_number integer not null,
  status public.execution_attempt_status not null default 'pending',
  request_payload jsonb not null default '{}'::jsonb,
  response_status integer,
  response_body jsonb,
  error_message text,
  latency_ms integer,
  created_at timestamptz not null default now(),
  unique (workflow_run_id, attempt_number)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid,
  actor_type public.actor_type not null default 'system',
  case_id uuid references public.cases(id) on delete set null,
  workflow_run_id uuid references public.workflow_runs(id) on delete set null,
  event_type text not null,
  event_summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_traces (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  trace_id text,
  prompt_version text not null,
  model text not null,
  input_hash text not null,
  output_valid boolean not null default false,
  latency_ms integer,
  token_input integer,
  token_output integer,
  estimated_cost numeric(12, 6),
  error_message text,
  created_at timestamptz not null default now()
);

create index profiles_user_id_idx on public.profiles(user_id);
create index profiles_workspace_id_idx on public.profiles(workspace_id);
create index cases_workspace_id_idx on public.cases(workspace_id);
create index cases_created_by_idx on public.cases(created_by);
create index actions_case_id_idx on public.actions(case_id);
create index audit_logs_workspace_id_created_at_idx on public.audit_logs(workspace_id, created_at desc);
create index workflow_runs_case_id_idx on public.workflow_runs(case_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cases_set_updated_at before update on public.cases for each row execute function public.set_updated_at();
create trigger actions_set_updated_at before update on public.actions for each row execute function public.set_updated_at();
create trigger connectors_set_updated_at before update on public.connectors for each row execute function public.set_updated_at();
create trigger workflow_templates_set_updated_at before update on public.workflow_templates for each row execute function public.set_updated_at();
create trigger workflow_template_proposals_set_updated_at before update on public.workflow_template_proposals for each row execute function public.set_updated_at();
create trigger workflow_runs_set_updated_at before update on public.workflow_runs for each row execute function public.set_updated_at();

create or replace function public.current_workspace_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from public.profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and workspace_id = target_workspace_id
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles public.user_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and workspace_id = target_workspace_id
      and role = any(allowed_roles)
  );
$$;

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.actions enable row level security;
alter table public.policies enable row level security;
alter table public.policy_chunks enable row level security;
alter table public.connectors enable row level security;
alter table public.workflow_templates enable row level security;
alter table public.workflow_template_proposals enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.execution_attempts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ai_traces enable row level security;

create policy "members can read their workspaces"
on public.workspaces for select
using (public.is_workspace_member(id));

create policy "members can read profiles in their workspace"
on public.profiles for select
using (public.is_workspace_member(workspace_id));

create policy "admins can manage profiles in their workspace"
on public.profiles for all
using (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]))
with check (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]));

create policy "requesters can create their own cases"
on public.cases for insert
with check (created_by = auth.uid() and public.is_workspace_member(workspace_id));

create policy "requesters can read own cases"
on public.cases for select
using (created_by = auth.uid() or public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]));

create policy "reviewers and admins can update cases"
on public.cases for update
using (public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]))
with check (public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]));

create policy "members can read actions"
on public.actions for select
using (
  public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[])
  or exists (select 1 from public.cases c where c.id = case_id and c.created_by = auth.uid())
);

create policy "reviewers and admins can manage actions"
on public.actions for all
using (public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]))
with check (public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]));

create policy "members can read policies and chunks"
on public.policies for select
using (public.is_workspace_member(workspace_id));

create policy "admins can manage policies"
on public.policies for all
using (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]))
with check (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]));

create policy "members can read policy chunks"
on public.policy_chunks for select
using (public.is_workspace_member(workspace_id));

create policy "admins can manage policy chunks"
on public.policy_chunks for all
using (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]))
with check (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]));

create policy "members can read workflow templates"
on public.workflow_templates for select
using (public.is_workspace_member(workspace_id));

create policy "admins can manage workflow templates"
on public.workflow_templates for all
using (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]))
with check (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]));

create policy "members can read workflow proposals"
on public.workflow_template_proposals for select
using (public.is_workspace_member(workspace_id));

create policy "admins can manage workflow proposals"
on public.workflow_template_proposals for all
using (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]))
with check (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]));

create policy "admins can manage connectors"
on public.connectors for all
using (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]))
with check (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]));

create policy "reviewers and admins can read workflow runs"
on public.workflow_runs for select
using (public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]));

create policy "reviewers and admins can manage workflow runs"
on public.workflow_runs for all
using (public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]))
with check (public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]));

create policy "reviewers and admins can read execution attempts"
on public.execution_attempts for select
using (public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]));

create policy "reviewers and admins can manage execution attempts"
on public.execution_attempts for all
using (public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]))
with check (public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]));

create policy "members can read audit logs"
on public.audit_logs for select
using (public.is_workspace_member(workspace_id));

create policy "system and admins can insert audit logs"
on public.audit_logs for insert
with check (public.is_workspace_member(workspace_id));

create policy "admins can read ai traces"
on public.ai_traces for select
using (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]));

create policy "admins can manage ai traces"
on public.ai_traces for all
using (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]))
with check (public.has_workspace_role(workspace_id, array['admin']::public.user_role[]));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.workspaces (name)
  values (coalesce(new.raw_user_meta_data ->> 'workspace_name', 'My FlowPilot Workspace'))
  returning id into new_workspace_id;

  insert into public.profiles (user_id, workspace_id, full_name, role)
  values (
    new.id,
    new_workspace_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'requester'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
