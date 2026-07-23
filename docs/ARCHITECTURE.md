# Architecture

## Runtime shape

HideLine is a static progressive web app. `index.html` loads deploy-time public configuration, the CSS bundle and `src/app.js`. The app renders semantic HTML into one shell and keeps serialisable game state in a small observable store.

No framework build output is committed or required. GitHub Pages can serve the repository directly.

## State boundaries

- **Shared game state:** phase, round, timers, transit notices, score, traps, question records and used stations.
- **Team-private state:** selected station/coordinates, hiding notes, hand and private notes.
- **Device state:** profile, UI selection, connection settings, local checklists and current location.
- **Binary evidence:** IndexedDB in Local Mode; private Supabase Storage in Connected Mode.

Keeping team-private state outside the shared game JSON is a core anti-leak property.

## Connected Mode

The browser signs in anonymously to Supabase. Security-definer RPCs create/join rooms and patch shared JSON state. Row Level Security governs reads/writes for roster, events, positions and team state. Supabase Realtime change feeds trigger a short debounced rehydrate, while Presence supplies online indicators.

The client deliberately remains usable when Connected Mode is unavailable: Local Mode uses the same domain model and UI without a backend.

## Maps

The authoritative game layer is a Google My Maps embed/link. The interactive planning map lazily loads Leaflet and OpenStreetMap tiles, then draws:

- an explicitly approximate game polygon;
- the selected station and 500 m circle;
- permitted visible player positions and accuracy circles.

Station centres are fetched from TfL first and Nominatim second, then cached locally.

## Offline behavior

The service worker caches the application shell and local source modules. Network-derived data—authoritative map, map tiles, TfL status, geocoding and Supabase—is not guaranteed offline. Previously saved Local Mode game state remains available.

## Testing strategy

Core tests cover the handbook score ordering, 500 m distance behavior, pause accounting, station name length and repeated-question rewards. `scripts/validate-data.mjs` checks the 100-station catalogue, question definitions and planning polygon.
