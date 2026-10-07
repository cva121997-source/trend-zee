-- TREND ZEE - Supabase schema for Vercel deployment

create table if not exists public.products (
  id text primary key,
  data jsonb not null,
  archived integer not null default 0,
  constraint products_archived_check check (archived in (0, 1))
);

create table if not exists public.records (
  id text primary key,
  kind text not null,
  owner text not null,
  data jsonb not null,
  created timestamptz not null,
  updated timestamptz not null
);

create index if not exists records_kind_owner on public.records(kind, owner);
create index if not exists products_archived on public.products(archived);

alter table public.products enable row level security;
alter table public.records enable row level security;

revoke all on table public.products from anon, authenticated;
revoke all on table public.records from anon, authenticated;

grant select, insert, update, delete on table public.products to service_role;
grant select, insert, update, delete on table public.records to service_role;
