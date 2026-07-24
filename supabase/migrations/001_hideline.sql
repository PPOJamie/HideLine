-- HideLine multiplayer schema
-- Run this once in a new Supabase project's SQL editor, then enable Anonymous Sign-Ins.

create extension if not exists pgcrypto;

create or replace function public.empty_hideline_score()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'hidingSeconds', 0,
    'hidingPeriodSeconds', 2700,
    'timeTraps', '[]'::jsonb,
    'percentageBonuses', '[]'::jsonb,
    'timeBonuses', '[]'::jsonb,
    'curseExtraTime', '[]'::jsonb,
    'curseCures', '[]'::jsonb,
    'otherAdjustments', '[]'::jsonb
  );
$$;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique check (join_code ~ '^[A-Z2-9]{6}$'),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_members (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  team text not null check (team in ('alpha', 'bravo')),
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (game_id, user_id)
);

create table if not exists public.team_states (
  game_id uuid not null references public.games(id) on delete cascade,
  team text not null check (team in ('alpha', 'bravo')),
  state jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (game_id, team)
);

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  team text not null check (team in ('alpha', 'bravo')),
  visibility text not null default 'all' check (visibility in ('all', 'team')),
  event_type text not null check (char_length(event_type) between 1 and 60),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.positions (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team text not null check (team in ('alpha', 'bravo')),
  display_name text not null check (char_length(display_name) between 1 and 50),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy double precision,
  altitude double precision,
  sharing_with text not null default 'team' check (sharing_with in ('team', 'all')),
  recorded_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create index if not exists game_members_user_idx on public.game_members(user_id, game_id);
create index if not exists game_events_game_created_idx on public.game_events(game_id, created_at desc);
create index if not exists positions_game_idx on public.positions(game_id, recorded_at desc);

create or replace function public.is_game_member(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.game_members
    where game_id = p_game_id and user_id = auth.uid()
  );
$$;

create or replace function public.my_game_team(p_game_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select team from public.game_members
  where game_id = p_game_id and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text := '';
  i integer;
begin
  for i in 1..6 loop
    candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  end loop;
  return candidate;
end;
$$;

create or replace function public.default_hideline_state()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'phase', 'lobby',
    'round', 1,
    'hiderTeam', 'alpha',
    'teams', jsonb_build_object(
      'alpha', jsonb_build_object('name', 'Team Alpha'),
      'bravo', jsonb_build_object('name', 'Team Bravo')
    ),
    'timers', jsonb_build_object(
      'roundStartedAt', null,
      'roundStoppedAt', null,
      'foundAt', null,
      'pauses', '[]'::jsonb,
      'hidingPeriodSeconds', 2700,
      'seekingWindowSeconds', 14400,
      'cutoffSeconds', 17100
    ),
    'transit', jsonb_build_object(
      'alpha', jsonb_build_object('active', false, 'startedAt', null, 'station', '', 'note', ''),
      'bravo', jsonb_build_object('active', false, 'startedAt', null, 'station', '', 'note', '')
    ),
    'scoreByRound', jsonb_build_object(
      '1', public.empty_hideline_score(),
      '2', public.empty_hideline_score()
    ),
    'traps', '[]'::jsonb,
    'usedStations', '[]'::jsonb,
    'questions', '[]'::jsonb,
    'settings', jsonb_build_object('autoEndgamePrompt', true, 'allowLocationSharing', true)
  );
$$;

create or replace function public.default_team_state()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'stationId', null,
    'stationName', null,
    'stationCoords', null,
    'hidingSpotNote', '',
    'cards', '[]'::jsonb,
    'handLimit', 6,
    'privateNotes', '',
    'deductionByRound', '{}'::jsonb
  );
$$;

