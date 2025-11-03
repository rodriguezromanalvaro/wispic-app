-- Create or update weekly event series and roll forward occurrences
-- SECURITY: SECURITY DEFINER with explicit search_path; validates caller is active owner/manager of the venue.

set check_function_bodies = off;

-- Helper: roll a single series forward by N weeks (default 1)
create or replace function public.roll_series_forward(
  p_series_id bigint,
  p_horizon_weeks integer default 1,
  p_defaults jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series record;
  v_venue record;
  v_city_name text;
  v_inserted integer := 0;
  d date;
  date_from date;
  date_to date;
  dow_mon0 int;
  start_local timestamp without time zone;
  end_local timestamp without time zone;
  start_ts timestamptz;
  end_ts timestamptz;
  use_status text;
  use_cover text;
  use_is_free boolean;
  use_price_cents integer;
  use_currency text;
  use_ticket_url text;
begin
  -- Load series and venue context
  select s.*, v.id as v_id, v.name as v_name, v.city_id as v_city_id
    into v_series
  from public.event_series s
  join public.venues v on v.id = s.venue_id
  where s.id = p_series_id;

  if v_series.id is null then
    raise exception 'roll_series_forward: series % not found', p_series_id using errcode = 'P0002';
  end if;

  select name into v_city_name from public.cities where id = v_series.v_city_id;

  -- Determine horizon dates
  date_from := greatest(current_date, coalesce(v_series.start_date, current_date));
  date_to := least(coalesce(v_series.end_date, current_date + (p_horizon_weeks * 7)), current_date + (p_horizon_weeks * 7));

  -- Defaults precedence: explicit p_defaults > series defaults
  use_status := coalesce(nullif((p_defaults->>'status'), ''), 'published');
  use_cover := coalesce(nullif((p_defaults->>'cover_url'), ''), v_series.cover_url_default);
  use_is_free := coalesce((p_defaults->>'is_free')::boolean, v_series.is_free_default);
  use_price_cents := coalesce((p_defaults->>'price_cents')::int, v_series.price_cents_default);
  use_currency := coalesce(nullif((p_defaults->>'currency'), ''), v_series.currency_default);
  use_ticket_url := coalesce(nullif((p_defaults->>'ticket_url'), ''), v_series.ticket_url_default);

  -- Iterate each day and create events when matching selected weekdays
  for d in select generate_series(date_from, date_to, interval '1 day')::date loop
    -- Map Postgres dow (0=Sun..6=Sat) to our 0=Mon..6=Sun
    dow_mon0 := ((extract(dow from d)::int + 6) % 7);
    if v_series.days_of_week is not null and array_length(v_series.days_of_week,1) > 0 and dow_mon0 = any(v_series.days_of_week) then
      -- Build local start/end timestamps (handle overnight end by bumping a day when end <= start)
      if v_series.start_time is null then
        continue; -- cannot create without start time
      end if;
      start_local := (d::timestamp + v_series.start_time);
      if v_series.end_time is not null then
        end_local := (d::timestamp + v_series.end_time);
        if v_series.end_time <= v_series.start_time then
          end_local := end_local + interval '1 day';
        end if;
      else
        end_local := null;
      end if;

      -- Convert local to UTC using tzid
      start_ts := start_local at time zone v_series.tzid;
      if end_local is not null then
        end_ts := end_local at time zone v_series.tzid;
      else
        end_ts := null;
      end if;

      -- Insert event only if not already present for this series and start time
      if not exists (
        select 1 from public.events e where e.series_id = v_series.id and e.start_at = start_ts
      ) then
        insert into public.events (
          title, description, start_at, venue, city, cover_url, created_at,
          venue_id, city_id, is_sponsored, sponsored_until, sponsored_priority, series_id,
          status, published_at, is_free, price_cents, currency, ticket_url
        ) values (
          v_series.title,
          v_series.description_default,
          start_ts,
          v_series.v_name,
          v_city_name,
          use_cover,
          now(),
          v_series.venue_id,
          v_series.v_city_id,
          false,
          null,
          0,
          v_series.id,
          use_status,
          case when use_status = 'published' then now() else null end,
          use_is_free,
          use_price_cents,
          coalesce(use_currency, 'EUR'),
          use_ticket_url
        );
        v_inserted := v_inserted + 1;
      end if;
    end if;
  end loop;

  return v_inserted;
end;
$$;

comment on function public.roll_series_forward(bigint, integer, jsonb) is 'Create missing future events for a series within the given horizon (weeks).';

revoke all on function public.roll_series_forward(bigint, integer, jsonb) from public;
grant execute on function public.roll_series_forward(bigint, integer, jsonb) to authenticated;

-- Main RPC: create or update a series and roll it forward
create or replace function public.create_or_update_series(
  p_series_id bigint,
  p_venue_id bigint,
  p_title text,
  p_days smallint[],               -- 0=Mon..6=Sun
  p_start_date date,
  p_end_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_tzid text,
  p_horizon_weeks integer default 1,
  p_defaults jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_series_id bigint;
  v_has_perm boolean;
begin
  if p_venue_id is null then
    raise exception 'venue_id is required' using errcode = '22004';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required' using errcode = '22004';
  end if;
  if p_days is null or array_length(p_days,1) is null or array_length(p_days,1) = 0 then
    raise exception 'at least one weekday is required' using errcode = '22004';
  end if;

  -- Permission: must be active owner/manager for the venue
  select exists(
    select 1 from public.venue_staff vs
    where vs.venue_id = p_venue_id and vs.user_id = v_uid and vs.active = true and vs.role in ('owner','manager')
  ) into v_has_perm;
  if not v_has_perm then
    raise exception 'not allowed to manage this venue' using errcode = '42501';
  end if;

  if p_series_id is null then
    insert into public.event_series (
      venue_id, title, tzid, start_date, end_date, start_time, end_time, days_of_week,
      active, auto_roll, roll_ahead_weeks,
      is_free_default, price_cents_default, currency_default, ticket_url_default, cover_url_default, description_default
    ) values (
      p_venue_id, trim(p_title), coalesce(nullif(p_tzid,''),'Europe/Madrid'), p_start_date, p_end_date, p_start_time, p_end_time, coalesce(p_days, '{}'::smallint[]),
      true, true, greatest(coalesce(p_horizon_weeks,1),1),
      (p_defaults->>'is_free')::boolean, (p_defaults->>'price_cents')::int, coalesce(nullif((p_defaults->>'currency'), ''), 'EUR'), (p_defaults->>'ticket_url'), (p_defaults->>'cover_url'), (p_defaults->>'description')
    ) returning id into v_series_id;
  else
    -- Update existing series (must belong to the same venue)
    update public.event_series s
      set title = trim(p_title),
          tzid = coalesce(nullif(p_tzid,''), s.tzid),
          start_date = p_start_date,
          end_date = p_end_date,
          start_time = p_start_time,
          end_time = p_end_time,
          days_of_week = coalesce(p_days, s.days_of_week),
          cover_url_default = coalesce(nullif((p_defaults->>'cover_url'),''), s.cover_url_default),
          description_default = coalesce((p_defaults->>'description'), s.description_default),
          is_free_default = coalesce((p_defaults->>'is_free')::boolean, s.is_free_default),
          price_cents_default = coalesce((p_defaults->>'price_cents')::int, s.price_cents_default),
          currency_default = coalesce(nullif((p_defaults->>'currency'),''), s.currency_default),
          ticket_url_default = coalesce((p_defaults->>'ticket_url'), s.ticket_url_default)
      where s.id = p_series_id and s.venue_id = p_venue_id
      returning id into v_series_id;
    if v_series_id is null then
      raise exception 'series % not found or venue mismatch', p_series_id using errcode = 'P0002';
    end if;
  end if;

  -- Roll forward occurrences (events) within horizon using provided defaults
  perform public.roll_series_forward(p_series_id := v_series_id, p_horizon_weeks := greatest(coalesce(p_horizon_weeks,1),1), p_defaults := p_defaults);

  return v_series_id;
end;
$$;

comment on function public.create_or_update_series(bigint, bigint, text, smallint[], date, date, time without time zone, time without time zone, text, integer, jsonb)
  is 'Create a weekly series (or update) and generate events for the next N weeks. Returns series id.';

revoke all on function public.create_or_update_series(bigint, bigint, text, smallint[], date, date, time without time zone, time without time zone, text, integer, jsonb) from public;
grant execute on function public.create_or_update_series(bigint, bigint, text, smallint[], date, date, time without time zone, time without time zone, text, integer, jsonb) to authenticated;
