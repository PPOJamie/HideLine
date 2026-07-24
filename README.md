# HideLine — London Hide + Seek Companion

HideLine is an installable, mobile-first companion for the two-round London transit hide-and-seek game in the supplied handbook. Version 2.1.2 keeps the simple game-day design, fixes the Connected Mode join issue, and makes live maps stay responsive while presence and location updates arrive.

![Simple HideLine game screen](assets/screenshot-simple-desktop.png)

![Simple HideLine deduction map on mobile](assets/screenshot-simple-mobile.png)

## What is new in 2.1.2

- **Responsive Connected Mode maps:** live positions, roster heartbeats and timeline events are applied directly instead of reloading the full game. The deduction map no longer recentres every few seconds.
- **Smoother panning and zooming:** detailed exclusion masks pause briefly while the map is moving and redraw once at the final view, keeping touch gestures responsive.
- **View preservation:** meaningful question or deduction updates keep the current map centre and zoom.
- **Reliable room joining:** the corrected `join_game` function is included in the base schema and as migration `003_fix_join_game_ambiguity.sql` for existing projects.

## What was added in 2.1

- **More accurate Thames guidance:** the old coarse centreline has been replaced by a 614-point planning guide generated from 57 bridge-anchored control points and interpolated at roughly 35 m spacing. The online map leaves the OpenStreetMap water polygon visible instead of drawing a thick approximate river over it.
- **Earlier clues remain visible in Endgame:** station-level facts and answers recorded while the hider is fixed remain hard grey exclusions. Pre-Endgame location answers are carried into the selected circle as blue historical hatching, because the hider was allowed to move after answering. No question needs to be asked again merely to show its earlier result.
- **Pick coordinates from map:** every coordinate-based question now has a button that opens a map. Tap the location or drag the marker, optionally use device GPS, then choose **Use this point**. HideLine fills the latitude, longitude and shared Google Maps pin.

## The game-day interface

There are only three main screens:

1. **Game** — the round timer, the next action, team roles and recent updates.
2. **Questions** — the complete question list, the active answer timer and question history.
3. **Map** — the combined deduction map, the hider's 500 m zone and the official Google map.

Less-used controls are kept out of the main navigation:

- Cards, traps, transit notices and scoring live in one collapsed **Game kit**.
- Imported map data, answer auditing and deduction reset controls are collapsed below the map.
- Quick rules and app settings remain available without taking space from the three game screens.

## What the app handles

- The 45-minute hiding period, pause-aware seeking time, Endgame and round cutoff.
- All 55 handbook questions with the correct 5- or 10-minute answer timer and repeat reward display.
- All 100 handbook hiding stations and their 500 m zones.
- A private seeker deduction map that automatically combines every usable answer.
- A dedicated fixed-location Endgame circle with a clear **Back to all stations** action.
- Hider cards, time traps, transit notifications and the handbook score formula.
- Optional room-code multiplayer with team-private station, card and deduction data.
- Offline application-shell support after the first successful load.

## The simplified deduction map

The seeker map no longer asks players to choose between technical layers. It always shows the combined result:

- **Green** — the coordinate remains possible.
- **Grey** — at least one answered question excludes it.
- **Amber** — the clue needs source map data or player judgement.

The heading shows how many stations remain. The station list, answer audit and map setup are available below the map but stay collapsed until needed.

Before Endgame, each answer is treated as a separate snapshot because the hiders may move within their station zone between questions. In Endgame, all earlier clues are brought into the chosen 500 m circle automatically: station facts and fixed-spot answers act as hard current exclusions, while earlier mobile answers remain visible as blue historical evidence. New Endgame answers are intersected at one fixed location because the hiders must remain at the hiding spot.

Radar, Thermometer, station-name, transit-line and Thames-side deductions work immediately. Coordinate-based question forms include **Pick coordinates from map**, so players do not need to look up or type latitude and longitude manually. Tentacles and questions based on curated points of interest or administrative boundaries need the Google My Maps KML/KMZ imported once under **Map setup and reset**. When source geometry is unavailable, HideLine marks the clue as unresolved rather than inventing an answer.

