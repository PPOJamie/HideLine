-- HideLine 1.1: add the private per-team deduction-map container to newly created rooms.
-- Existing team_states rows need no schema change because their state column is JSONB;
-- the client merges this property on first use.

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

grant execute on function public.default_team_state() to authenticated;
