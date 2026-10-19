create table if not exists public.child_profiles (
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  child_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null,
  primary key (owner_id, record_id),
  unique (owner_id, record_id, child_id)
);

create table if not exists public.child_concept_progress (
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  child_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null,
  primary key (owner_id, record_id),
  foreign key (owner_id, child_id) references public.child_profiles(owner_id, record_id) on delete cascade
);

create table if not exists public.child_learning_path_progress (
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  child_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null,
  primary key (owner_id, record_id),
  foreign key (owner_id, child_id) references public.child_profiles(owner_id, record_id) on delete cascade
);

create table if not exists public.play_sessions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  child_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null,
  primary key (owner_id, record_id),
  foreign key (owner_id, child_id) references public.child_profiles(owner_id, record_id) on delete cascade
);

create table if not exists public.achievements (
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  child_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null,
  primary key (owner_id, record_id),
  foreign key (owner_id, child_id) references public.child_profiles(owner_id, record_id) on delete cascade
);

create table if not exists public.challenge_progress (
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  child_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null,
  primary key (owner_id, record_id),
  foreign key (owner_id, child_id) references public.child_profiles(owner_id, record_id) on delete cascade
);

create table if not exists public.sync_tombstones (
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity text not null check (entity in (
    'child_profiles',
    'child_concept_progress',
    'child_learning_path_progress',
    'play_sessions',
    'achievements',
    'challenge_progress'
  )),
  record_id text not null,
  changed_at timestamptz not null,
  primary key (owner_id, entity, record_id)
);

create index if not exists child_profiles_owner_child_idx on public.child_profiles(owner_id, child_id);
create index if not exists child_concept_progress_owner_child_idx on public.child_concept_progress(owner_id, child_id);
create index if not exists child_learning_path_progress_owner_child_idx on public.child_learning_path_progress(owner_id, child_id);
create index if not exists play_sessions_owner_child_idx on public.play_sessions(owner_id, child_id);
create index if not exists achievements_owner_child_idx on public.achievements(owner_id, child_id);
create index if not exists challenge_progress_owner_child_idx on public.challenge_progress(owner_id, child_id);
create index if not exists sync_tombstones_owner_changed_idx on public.sync_tombstones(owner_id, changed_at);

-- Every table is private to its authenticated parent account. The browser never uses a service-role key.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'child_profiles',
    'child_concept_progress',
    'child_learning_path_progress',
    'play_sessions',
    'achievements',
    'challenge_progress',
    'sync_tombstones'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists parent_owns_rows on public.%I', table_name);
    execute format(
      'create policy parent_owns_rows on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      table_name
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

-- Introductions are queryable explicitly while their source of truth remains concept progress.
create or replace view public.introduced_concepts
with (security_invoker = true)
as
select
  owner_id,
  child_id,
  payload ->> 'conceptId' as concept_id,
  updated_at as introduced_at
from public.child_concept_progress
where payload ->> 'introduced' = 'true';

grant select on public.introduced_concepts to authenticated;
