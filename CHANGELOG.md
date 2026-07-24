# Changelog

All notable changes to HideLine are documented here.

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
