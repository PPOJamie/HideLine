# Contributing

Thank you for improving HideLine.

## Development

Use Node.js 20 or newer:

```bash
npm run check
npm run dev
```

There is no build step. Keep the app usable as static files on GitHub Pages and avoid introducing server-only assumptions into Local Mode.

## Change guidelines

- Preserve the distinction between the authoritative embedded game map and the approximate planning overlay.
- Do not place hider-private state in the shared game JSON. Station choice, hiding notes and cards belong in `privateTeamState` / the Supabase `team_states` table.
- Location features must remain opt-in and clearly identify who can see a position.
- Keep question timers, repeat costs and score calculations deterministic and covered by tests.
- New handbook-derived rules should include their source page in a code comment or commit description.
- Maintain keyboard access, visible focus, responsive layouts and meaningful labels.
- Do not add trackers, advertising SDKs or opaque analytics.

## Pull requests

Before opening a pull request:

1. Run `npm run check`.
2. Test Local Mode at desktop and narrow mobile widths.
3. Test a create/join cycle if changing Connected Mode.
4. Check that no Supabase service-role key, personal address, room data or other secret is committed.
5. Describe user-visible behavior and any privacy/security impact.
