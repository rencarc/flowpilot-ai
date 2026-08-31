create or replace function public.match_policy_chunks(
  query_embedding vector(1536),
  target_workspace_id uuid,
  match_count integer default 5
)
returns table (
  id uuid,
  policy_id uuid,
  workspace_id uuid,
  chunk_index integer,
  content text,
  metadata jsonb,
  created_at timestamptz,
  similarity double precision,
  policy_title text,
  policy_source_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    pc.id,
    pc.policy_id,
    pc.workspace_id,
    pc.chunk_index,
    pc.content,
    pc.metadata,
    pc.created_at,
    1 - (pc.embedding <=> query_embedding) as similarity,
    p.title as policy_title,
    p.source_url as policy_source_url
  from public.policy_chunks pc
  join public.policies p on p.id = pc.policy_id
  where pc.workspace_id = target_workspace_id
    and pc.embedding is not null
    and public.has_workspace_role(target_workspace_id, array['reviewer','admin']::public.user_role[])
  order by pc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;
