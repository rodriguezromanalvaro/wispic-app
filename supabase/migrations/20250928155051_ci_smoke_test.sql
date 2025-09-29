-- ping: crea/actualiza una función trivial
create or replace function public.__ci_ping()
returns int
language sql
as $$
  select 1;
$$;
