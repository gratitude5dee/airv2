-- R-P0-5: every public table must have row level security enabled.
-- Fails (raises) listing any public table with relrowsecurity = false.
do $$
declare
  missing text[];
begin
  select array_agg(c.relname order by c.relname) into missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity;
  if missing is not null then
    raise exception 'public tables without RLS: %', array_to_string(missing, ', ');
  end if;
end $$;
