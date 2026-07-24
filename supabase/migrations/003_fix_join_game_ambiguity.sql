-- HideLine 2.1.1: fix joining a room on a second device.
--
-- Cause:
-- The join_game function returns a column named game_id, while the
-- game_members table also has a game_id column. PostgreSQL treated the
-- previous ON CONFLICT (game_id, user_id) clause as ambiguous.
--
-- Safe to run on an existing HideLine Supabase project. It preserves all
-- games, members, questions, answers and team data.

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
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if p_team not in ('alpha', 'bravo') then
    raise exception 'Invalid team';
  end if;

  if char_length(trim(p_display_name)) < 1 then
    raise exception 'Display name is required';
  end if;

  select g.*
    into v_game
    from public.games as g
   where g.join_code = upper(trim(p_join_code));

  if not found then
    raise exception 'No game found for that room code';
  end if;

  insert into public.game_members as gm
    (game_id, user_id, display_name, team, is_host, last_seen)
  values
    (v_game.id, v_user, left(trim(p_display_name), 50), p_team, false, now())
  on conflict on constraint game_members_pkey do update
    set display_name = excluded.display_name,
        team = excluded.team,
        last_seen = now();

  return query
    select v_game.id, v_game.join_code;
end;
$$;

grant execute on function public.join_game(text, text, text) to authenticated;
