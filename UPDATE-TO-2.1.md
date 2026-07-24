# Updating HideLine to 2.1.0

Version 2.1 keeps the simple three-screen game-day layout and improves three map workflows.

## River Thames remap

The old coarse guide is replaced by a 614-point, variable-width planning centreline generated from 57 bridge-anchored control points and interpolated at roughly 35 m spacing. The important western bends through Hammersmith, Putney, Fulham, Wandsworth and Battersea have been corrected.

On the online interactive map, HideLine leaves the OpenStreetMap water polygon unobstructed rather than drawing a thick approximate line over it. The built-in guide still drives north/south Thames deductions and the offline vector fallback.

This is a game-planning aid, not a surveyed bank boundary. Use the official game map and player judgement for bridges, tunnels, islands, foreshore and borderline positions.

## Earlier answers in Endgame

Opening the Endgame circle now carries the Find Hiders answers into the selected 500 m circle automatically.

- Station facts and fixed-spot Endgame answers remain hard grey exclusions.
- Earlier location answers appear as blue hatching, showing where that answer ruled the hider out at the time.
- New Endgame answers are intersected at one fixed hiding spot.

The blue distinction is intentional: before Endgame the hider may move inside the 500 m zone after answering, so an earlier Radar or Thermometer answer cannot prove their final position. The earlier clue stays visible without needing to ask it again.

## Pick coordinates from map

Every question that needs a coordinate now includes **Pick coordinates from map**.

1. Open the question.
2. Select **Pick coordinates from map** beside the relevant location.
3. Tap the map or drag the marker.
4. Optionally select **Use my GPS**.
5. Select **Use this point**.

HideLine fills the latitude, longitude and a shareable Google Maps pin automatically. Thames-side Matching also derives north, south or the bridge/tunnel corridor from the chosen point. If Leaflet or online tiles cannot load, a built-in vector picker remains available.

## Upload the update

1. Extract `HideLine-Map-Accuracy-Endgame-Picker-Update-v2.1.0.zip`.
2. Open the **Code** page of the GitHub `HideLine` repository.
3. Select **Add file → Upload files**.
4. Drag everything inside the extracted update folder into GitHub.
5. Confirm replacement of files with the same names.
6. Commit directly to `main` with the message:

```text
Improve Thames, Endgame clues and coordinate picking
```

7. Open **Actions** and wait for the Pages deployment to receive a green tick.
8. Refresh the published app. For an installed PWA, fully close it, reopen it and refresh once so the 2.1 service worker replaces the old cache.

The update package excludes `config.js`, so existing Supabase credentials and the Google map ID are preserved.

## Supabase

No Supabase migration is required when updating from HideLine 1.1 or later. Connected rooms continue to store deduction information inside the existing private team-state JSON.

## Verification

With Node.js 20 or newer:

```bash
npm run check
npm run dev
```
