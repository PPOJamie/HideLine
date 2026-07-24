# Updating HideLine to 2.1.0

Version 2.1 keeps the simplified game-day layout and improves three map workflows requested during testing.

## What changes

### River Thames remap

The coarse river guide has been replaced with 57 hand-checked control points through the major London crossings and intervening bends. HideLine interpolates these to roughly 35 m spacing, producing more than 600 variable-width planning points for smoother calculations and offline rendering. On online interactive maps, HideLine now leaves the OpenStreetMap water shape unobstructed instead of drawing a thick approximate line over it. The remapped centreline still drives the north/south Thames-side deduction and the built-in offline map.

This remains a planning aid rather than a surveyed river-bank boundary. Use the official game map and normal player judgement for bridges, tunnels, islands, foreshore and borderline positions.

### Earlier answers in Endgame

Opening the Endgame circle now carries every linked answer from the Find Hiders map into the selected 500 m circle automatically.

- Station facts and fixed-spot Endgame answers remain hard current exclusions.
- Earlier location answers appear as blue hatching, showing where that answer ruled the hider out at the time.
- New Endgame answers are intersected as one fixed hiding spot.

The blue distinction is intentional: before Endgame, the handbook permits the hider to move inside the station zone after answering, so an earlier Radar or Thermometer clue cannot honestly prove their final position. No question needs to be re-asked merely to make its earlier result visible.

### Pick coordinates from map

Every question that needs coordinates now includes **Pick coordinates from map**.

1. Open the question.
2. Select **Pick coordinates from map** beside the relevant location.
3. Tap the map or drag the marker.
4. Optionally select **Use my GPS**.
5. Select **Use this point**.

HideLine fills the latitude, longitude and a shareable Google Maps pin automatically. Thames-side Matching also derives north, south or the bridge/tunnel corridor from the selected point. A built-in vector picker is available if Leaflet or online map tiles cannot load.

## Upload the update

1. Extract the 2.1 update ZIP.
2. Open the **Code** page of the GitHub `HideLine` repository.
3. Select **Add file → Upload files**.
4. Drag everything inside the extracted update folder into GitHub.
5. Confirm replacement of existing files.
6. Commit directly to `main` with the message:

```text
Improve Thames, Endgame carryover and coordinate picker
```

7. Open **Actions** and wait for the Pages deployment to receive a green tick.
8. Refresh the published app. For an installed PWA, fully close it, reopen it and refresh once so the 2.1 service worker replaces the old cache.

The update package excludes `config.js`, so existing Supabase credentials and Google map configuration are preserved.

## Supabase

No Supabase migration is required when updating from HideLine 1.1 or later. Connected rooms continue to store deduction information inside the existing private team-state JSON.

## Verification

Run locally with Node.js 20 or newer:

```bash
npm run check
npm run dev
```
