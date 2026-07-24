# Updating HideLine to 2.2.2

Version 2.2.2 repairs the Endgame map shown in version 2.2.1. It makes the current search area clear and carries whole-station eliminations across from the All stations map.

## What changes

- The selected 500 m Endgame circle starts as a clean pale-green area.
- Strong red is used only for a genuine current exclusion.
- Earlier movable clues are combined into one light-blue overlap hint instead of dense hatching.
- If an earlier answer leaves no valid point anywhere in a station's zone, that station's whole Endgame circle is red.
- The panel shows the All-stations result, current area in play and earlier-clue overlap separately.
- Earlier radar circles, thermometer lines and POI outlines are hidden from the Endgame canvas to reduce clutter.

## Install over 2.2.1

1. Preserve your existing `config.js`.
2. Extract the update ZIP before copying files.
3. Copy the update files into the repository while preserving the supplied folders.
4. Commit and push to `main`.
5. Wait for the GitHub Pages workflow to finish successfully.
6. Fully close HideLine on every device, reopen it and refresh once.

The update package deliberately does not contain `config.js`.

## Supabase

No SQL migration is required. Existing rooms, room codes and team-private deduction state remain compatible.

## Interpreting the Endgame map

- **Pale green:** currently in play for the final fixed hiding spot.
- **Strong red:** ruled out by station facts, a station-wide earlier elimination or an answer recorded while the hider was fixed.
- **Light blue:** where all earlier movable clues overlap at one point. It is a planning hint, not a hard final-position rule.
- **Amber:** a clue still needs imported map data or player judgement.

A station can be labelled **Partly possible** on the All stations map while its whole Endgame circle is green. That means one or more earlier answers only fitted part of the zone at the time they were answered; the hider could then move elsewhere inside the same zone before Endgame.
