-- Onboarding v2: relationship status, permissions and notification prefs
-- Safe-alter with IF NOT EXISTS and CHECK constraints where applicable

do $$
begin
  -- relationship_status
  begin
    alter table profiles add column if not exists relationship_status text check (relationship_status in ('single','inRelationship','open','itsComplicated','preferNot'));
  exception when others then null; end;

  -- permissions / prefs
  begin alter table profiles add column if not exists location_opt_in boolean default false; exception when others then null; end;
  begin alter table profiles add column if not exists push_opt_in boolean default false; exception when others then null; end;
  begin alter table profiles add column if not exists notify_messages boolean default true; exception when others then null; end;
  begin alter table profiles add column if not exists notify_likes boolean default true; exception when others then null; end;
  begin alter table profiles add column if not exists notify_friend_requests boolean default true; exception when others then null; end;
  begin alter table profiles add column if not exists expo_push_token text; exception when others then null; end;

  -- bookkeeping
  begin alter table profiles add column if not exists onboarding_version smallint default 2; exception when others then null; end;
  begin alter table profiles add column if not exists onboarding_completed boolean default false; exception when others then null; end;
end $$;
