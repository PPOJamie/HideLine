# Deployment-generated map data

GitHub Pages generates the files in this directory during deployment:

- `official-game-map.kml` — the supplied Google My Maps boundary and Hiding Stations pins.
- `osm-water.json` — named OpenStreetMap water geometry used for Body of Water calculations.
- `map-data-manifest.json` — source and validation diagnostics.

The generated snapshots are placed in the published Pages artifact. They are intentionally not hand-edited. The app clips water geometry to the official Game Area before using it.
