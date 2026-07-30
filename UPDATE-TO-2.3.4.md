# Updating HideLine to 2.3.4

Version 2.3.4 replaces the inaccurate hand-drawn water atlas and makes the supplied Google My Map the source of truth for the red Game Area and all 500 m station-circle centres.

## What was reviewed

The embedded fallback coordinate file has the same SHA-256 hash in HideLine 2.3.3 and 2.3.4:

```text
92e7ca85b5dc499330d2361fdb9f6318b906c905b36378b19921080080cac460
```

The previous update therefore did not deliberately move the circles. The visible offset came from circles being drawn from embedded fallback coordinates rather than the exact Hiding Stations pins in the supplied Google My Map.

## What changes

- GitHub Pages downloads and validates the supplied Google My Maps KML before publishing.
- Every handbook station is matched to a point in the KML **Hiding Stations** layer. That point is the centre of the 500 m circle.
- Deployment stops rather than publishing silently if the official boundary or any of the 100 station pins cannot be validated.
- The old `src/data/water-edges.js` atlas is no longer imported, cached or used.
- GitHub Pages obtains named OpenStreetMap water lines and polygons through Overpass and publishes a game-day snapshot with the app.
- HideLine converts mapped banks and shorelines to edge geometry, excludes pools and fountains, and clips all water to the exact official Game Area polygon.
- Body of Water and Find Hiders use the same clipped dataset.
- A temporary source outage can reuse the last verified deployment snapshot through the GitHub Actions cache.

## Install with GitHub Desktop

1. Download and extract `HideLine-Official-Map-Water-Accuracy-Update-v2.3.4.zip`.
2. Open GitHub Desktop and select `PPOJamie/HideLine`.
3. Select **Repository → Show in Explorer** or **Show in Finder**.
4. Open the extracted `HideLine-v2.3.4-update` folder.
5. Copy everything inside that folder into the local HideLine repository.
6. Allow matching files to be replaced and preserve all folders.
7. Return to GitHub Desktop.
8. Commit with:

```text
Use official station pins and mapped water boundaries
```

9. Select **Push origin**.
10. Open GitHub **Actions** and wait for **Deploy HideLine to GitHub Pages** to turn green.

The deploy job now contains a step named **Build official map and water snapshots**. It validates the KML and water response before publishing. If that step fails because an external source is temporarily unavailable, select **Re-run failed jobs** once; do not make another commit while the run is queued.

## Clear the previous PWA cache

After the green deployment:

1. Completely close HideLine on every device.
2. Close any browser tab showing HideLine.
3. Reopen the published app and refresh once.
4. For an installed Home Screen app, swipe it away first. Remove and reinstall it only if it still reports an older version.

The notification/settings panel should report version `2.3.4`.

## Verify the circle centres

Open:

```text
Map → Find Hiders → Map data and reset
```

The healthy state is:

```text
Official game map: Ready
100/100 official station pins
Exact red boundary active
```

Tap a station marker. Its popup should say:

```text
Circle centre: Official game-map pin
```

If any marker says **Embedded fallback**, select **Refresh official game map**. Do not use that circle for a borderline ruling until the official KML is ready.

## Verify Body of Water

In the same Map Data panel, the healthy state is:

```text
Named water edges: [number] in game area
```

The detail line shows both the source count and the number remaining after clipping to the official red boundary.

Then test:

1. Open **Questions → Measuring → Body of water**.
2. Pick a seeker location near a clearly mapped named river, canal, dock or lake.
3. Confirm that the orange marker snaps to a visible bank or shoreline rather than a station/place pin.
4. Ask and answer the question on separate devices.
5. Open **Map → Find Hiders** and confirm the answer reports **Mapped** and shades station-zone cells.

Water outside the official Game Area is intentionally absent. Very small, newly altered or unnamed waters may not appear; the handbook’s supplied map and player judgement remain the final authority for a borderline dispute.

## Supabase

No Supabase migration is required. Do not rerun the base schema or room-join fix.

## Files that are intentionally not replaced

The update does not contain `config.js`, so it preserves your Supabase URL, public key and Google map ID.
