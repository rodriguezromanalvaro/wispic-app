-- RPC functions for joining and leaving events atomically, bypassing client-side RLS limitations via SECURITY DEFINER.
-- NOTE: Ensure only intended roles have EXECUTE privilege.

create or replace function public.join_event(p_event int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into event_attendance(event_id, user_id, status)
  values (p_event, auth.uid(), 'going')
  on conflict (event_id, user_id) do update set status = 'going';
end;
$$;

grant execute on function public.join_event(int) to authenticated;

create or replace function public.leave_event(p_event int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from event_attendance
  where event_id = p_event
    and user_id = auth.uid();
end;
$$;

grant execute on function public.leave_event(int) to authenticated;
