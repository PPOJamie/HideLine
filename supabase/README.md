# Connected Mode setup

HideLine works in Local Mode without a backend. Connected Mode uses a Supabase project so team-mates and opponents can join the same room code.

1. Create a Supabase project.
2. In **Authentication -> Providers -> Anonymous Sign-Ins**, enable anonymous users.
3. Open **SQL Editor**, paste `migrations/001_hideline.sql`, and run it once.
4. Copy the project URL and anon key from **Project Settings -> API**.
5. Put them in `config.js`, or enter them in HideLine's Settings screen.
6. Deploy the repository. Create a Connected Mode game and share its six-character code.

The anon key is intentionally public. Security is enforced by Row Level Security:

- game rows and rosters are visible only to members;
- private station, card and note state is visible only to the same team;
- team-only locations are hidden from opponents;
- evidence images are stored in a private bucket and readable only by game members;
- game creation, joining and state changes run through controlled RPC functions.

For a public production deployment, review the SQL against your organisation's own privacy, retention and abuse-prevention requirements. Supabase's anonymous-user rate limits and CAPTCHA options may also be appropriate.
