alter table public.policies
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id);

create index if not exists policies_workspace_archived_idx
on public.policies(workspace_id, archived_at);
