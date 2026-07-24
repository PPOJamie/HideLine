# HideLine — London Hide + Seek Companion

HideLine is an installable, mobile-first companion for the full-day, two-round London transit hide-and-seek game in the supplied handbook. Version 2.1 keeps the simplified game-day interface and adds three practical map improvements: a remapped Thames guide, automatic carry-forward of earlier clues into Endgame, and a tap-to-select coordinate picker. The app remains focused on five jobs:

1. run the round timer;
2. ask and answer questions;
3. show one live deduction map;
4. guide the fixed-spot Endgame;
5. calculate the final score.

Local Mode works immediately on one device. Optional Connected Mode links team-mates and opponents through a Supabase room.

## The simplified game-day interface

The main navigation has only four tabs:

- **Game** — current role, timer, pause, Endgame/found controls and the next recommended action.
- **Questions** — one pending question at a time, concise category search, answer deadline and question history.
- **Map** — the live seeker deduction map, a private 500 m zone checker and the official Google My Map.
- **More** — score, hider cards, time traps and the 100-station list.

A short **Quick rules** screen is available from the side menu. The full handbook remains available under `docs/`.

## Live deduction map

The normal map has no answer-layer selector. It automatically combines every usable answer and displays the result across all station-centred 500 m circles:

- **Green** — this sampled area can still fit the recorded answers.
- **Grey** — one or more answers exclude this area.
- **Amber** — the app needs map data or player judgement before it can decide.
- **Purple marker** — a station the seeker team has marked as a priority.

The map also shows the number of remaining stations, the latest linked answers and a searchable list of stations still in play. Seekers can undo the last manual change, mark a priority or manually eliminate a station when a deduction was made outside the app.

The app keeps pre-Endgame deductions movement-aware: hiders may move within their selected 500 m zone between answers, so a station is not incorrectly eliminated merely because different snapshots do not overlap at one exact coordinate.

### Endgame circle

Select **Endgame circle** when the seekers believe the hiders are fixed in their final spot. The app then:

- shows only the suspected station's 500 m circle;
- carries every earlier linked answer into the Endgame view automatically;
- treats station facts and answers recorded while the hider is fixed as hard exclusions;
- shows pre-Endgame location answers as blue historical hatching, because the hider was allowed to move after answering;
- greys areas excluded by current fixed-spot evidence;
- estimates the percentage of the circle remaining;
- provides one clear **Back to all stations** control.

Players do not need to re-ask earlier questions merely to see them in Endgame. A pre-Endgame location answer is deliberately not presented as proof of the hider's current fixed position; it remains visible as an earlier clue instead.

### Questions supported

All 55 handbook questions remain linked to the deduction record. Radar, Thermometer, station-name length, transit-line/exact-stop and Thames-side questions work from built-in data. POI, boundary, Measuring and Tentacle calculations use the official map geometry when available.

Whenever a question needs a location, the form includes **Pick coordinates from map**. Players can tap the map, drag the pin, use device GPS and then return the selected latitude/longitude directly to the question. A shareable Google Maps pin is filled in automatically when the question's location field is otherwise blank. For Thames-side Matching, the selected pin also determines north, south or the bridge/tunnel corridor automatically.

The Thames-side calculation now uses 57 bridge-anchored control points, densified into a 614-point guide at roughly 35 m spacing with a variable-width planning corridor through the London bends. On the interactive map, the OpenStreetMap water shape is left unobstructed and acts as the visual bank reference rather than displaying a second thick approximate river line.

The normal interface offers a single **Load map data** button only when one of those answers needs it. Manual KML/KMZ/GeoJSON import and manual photo/judgement areas are kept inside the collapsed **Map not matching?** section so they do not interrupt ordinary play.

Photo clues are recorded for human interpretation; the app does not use reverse-image search or AI to solve them.

## Other included game tools

- Standard 45-minute hiding period and 4 h 45 min round cutoff.
- Pause-aware round timing and Endgame/found controls.
- Matching, Measuring, Thermometer, Radar, Tentacles and Photo workflows.
- Five-minute standard and ten-minute photo answer deadlines.
- Repeat-question reward multipliers.
- All 100 handbook hiding-station entries and station-name lengths.
- Private hider station, notes and six-card hand.
- Time traps with placement/removal timestamps.
- Score formula with traps, percentage bonuses, fixed bonuses, curses, cures and penalties.
- Boarding/alighting notices and transport-status links.
- Offline application shell after the first successful load.
- Optional real-time team rooms, private team state and opt-in location sharing.

