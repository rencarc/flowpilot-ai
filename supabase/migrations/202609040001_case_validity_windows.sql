alter table public.cases
  add column if not exists due_at timestamptz,
  add column if not exists access_expires_at timestamptz;

create index if not exists cases_due_at_idx on public.cases(workspace_id, due_at)
where due_at is not null;

create index if not exists cases_access_expires_at_idx on public.cases(workspace_id, access_expires_at)
where access_expires_at is not null;
