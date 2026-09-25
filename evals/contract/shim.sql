-- Bare-Postgres Supabase shim for the contract-eval lane (R-EV-07).
-- Migrations reference Supabase-only objects: the service_role grant target,
-- auth.uid(), and storage.buckets. On a plain postgres:15 those don't exist,
-- so we create the smallest stand-ins that let every migration apply. The
-- PostgREST anon role is the postgres superuser, which bypasses RLS anyway —
-- service_role semantics for the service_client reads the app performs.
do $$
begin
  create role service_role nologin;
exception when duplicate_object then null;
end $$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid
  language sql stable as 'select null::uuid';

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);
