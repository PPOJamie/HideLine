# Changelog

All notable changes to HideLine are documented here.

## 1.2.0 — Detailed area masks and Endgame circle

- Added cell-by-cell allowed, excluded and unresolved shading clipped to each station's exact 500 m circle.
- Added three linked map views: station Overview, per-question Answer Areas and a dedicated single-station Endgame circle.
- Added an **Inspect area** action for partial stations and higher-resolution masks for the selected station and Endgame view.
- Linked all 55 handbook questions to the deduction audit trail.
- Added automatic geometry for nearest-feature Matching, borough/constituency/ward Matching, nearest-feature Measuring, nearest-station Measuring and all four Tentacle categories.
- Added KML, KMZ and GeoJSON import for the authoritative game-map POIs, lines and polygons, including a browser-only KMZ reader and layer classification.
- Added manual circle/polygon deductions that can be linked to Photo, altitude/floor or other judgement-based answers without automated image solving.
- Added Endgame fixed-point intersection across all locked answers, with any of the 100 stations selectable even after an earlier mistaken elimination.
- Added detailed masks to the built-in vector fallback map for offline or blocked-map-library conditions.
- Added selected-circle focus in Answer Areas and Endgame, removed unrelated planning context from Endgame, and fixed narrow-phone horizontal overflow.
- Expanded the test suite to 21 deterministic tests covering full-circle cell coverage, all-question mapping, manual masks, nearest-feature regions, administrative polygons, Tentacles and Endgame intersections.
- Updated the PWA cache and documentation. No new Supabase migration is required for 1.2 because the private team state is already stored as JSONB.

## 1.1.0 — Live Deduction Map

- Added a seeker-private Live Deduction Map covering all 100 handbook station-centred 500 m zones.
- Added possible, partial, eliminated and priority statuses with station search, filters, manual eliminate/restore, priority marks, reason text, undo and round reset.
- Added rules-aware mobile-snapshot and endgame-locked calculations using 97 sampled points per station zone.
- Added automatic map-ready question support for Radar, Thermometer, station-name length, transit line/exact stops and Thames-side matching.
- Added manual Radar, Thermometer, exact-reference Measuring, station-name, transit and Thames-side tools.
- Added embedded coordinates and line memberships for all 100 hiding stations, enabling offline calculations and faster Zone Check setup.
- Added private per-round deduction state to Local and Connected Mode, plus the `002_deduction_map.sql` upgrade migration.
- Added Radar, Thermometer, distance and Thames overlays, plus a built-in vector fallback map that keeps station statuses and supported overlays usable when Leaflet or online tiles are unavailable.
- Added responsive mobile layouts and new deduction validation/browser smoke tests.

## 1.0.0 — Initial release

- Added a two-round London hide-and-seek game board with pause-aware timers and endgame controls.
- Added the handbook question catalogue, repeat multipliers, answer deadlines and photo evidence.
- Added authoritative-map embedding and a 500 m station-zone planning map.
- Added all 100 hiding stations, station-name lengths, random selection and used-station tracking.
- Added score calculation, hider cards, curses, time traps, transit notices, TfL status and safety checklists.
- Added offline-capable Local Mode and optional Supabase Connected Mode with team-private state and opt-in positions.
- Added install metadata, responsive/dark UI, automated tests and GitHub Pages deployment.
