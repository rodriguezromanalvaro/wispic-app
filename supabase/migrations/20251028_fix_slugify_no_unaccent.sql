-- Fix: avoid dependency on unaccent() extension for slugification
-- Redefine helper to strip diacritics using translate() and regex only

-- Helper to strip common Latin diacritics used in ES/pt/fr/it
create or replace function public._strip_diacritics(p text)
returns text
language sql
immutable
as $$
  select translate(p,
    'ÀÁÂÃÄÅĀĂĄàáâãäåāăąÈÉÊËĒĔĖĘĚèéêëēĕėęěÌÍÎÏĨĪĬĮìíîïĩīĭįÒÓÔÕÖØŌŎŐòóôõöøōŏőÙÚÛÜŨŪŬŮŰŲùúûüũūŭůűųÇĆĈĊČçćĉċčÑŃŅŇñńņňÝŸýÿ',
    'AAAAAAAAAaaaaaaaaEEEEEEEEEeeeeeeeeeIIIIIIIIIiiiiiiiiiOOOOOOOOoooooooUUUUUUUUUUuuuuuuuuuCCCCCcccccNNNNnnnnYYyy');
$$;

-- Slugify that uses the _strip_diacritics helper
create or replace function public._slugify_city_name(p_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(public._strip_diacritics(p_name))), '[^a-z0-9]+', '-', 'g');
$$;

comment on function public._strip_diacritics(text) is 'Removes common Latin diacritics using translate() (no unaccent extension).';
comment on function public._slugify_city_name(text) is 'Slugify city name using translate()+regex; no unaccent extension required.';