## Run locally

Requirements: Node.js 20 or newer. There are no npm runtime dependencies and no build step.

```bash
npm run check
npm run dev
```

Open the address printed in the terminal, normally `http://127.0.0.1:4173`.

## Publish with GitHub Pages

1. Upload the complete contents of this folder to the repository's `main` branch.
2. In GitHub, open **Settings → Pages**.
3. Choose **GitHub Actions** as the source.
4. Open **Actions** and wait for the Pages workflow to receive a green tick.

The repository includes `.github/workflows/pages.yml`, which validates the data and tests before publishing.

## Enable Connected Mode

Local Mode requires no account or backend. Connected Mode needs a Supabase project:

1. Create a Supabase project.
2. Enable **Authentication → Providers → Anonymous Sign-Ins**.
3. Run `supabase/migrations/001_hideline.sql` in the Supabase SQL editor for a new installation.
4. An installation originally created with HideLine 1.0 should also run `supabase/migrations/002_deduction_map.sql` once.
5. Put the project URL and public anon key in `config.js`, or enter them in the app's Settings screen.

```js
window.HIDELINE_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-PUBLIC-ANON-KEY",
  googleMapId: "1lDtKjR7rN1zelD3FjepU1XNvHmnb774"
};
```

No database migration is required when updating from HideLine 1.1 or later to 2.1. Full setup information is in `supabase/README.md`.

## Privacy model

- The seeker deduction board is private to the seeker team in Connected Mode.
- A team's hiding station, cards, notes and imported geometry remain team-private.
- Location sharing is off until a player starts it.
- Connected photo evidence is stored in a private bucket and viewed through short-lived signed links.
- Local Mode photos stay in that browser's IndexedDB.

Read `PRIVACY.md` before a public deployment.

## Map accuracy

The embedded Google My Map is the authoritative game boundary and curated POI reference. OpenStreetMap supplies the visible street and river-bank basemap in interactive maps. HideLine's Thames centreline/corridor, deduction grid, station centres, 500 m circles and offline vector fallback are planning aids rather than survey boundaries. Use normal player judgement for bridges, tunnels, borderline paths, entrances, source-layer errors and disputed locations.

## Important safeguards

- Real-world safety, staff instructions and access rules take priority.
- Do not use Street View, reverse-image search or AI to locate the hiders.
- Hiders must be in a valid station-centred 500 m zone when the hiding period ends.
- Endgame begins only when seekers are in the hiding zone and off transit.
- “Found” means within 2 m and the hiders have been spotted.
- Avoid underground/no-signal, nuisance or inaccessible hiding spots.

## Project structure

```text
.
├── .github/workflows/pages.yml   # tests and GitHub Pages deployment
├── assets/                        # app icons
├── docs/                          # handbook and architecture notes
├── scripts/                       # local server and validation
├── src/
│   ├── core/                      # timing, score and deduction engines
│   ├── data/                      # stations, questions, rules and map data
│   ├── services/                  # maps, location, TfL, Supabase and evidence
│   └── ui/                        # game-day interface
├── supabase/                      # optional Connected Mode schema
├── tests/                         # deterministic tests
├── config.js                      # public deployment configuration
├── manifest.webmanifest           # install metadata
└── service-worker.js              # offline app shell
```

## Quality checks

```bash
npm run validate
npm test
npm run check
```

The test suite validates all 100 station records, all 55 linked questions, rail-line presets, timing, scoring, the remapped Thames guide, coordinate-map controls, deduction masks, Tentacles and movement-aware Endgame carry-forward.

## Licence

The original HideLine source is MIT licensed. The supplied handbook, Google map content, transport-service names, tiles and external services retain their own ownership and terms. See `THIRD_PARTY_NOTICES.md` before redistributing third-party material.

HideLine is an independent companion and is not an official product of the creators or publishers of any referenced game, map or transport service.
