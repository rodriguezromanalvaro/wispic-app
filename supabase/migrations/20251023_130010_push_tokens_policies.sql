-- Ensure proper RLS policies for public.push_tokens so users can insert/select/update/delete their own tokens

-- Enable RLS (safe if already enabled)
alter table if exists public.push_tokens enable row level security;

-- Drop any previous policies that may conflict
drop policy if exists insert_own_token on public.push_tokens;
drop policy if exists select_own_tokens on public.push_tokens;
drop policy if exists update_own_token on public.push_tokens;
drop policy if exists delete_own_token on public.push_tokens;
-- Drop any generic Studio-generated policies if they exist
do $$ begin
  if exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'push_tokens' and p.policyname like 'rls_push_tokens_%'
  ) then
    execute (
      select string_agg(format('drop policy if exists %I on public.push_tokens', p.policyname), '; ')
      from pg_policies p
      where p.schemaname = 'public' and p.tablename = 'push_tokens' and p.policyname like 'rls_push_tokens_%'
    );
  end if;
end $$;

-- Only allow the authenticated user to manage their own tokens
create policy insert_own_token on public.push_tokens
  for insert
  with check (user_id = auth.uid());

create policy select_own_tokens on public.push_tokens
  for select
  using (user_id = auth.uid());

create policy update_own_token on public.push_tokens
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy delete_own_token on public.push_tokens
  for delete
  using (user_id = auth.uid());
