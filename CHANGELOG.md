# Changelog

All notable changes to HideLine are documented here.

## 2.1.3 — Interface consistency and cache repair

- Restored the intended spacing, typography, card layout and activity timeline after the 2.1.2 performance update.
- Packaged every UI renderer together with the matching stylesheet so partial GitHub uploads cannot leave incompatible interface versions behind.
- Added versioned entry-file URLs and network-first loading for JavaScript and CSS to prevent service-worker cache mixing.
- Kept the Connected Mode map optimisations from 2.1.2, including direct presence/location updates and retained map viewport.
- Added UI consistency and cache-strategy regression tests.
- Updated the PWA cache to 2.1.3. No Supabase migration is required.

## 2.1.2 — Connected Mode map performance

- Stopped Supabase presence heartbeats from triggering full database hydration and complete map reconstruction.
- Applied live position, member and timeline events directly from Realtime payloads.
- Applied game and team-state changes selectively, rebuilding the deduction map only when map-relevant data changed.
- Preserved the current deduction-map centre and zoom across meaningful remote updates.
- Hid the detailed exclusion canvas while panning or zooming and redrew it once after movement ended, improving touch responsiveness.
- Reduced high-DPI mask rendering cost while retaining readable area shading.
- Included the corrected `join_game` function in the fresh-install schema and added migration 003 for existing Supabase projects.
- Added four regression tests for heartbeat handling, direct position sync, redraw scheduling and viewport retention.
- Updated the service-worker cache and app version. No new database change is required if migration 003 was already applied.

## 2.1.0 — Thames, Endgame carry-forward and map coordinate picker

- Replaced the coarse Thames line with a 614-point, variable-width planning guide generated from 57 bridge-anchored control points and interpolated at roughly 35 m spacing.
- Stopped drawing a thick approximate river over the interactive OpenStreetMap water polygon.
- Carried every earlier linked answer into the Endgame map automatically.
- Kept station-level facts and fixed-spot Endgame answers as hard current exclusions while showing pre-Endgame mobile-location answers as blue historical hatching.
- Added **Pick coordinates from map** to every question workflow that requires a seeker, start, end or reference coordinate.
- Added a tap-and-drag map dialog, device-GPS shortcut, offline vector fallback and automatic Google Maps pin filling.
- Made Thames-side Matching derive north, south or the bridge/tunnel corridor from the selected map pin.
- Added regression tests for the western Thames bends, Endgame historical masks and coordinate-picker controls.
- Updated the service-worker cache and app version. No Supabase migration is required.

## 2.0.0 — Simplified game-day interface

- Reduced the primary navigation to **Game**, **Questions** and **Map**.
- Rebuilt the Game screen around the live timer, current role, one recommended next action and four concise shortcuts.
- Moved cards, traps, transit, scoring and private station controls into one collapsed **Game kit**.
- Rebuilt the Questions screen around the active question, category search and a collapsed history.
- Made the combined all-answer deduction overlay the only normal seeker-map workflow; technical layer selection and manual builders are no longer exposed in the main interface.
- Kept one dedicated Endgame view with a clear **Back to all stations** control.
- Reduced the map to three understandable choices: **Find hiders**, **My zone** and **Official map**.
- Collapsed map-data import, answer auditing, Connected Mode credentials and custom timing controls until they are needed.
- Added role-aware private controls so connected seeker devices do not display the other team's station or card manager.
- Added saved-state migration from the former Tools view and older deduction-map modes.
- Added mobile layout refinements so the combined map appears within the first screen rather than below several configuration panels.
- Updated install metadata, screenshots, tests, documentation and the service-worker cache. No Supabase migration is required.

## 1.3.0 — Combined exclusion overlay and Endgame reset

- Added an **All linked answers — combined overlay** option that shows exclusions from every ready linked answer across all visible 500 m station circles at the same time.
- Made the combined overlay the default Answer Areas view, including automatic migration from the former `latest` selection.
- Added darker grey shading when multiple answers independently exclude the same map cell.
- Kept pre-Endgame station viability movement-aware: the combined mask is a planning overlay and does not falsely eliminate a station when the hider could have moved between answer snapshots.
- Added **Show all areas** above the linked-answer audit trail to return from a single-answer inspection to the complete overlay in one tap.
- Added **Show all circles** inside the Endgame controls to clear the single-circle focus and return to the full Overview without deleting deductions.
- Fixed stale Endgame station focus continuing to zoom or highlight one station after switching back to Overview or Answer Areas.
- Made station-level answers such as station-name length and transit-line matching viewable as whole-circle masks alongside area-producing questions.
- Added deterministic mask, migration and rendered-UI tests. The suite now contains 25 tests.
- Updated the PWA cache and documentation. No Supabase migration is required.

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
