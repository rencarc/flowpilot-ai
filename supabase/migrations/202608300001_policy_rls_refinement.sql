drop policy if exists "members can read policies and chunks" on public.policies;
drop policy if exists "members can read policy chunks" on public.policy_chunks;

create policy "reviewers and admins can read policies"
on public.policies for select
using (public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]));

create policy "reviewers and admins can read policy chunks"
on public.policy_chunks for select
using (public.has_workspace_role(workspace_id, array['reviewer','admin']::public.user_role[]));
