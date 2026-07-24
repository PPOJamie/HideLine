# Architecture

## Runtime shape

HideLine is a static progressive web app. `index.html` loads deploy-time public configuration, the CSS bundle and `src/app.js`. The app renders semantic HTML into one shell and keeps serialisable game state in a small observable store.

No framework build output is committed or required. GitHub Pages can serve the repository directly.

## State boundaries

- **Shared game state:** phase, round, timers, transit notices, score, traps, question records and used stations. A structured question record may also contain the seeker pin, travel endpoints, line or other information required to reproduce its answer.
- **Team-private state:** selected station/coordinates, hiding notes, card hand, private notes, simplified imported spatial geometry and the per-round deduction/Endgame board (`deductionByRound`).
- **Device state:** profile, UI selection, connection settings, local checklists and current location.
- **Binary evidence:** IndexedDB in Local Mode; private Supabase Storage in Connected Mode.

Keeping the resulting elimination map, manual constraints, ignored-answer list and station marks outside the shared game JSON is a core anti-leak property.

## Connected Mode

The browser signs in anonymously to Supabase. Security-definer RPCs create/join rooms and patch shared JSON state. Row Level Security governs reads/writes for roster, events, positions and team state. Supabase Realtime change feeds trigger a short debounced rehydrate, while Presence supplies online indicators.

The client deliberately remains usable when Connected Mode is unavailable: Local Mode uses the same domain model and UI without a backend.

## Live Deduction Map

`src/core/deduction.js` is a deterministic rules engine with no map-library dependency. It uses two related representations of each 500 m station zone:

- **97 sample points** for fast all-station viability and possible/partial/eliminated classification;
- **square visual cells** for detailed masks. The renderer clips those cells to the station's exact 500 m circle, so the user can see the allowed, excluded and unresolved portions rather than only an amber station marker.

The engine supports two location semantics:

- **Mobile snapshot:** before endgame, every answer is evaluated independently. A station remains possible when its zone contains at least one valid point for each answer, even if those points differ between questions. The Answer Areas view can display one selected question, or a combined evidence overlay that greys a cell when any displayed answer excludes it. That combined overlay is visual only and is deliberately not fed back into mobile station elimination as a false fixed-location intersection.
- **Endgame locked:** all locked location constraints are intersected at the same cell because the hider is fixed. The Endgame view renders only the selected station circle and its common surviving mask.

Station-level filters such as station-name length and transit stops operate directly on the station catalogue. Area filters include Radar, Thermometer, exact-reference Measuring, nearest-feature Matching/Measuring, administrative-region matching, nearest-station Measuring, Thames-side matching, Tentacles and manual circles/polygons.

`src/data/question-deduction.js` maps all 55 handbook question IDs to either automatic geometry or guided review. Photo and altitude/floor questions stay linked to the audit trail but require a seeker-authored manual area or station decision; the client does not perform image recognition or AI solving.

`src/core/spatial.js` provides geometry containment, line/polygon distance, nearest-feature lookup and fuzzy answer-name resolution. `src/services/spatial-data.js` parses KML, KMZ and GeoJSON in the browser, simplifies large paths, infers feature categories from layer/name labels and writes the result only to team-private state.

The statuses are:

- `possible`: every sampled point survives the active location rules;
- `partial`: at least one, but not every, sampled point survives;
- `eliminated`: a station-level rule fails, no sampled point remains, or a private manual override removes it;
- `priority`: a seeker-private marker layered over a still-possible result.

Because this is finite sampling and imported source geometry may itself be approximate, close cases must be adjudicated with the authoritative game map.

## Maps

The authoritative game layer is a Google My Maps embed/link. The interactive planning surface lazily loads Leaflet and OpenStreetMap tiles, then draws:

- an explicitly approximate outer planning polygon outside Endgame mode;
- station markers and optional 500 m circles coloured by deduction status;
- a canvas-based detailed cell mask above the map tiles and below interactive markers;
- Radar, Thermometer, distance, Thames, manual-shape and imported-reference overlays;
- the selected private station and permitted visible player positions.

The mask renderer uses coarser cells when many circles are visible, finer cells for one selected answer circle and the finest cells in Endgame mode. In a combined overlay, the cell data also records how many answers exclude each point so the renderer can increase grey opacity for repeated independent exclusions. The same mask plans are rendered as clipped SVG polygons by the built-in vector fallback, so the allowed/excluded view does not depend on third-party map tiles.

All 100 station centres are embedded in `src/data/station-geo.js`. The Zone Check service uses those coordinates first, with TfL/Nominatim retained only as fallback resolvers. Imported spatial geometry remains a reference dataset for deductions; it does not replace the visible authoritative My Maps layer.

## Offline behavior

The service worker caches the same-origin application shell and source modules. The deduction engine, embedded station centres, question catalogue, built-in vector map and saved Local Mode state therefore remain available after a successful first load. Leaflet assets are runtime-cached after their first successful request. Authoritative maps, fresh map tiles, TfL status, GPS, fallback geocoding and Supabase still require network availability; previously viewed browser resources may remain available according to browser caching.

## Testing strategy

Core tests cover score ordering, 500 m distance behavior, pause accounting, station-name rules, repeated-question rewards, embedded coordinate completeness, 97-point viability sampling, full-circle visual-cell coverage, mobile-versus-locked movement semantics, combined all-answer masks, all-55-question mapping, manual polygons, nearest-feature regions, administrative polygons, Tentacles and Endgame intersections. Rendered-HTML tests also verify the all-answer control and the explicit Endgame exit control. `scripts/validate-data.mjs` checks the 100-station catalogue, embedded coordinates, question definitions, rail-line presets, planning polygon and install assets.

The release process also runs JavaScript syntax checks, clean-extraction validation and desktop/mobile browser smoke tests for map masks, mode switching, station inspection, manual area controls and horizontal overflow.
