# HideLine — London Hide + Seek Companion

HideLine is an installable, mobile-first progressive web app for the full-day, two-round London transit hide-and-seek format described in the supplied handbook. It is designed to replace scattered stopwatches, notes, question tables, score calculations and team updates with one clear game board.

![HideLine desktop dashboard](assets/screenshot-desktop.png)

## What is included

- **Guided two-round game control** with the standard 45-minute hiding period, seeker release, pause accounting, endgame, found confirmation and 4 h 45 min cutoff.
- **A complete investigation workflow** for Matching, Measuring, Thermometer, Radar, Tentacles and Photo questions, including repeat multipliers, answer deadlines, evidence and an auditable history.
- **The authoritative Google My Maps game layer** embedded in the app, plus a separate planning map with a 500 m station zone, optional team positions and an explicitly labelled approximate boundary.
- **All 100 handbook hiding stations**, searchable and randomisable, with station-name length support and a used-station tracker.
- **Hider tools** for a private station, hiding notes, six-card hand management, power-ups/curses and timestamped time traps.
- **Accurate round scoring** using time traps, percentage bonuses, fixed bonuses, curse adjustments, cures and other penalties.
- **Transit and safety tools** for boarding/off-transit notices, optional location sharing, live TfL status, checklists and timestamped team messages.
- **Local Mode** for one shared device with offline support and private photos stored in IndexedDB rather than browser text storage.
- **Connected Mode** for team-mates and opponents on separate devices using optional Supabase real-time rooms, private team state, presence, private evidence storage and opt-in position visibility.
- **Installable PWA** behavior, a responsive layout, dark-mode support, keyboard focus states and GitHub Pages deployment automation.

## Run locally

Requirements: Node.js 20 or newer. There are no npm runtime dependencies and no build step.

```bash
npm run check
npm run dev
```

Open the local address printed in the terminal, normally `http://127.0.0.1:4173`.

A service worker cannot provide normal offline behavior when the app is opened directly with `file://`; use the development server or a deployed HTTPS site.

## Publish with GitHub Pages

1. Create an empty GitHub repository.
2. Upload the complete contents of this folder, including `.github`, `.nojekyll` and all subfolders.
3. Commit to the `main` branch.
4. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
5. The included workflow runs validation/tests and publishes the site.

The app uses relative URLs, so it works from both a user/organisation Pages site and a project subpath.

## Enable Connected Mode

Local Mode works immediately. Connected Mode needs a Supabase project:

1. Create a Supabase project.
2. Enable **Authentication → Providers → Anonymous Sign-Ins**.
3. Run [`supabase/migrations/001_hideline.sql`](supabase/migrations/001_hideline.sql) once in the Supabase SQL editor.
4. Copy the project URL and anon key from the project API settings.
5. Either place them in `config.js` or enter them in HideLine's Settings screen.

```js
window.HIDELINE_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-PUBLIC-ANON-KEY",
  googleMapId: "1lDtKjR7rN1zelD3FjepU1XNvHmnb774"
};
```

The anon key is public by design. The included Row Level Security policies provide the access boundary. Review the schema, retention model and abuse controls before operating a public service. Full setup details are in [`supabase/README.md`](supabase/README.md).

## How the multiplayer privacy model works

- Room data and the player roster are visible only to authenticated room members.
- A team's selected hiding station, card hand and private notes are kept in a team-only row.
- Location sharing is off until a player starts it. Hider-side sharing defaults to the same team; seeker-side sharing can be visible to all room members.
- Connected photo evidence is compressed in the browser, uploaded to a private bucket and viewed through a short-lived signed URL.
- Local Mode photos remain in that browser's IndexedDB and are not included in the JSON export.
- Changing team in Connected Mode immediately changes which private team state the device may read.

Read [`PRIVACY.md`](PRIVACY.md) before deployment.

## Map accuracy and game adjudication

The embedded Google My Maps layer is the authoritative boundary/POI reference for play. The Leaflet/OpenStreetMap map is a convenience for drawing a station-centred 500 m circle and showing positions. Its polygon is intentionally marked **approximate** and must not be used to overrule the authoritative layer.

Station coordinates are resolved on demand from TfL, with an OpenStreetMap Nominatim fallback, then cached on the device. Always check that the selected station is open and reasonably accessible on game day.

## Important gameplay safeguards

HideLine supports the handbook; it does not replace judgement. In particular:

- Real-world safety, staff instructions, access rules and transport rules always take precedence.
- Do not use Street View, reverse-image search or AI to solve the opponent's location.
- A hider must be in a valid station-centred 500 m zone at release; the handbook's backtrack/pause and penalty rule applies otherwise.
- Endgame should be confirmed only when seekers are inside the hiding zone and off transit.
- “Found” means within 2 m **and** the hiders have been spotted.
- Avoid underground/no-signal hiding spots, nuisance locations and photographs that unnecessarily identify bystanders.

## Project structure

```text
.
├── .github/workflows/pages.yml      # test and GitHub Pages deployment
├── assets/                           # icons and install screenshots
├── docs/                             # supplied handbook and architecture notes
├── scripts/                          # local server and data validation
├── src/
│   ├── core/                         # state, timing, score and geographic helpers
│   ├── data/                         # stations, questions, rules and planning boundary
│   ├── services/                     # map, location, TfL, Supabase and local evidence
│   └── ui/                           # accessible HTML renderers
├── supabase/migrations/              # Connected Mode schema/RLS/storage setup
├── tests/                            # deterministic core tests
├── config.js                         # deploy-time public configuration
├── manifest.webmanifest              # PWA metadata
└── service-worker.js                 # offline application shell
```

## Quality checks

```bash
npm run validate   # verifies station/question data and planning polygon
npm test           # runs core timing, score, distance and repeat-reward tests
npm run check      # runs both
```

The source is plain standards-based HTML, CSS and JavaScript. This keeps the repository easy to inspect, fork and deploy without a framework build chain.

## Licence and third-party material

The original HideLine source code is MIT licensed. The supplied handbook, Google map content, service names, map tiles and external libraries/services have their own owners and terms; they are not relicensed by this repository. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Confirm that you have permission before publishing the handbook or any private map publicly.

HideLine is an independent companion implementation and is not an official product of the creators or publishers of any referenced game, map or transport service.