create or replace function public.create_game(
  p_game_name text,
  p_display_name text,
  p_team text default 'alpha'
)
returns table (game_id uuid, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game uuid;
  v_code text;
  v_attempt integer := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_team not in ('alpha', 'bravo') then raise exception 'Invalid team'; end if;
  if char_length(trim(p_display_name)) < 1 then raise exception 'Display name is required'; end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := public.generate_join_code();
    exit when not exists (select 1 from public.games where games.join_code = v_code);
    if v_attempt > 20 then raise exception 'Could not generate a unique room code'; end if;
  end loop;

  insert into public.games (join_code, name, created_by, state)
  values (v_code, left(trim(p_game_name), 80), v_user, public.default_hideline_state())
  returning id into v_game;

  insert into public.game_members (game_id, user_id, display_name, team, is_host)
  values (v_game, v_user, left(trim(p_display_name), 50), p_team, true);

  insert into public.team_states (game_id, team, state, updated_by)
  values
    (v_game, 'alpha', public.default_team_state(), v_user),
    (v_game, 'bravo', public.default_team_state(), v_user);

  return query select v_game, v_code;
end;
$$;

create or replace function public.join_game(
  p_join_code text,
  p_display_name text,
  p_team text default 'alpha'
)
returns table (game_id uuid, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game public.games%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_team not in ('alpha', 'bravo') then raise exception 'Invalid team'; end if;
  if char_length(trim(p_display_name)) < 1 then raise exception 'Display name is required'; end if;

  select * into v_game from public.games where games.join_code = upper(trim(p_join_code));
  if not found then raise exception 'No game found for that room code'; end if;

  insert into public.game_members (game_id, user_id, display_name, team, is_host, last_seen)
  values (v_game.id, v_user, left(trim(p_display_name), 50), p_team, false, now())
  on conflict (game_id, user_id) do update
    set display_name = excluded.display_name,
        team = excluded.team,
        last_seen = now();

  return query select v_game.id, v_game.join_code;
end;
$$;

create or replace function public.patch_game_state(p_game_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
begin
  if not public.is_game_member(p_game_id) then raise exception 'Not a member of this game'; end if;
  update public.games
    set state = coalesce(state, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb),
        version = version + 1,
        updated_at = now()
  where id = p_game_id
  returning state into v_state;
  return v_state;
end;
$$;

create or replace function public.save_team_state(p_game_id uuid, p_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team text := public.my_game_team(p_game_id);
  v_state jsonb;
begin
  if v_team is null then raise exception 'Not a member of this game'; end if;
  insert into public.team_states (game_id, team, state, updated_by, updated_at)
  values (p_game_id, v_team, coalesce(p_state, '{}'::jsonb), auth.uid(), now())
  on conflict (game_id, team) do update
    set state = excluded.state,
        updated_by = auth.uid(),
        updated_at = now()
  returning state into v_state;
  return v_state;
end;
$$;

create or replace function public.storage_game_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

alter table public.games enable row level security;
alter table public.game_members enable row level security;
alter table public.team_states enable row level security;
alter table public.game_events enable row level security;
alter table public.positions enable row level security;

-- Games are only visible to members. Mutations are performed through security-definer RPCs.
drop policy if exists games_select_members on public.games;
create policy games_select_members on public.games for select to authenticated
using (public.is_game_member(id));

-- Members can see the room roster and update only their own profile/presence row.
drop policy if exists members_select_room on public.game_members;
create policy members_select_room on public.game_members for select to authenticated
using (public.is_game_member(game_id));

drop policy if exists members_update_self on public.game_members;
create policy members_update_self on public.game_members for update to authenticated
using (user_id = auth.uid() and public.is_game_member(game_id))
with check (user_id = auth.uid() and public.is_game_member(game_id));

-- A team's private station, hand and notes are visible only to that team.
drop policy if exists team_state_select_own on public.team_states;
create policy team_state_select_own on public.team_states for select to authenticated
using (public.is_game_member(game_id) and team = public.my_game_team(game_id));

drop policy if exists team_state_insert_own on public.team_states;
create policy team_state_insert_own on public.team_states for insert to authenticated
with check (public.is_game_member(game_id) and team = public.my_game_team(game_id));

drop policy if exists team_state_update_own on public.team_states;
create policy team_state_update_own on public.team_states for update to authenticated
using (public.is_game_member(game_id) and team = public.my_game_team(game_id))
with check (public.is_game_member(game_id) and team = public.my_game_team(game_id));

-- Timeline events may be visible to everyone or only the author's team.
drop policy if exists events_select_visible on public.game_events;
create policy events_select_visible on public.game_events for select to authenticated
using (
  public.is_game_member(game_id)
  and (
    visibility = 'all'
    or (visibility = 'team' and team = public.my_game_team(game_id))
    or created_by = auth.uid()
  )
);

drop policy if exists events_insert_member on public.game_events;
create policy events_insert_member on public.game_events for insert to authenticated
with check (
  public.is_game_member(game_id)
  and created_by = auth.uid()
  and team = public.my_game_team(game_id)
);

-- Positions are ephemeral and opt-in. Team-only hider positions are not exposed to opponents.
drop policy if exists positions_select_visible on public.positions;
create policy positions_select_visible on public.positions for select to authenticated
using (
  public.is_game_member(game_id)
  and (
    sharing_with = 'all'
    or team = public.my_game_team(game_id)
    or user_id = auth.uid()
  )
);

drop policy if exists positions_insert_self on public.positions;
create policy positions_insert_self on public.positions for insert to authenticated
with check (
  public.is_game_member(game_id)
  and user_id = auth.uid()
  and team = public.my_game_team(game_id)
);

drop policy if exists positions_update_self on public.positions;
create policy positions_update_self on public.positions for update to authenticated
using (user_id = auth.uid() and public.is_game_member(game_id))
with check (user_id = auth.uid() and team = public.my_game_team(game_id));

drop policy if exists positions_delete_self on public.positions;
create policy positions_delete_self on public.positions for delete to authenticated
using (user_id = auth.uid() and public.is_game_member(game_id));

grant usage on schema public to authenticated;
grant select on public.games, public.game_members, public.team_states, public.game_events, public.positions to authenticated;
grant update on public.game_members to authenticated;
grant insert on public.game_events to authenticated;
grant insert, update, delete on public.positions to authenticated;
grant execute on function public.create_game(text, text, text) to authenticated;
grant execute on function public.join_game(text, text, text) to authenticated;
grant execute on function public.patch_game_state(uuid, jsonb) to authenticated;
grant execute on function public.save_team_state(uuid, jsonb) to authenticated;

-- Private evidence bucket. Every game member may read evidence; only the uploader may write their folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-evidence', 'game-evidence', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists evidence_select_members on storage.objects;
create policy evidence_select_members on storage.objects for select to authenticated
using (
  bucket_id = 'game-evidence'
  and public.is_game_member(public.storage_game_id(name))
);

drop policy if exists evidence_insert_own_folder on storage.objects;
create policy evidence_insert_own_folder on storage.objects for insert to authenticated
with check (
  bucket_id = 'game-evidence'
  and public.is_game_member(public.storage_game_id(name))
  and (storage.foldername(name))[3] = auth.uid()::text
);

drop policy if exists evidence_delete_own_folder on storage.objects;
create policy evidence_delete_own_folder on storage.objects for delete to authenticated
using (
  bucket_id = 'game-evidence'
  and public.is_game_member(public.storage_game_id(name))
  and (storage.foldername(name))[3] = auth.uid()::text
);

-- Add tables to the realtime publication when not already present.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['games', 'game_members', 'team_states', 'game_events', 'positions']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
