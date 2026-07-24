# Connected Mode setup

HideLine works in Local Mode without a backend. Connected Mode uses a Supabase project so team-mates and opponents can join the same room code.

## New installation

1. Create a Supabase project.
2. In **Authentication → Providers → Anonymous Sign-Ins**, enable anonymous users.
3. Open **SQL Editor**, paste `migrations/001_hideline.sql`, and run it once.
4. Copy the project URL and anon key from **Project Settings → API**.
5. Put them in `config.js`, or enter them in HideLine's Settings screen.
6. Deploy the repository. Create a Connected Mode game and share its six-character code.

## Upgrade from HideLine 1.0

Run `migrations/002_deduction_map.sql` once. It updates the default team-state function so newly created rooms include the private `deductionByRound` container.

Existing `team_states` rows do not need a table migration because their `state` column is JSONB. The client adds the property when a team first saves its deduction board.

## Upgrade from HideLine 1.1 to 1.2

No SQL migration is required. Detailed area masks, the Endgame station selection and imported simplified spatial geometry are stored inside the existing team-private JSONB state.

## Access model

The anon key is intentionally public. Security is enforced by Row Level Security:

- game rows and rosters are visible only to members;
- private station, card, note, imported spatial geometry and deduction/Endgame-map state is visible only to the same team;
- team-only locations are hidden from opponents;
- evidence images are stored in a private bucket and readable only by game members;
- game creation, joining and state changes run through controlled RPC functions.

Map-ready questions may include the seeker pin, travel endpoints or line/stops in shared question history. This is information the hiders ordinarily need to answer the question. The station elimination results, manual constraints, imported geometry, detailed-mask inputs, Endgame selection, ignored-answer list and priority marks remain in the seeker team's private JSON state.

For a public production deployment, review the SQL against your organisation's privacy, retention and abuse-prevention requirements. Supabase anonymous-user rate limits and CAPTCHA options may also be appropriate.
