# Architecture

## Runtime shape

HideLine is a static progressive web app. `index.html` loads deploy-time public configuration, the CSS bundle and `src/app.js`. The app renders semantic HTML into one shell and keeps serialisable game state in a small observable store.

No framework build output is committed or required. GitHub Pages can serve the repository directly.

## State boundaries

- **Shared game state:** phase, round, timers, transit notices, score, traps, question records and used stations. A structured question record may also contain the seeker pin, travel endpoints, line or other information required to reproduce its answer.
- **Team-private state:** selected station/coordinates, hiding notes, card hand, private notes and the per-round deduction board (`deductionByRound`).
- **Device state:** profile, UI selection, connection settings, local checklists and current location.
- **Binary evidence:** IndexedDB in Local Mode; private Supabase Storage in Connected Mode.

Keeping the resulting elimination map, manual constraints, ignored-answer list and station marks outside the shared game JSON is a core anti-leak property.

## Connected Mode

The browser signs in anonymously to Supabase. Security-definer RPCs create/join rooms and patch shared JSON state. Row Level Security governs reads/writes for roster, events, positions and team state. Supabase Realtime change feeds trigger a short debounced rehydrate, while Presence supplies online indicators.

The client deliberately remains usable when Connected Mode is unavailable: Local Mode uses the same domain model and UI without a backend.

## Live Deduction Map

`src/core/deduction.js` is a deterministic rules engine with no map-library dependency. For each of the 100 handbook stations it samples the station centre plus four rings of 24 points, giving 97 candidate locations across the 500 m hiding zone.

The engine supports two location semantics:

- **Mobile snapshot:** before endgame, every answer is evaluated independently. A station remains possible when its zone contains at least one valid point for each answer, even if those points differ between questions.
- **Endgame locked:** locked location constraints are intersected. At least one sampled point must satisfy all locked answers together.

Station-level filters such as station-name length and transit stops operate directly on the station catalogue. Location filters currently include Radar, Thermometer, exact-reference Measuring and the simplified Thames-side rule. Supported answered question records become automatic constraints; manual constraints and station overrides live in team-private state. Unsupported POI and administrative-boundary deductions are handled through manual eliminate/restore/priority controls after checking the authoritative map.

The statuses are:

- `possible`: every sampled point survives the active location rules;
- `partial`: at least one, but not every, sampled point survives;
- `eliminated`: a station-level rule fails, no sampled point remains, or a private manual override removes it;
- `priority`: a seeker-private marker layered over a still-possible result.

Because this is finite sampling and because the Thames guide and planning boundary are simplified, close cases must be adjudicated with the authoritative Google My Maps layer.

## Maps

The authoritative game layer is a Google My Maps embed/link. The interactive planning surfaces lazily load Leaflet and OpenStreetMap tiles, then draw:

- an explicitly approximate game polygon;
- all station markers and optional 500 m circles, coloured by deduction status;
- Radar, Thermometer, distance and Thames overlays;
- the selected private station and 500 m zone;
- permitted visible player positions and accuracy circles.

All 100 station centres are embedded in `src/data/station-geo.js`. The Zone Check service uses those coordinates first, with TfL/Nominatim retained only as fallback resolvers. If Leaflet or online tiles cannot load, the Deduction Map renders a built-in projected SVG map of central London. This fallback still supports station-status markers, optional 500 m zone outlines, map-picked coordinates and Radar, Thermometer, distance and Thames overlays; it does not attempt to replace the authoritative boundary/POI map.

## Offline behavior

The service worker caches the same-origin application shell and source modules. The deduction engine, embedded station centres, question catalogue, built-in vector map and saved Local Mode state therefore remain available after a successful first load. Leaflet assets are runtime-cached after their first successful request. Authoritative maps, fresh map tiles, TfL status, GPS, fallback geocoding and Supabase still require network availability; previously viewed browser resources may remain available according to browser caching.

## Testing strategy

Core tests cover score ordering, 500 m distance behavior, pause accounting, station-name rules, repeated-question rewards, embedded coordinate completeness, 97-point zone sampling, mobile-versus-locked movement semantics, automatic question constraints and Thames-side classification. `scripts/validate-data.mjs` checks the 100-station catalogue, embedded coordinates, question definitions, rail-line presets, planning polygon and install assets.

The release process also runs JavaScript syntax checks and a browser smoke test covering the Deduction Map, automatic station filtering, manual elimination, undo and 390 px mobile overflow.
