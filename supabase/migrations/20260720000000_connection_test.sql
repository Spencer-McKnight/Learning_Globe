create table if not exists public.connection_test (
  id bigint generated always as identity primary key,
  note text not null,
  created_at timestamptz not null default now()
);
alter table public.connection_test enable row level security;
create policy "anon can read" on public.connection_test for select to anon using (true);