The deduction grid is a planning aid. The official game map and normal player judgement remain authoritative for borderline paths, entrances, station pins and disputed points of interest.

## Run locally

Requirements: Node.js 20 or newer. There are no runtime npm dependencies and no build step.

```bash
npm run check
npm run dev
```

Open the address printed in the terminal, normally `http://127.0.0.1:4173`.

## Publish with GitHub Pages

1. Upload the complete contents of this repository to the `main` branch.
2. Open **Settings → Pages** in GitHub.
3. Choose **GitHub Actions** as the source.
4. The included workflow validates the data, runs the tests and deploys the static app.

The app uses relative URLs, so it works from a GitHub project subpath such as `https://USERNAME.github.io/HideLine/`.

## Enable Connected Mode

Local Mode works immediately. Connected Mode requires a Supabase project:

1. Enable anonymous sign-ins in Supabase.
2. For a new installation, run [`supabase/migrations/001_hideline.sql`](supabase/migrations/001_hideline.sql).
3. An installation originally created with HideLine 1.0 must also run [`supabase/migrations/002_deduction_map.sql`](supabase/migrations/002_deduction_map.sql).
4. Put the project URL and public anon key in `config.js`, or enter them under **Settings → Connected Mode setup**.

```js
window.HIDELINE_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-PUBLIC-ANON-KEY",
  googleMapId: "1lDtKjR7rN1zelD3FjepU1XNvHmnb774"
};
```

HideLine 2.1.2 requires **no new Supabase migration for map performance**. Existing projects that have not already applied the room-join repair should run `supabase/migrations/003_fix_join_game_ambiguity.sql`. Full backend instructions are in [`supabase/README.md`](supabase/README.md).

## Privacy model

- The selected hiding station, hider cards and seeker deductions are stored in team-private state.
- A connected hider device cannot open the seeker deduction map.
- Location sharing is opt-in and hider sharing defaults to the hider team only.
- Connected photo answers use a private storage bucket and short-lived signed links.
- Local photo answers stay in the browser's IndexedDB.

Read [`PRIVACY.md`](PRIVACY.md) before operating a public deployment.

## Map accuracy

The Google My Map remains the authoritative boundary, station and curated-POI reference. OpenStreetMap supplies the visible street and river-bank basemap. HideLine's 614-point Thames guide, deduction grid, station centres, 500 m circles and offline vector map are planning aids rather than surveyed boundaries. Use normal player judgement for bridges, tunnels, islands, foreshore, borderline paths and source-layer disputes.

## Important safeguards

- Stop walking before using the app near roads, stairs or platforms.
- Follow transport staff instructions and real-world access restrictions.
- Do not use Street View, reverse-image search or AI to solve the opponent's location.
- At seeker release, hiders must be inside a valid station-centred 500 m zone.
- Confirm Endgame only when the seekers are inside the hiding zone and off transit.
- “Found” means the seekers are within 2 m and have spotted the hiders.

## Project structure

```text
.
├── .github/workflows/pages.yml      # tests and GitHub Pages deployment
├── assets/                           # icons and install screenshots
├── docs/                             # handbook and architecture notes
├── scripts/                          # local server and data validation
├── src/
│   ├── core/                         # state, timing, scoring and deduction engine
│   ├── data/                         # stations, coordinates, questions and rules
│   ├── services/                     # maps, location, Supabase and evidence
│   └── ui/                           # accessible HTML renderers
├── supabase/migrations/              # Connected Mode schema and policies
├── tests/                            # deterministic core and UI tests
├── config.js                         # public deployment configuration
├── manifest.webmanifest              # install metadata
└── service-worker.js                 # offline application shell
```

## Quality checks

```bash
npm run validate
npm test
npm run check
```

The project is plain HTML, CSS and JavaScript so it remains easy to inspect, change and upload directly to GitHub. The automated checks cover the 100 stations, all 55 linked questions, the 614-point Thames guide, Endgame carry-forward masks and coordinate-picker controls.

## Licence and third-party material

The original HideLine source is MIT licensed. The supplied handbook, Google map content, transport names, external services and map tiles retain their respective ownership and terms. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

HideLine is an independent companion implementation and is not an official product of the creators or publishers of any referenced game, map or transport service.
