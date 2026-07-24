# Update an existing HideLine repository to 1.2.0

HideLine 1.2 adds detailed allowed/excluded masks inside partial 500 m circles, links all 55 handbook questions, imports authoritative KML/KMZ/GeoJSON geometry, calculates Tentacle areas and adds a dedicated single-station Endgame circle.

The update package deliberately omits `config.js`, so it will not overwrite your Supabase URL, anon key or Google My Maps ID.

## Upload through the GitHub website

1. Download and extract `HideLine-Area-Masks-Endgame-Update-v1.2.0.zip`.
2. Open your `HideLine` repository and select **Code**.
3. Select **Add file → Upload files**.
4. Open the extracted update folder and drag **everything inside it** into GitHub. Do not upload the ZIP itself and do not create another enclosing folder.
5. Confirm that GitHub lists changed/new files including:
   - `src/core/deduction.js`
   - `src/core/spatial.js`
   - `src/data/question-deduction.js`
   - `src/services/map.js`
   - `src/services/spatial-data.js`
   - `src/ui/deduction-view.js`
   - `UPDATE-TO-1.2.md`
6. Use the commit message `Add detailed area masks and Endgame map`.
7. Commit directly to `main`.
8. Open **Actions** and wait for the Pages deployment to show a green tick.
9. Open the published app and refresh it. For an installed copy, close it completely, reopen it, and refresh once so the 1.2 service worker replaces the old cache.

## Supabase

No new database migration is required when updating from HideLine 1.1. The detailed masks, imported geometry and Endgame selection use the existing private JSONB team-state row.

For an installation that is still on HideLine 1.0, run `supabase/migrations/002_deduction_map.sql` once before using Connected Mode. Local Mode never requires Supabase.

## Import the authoritative map layers

POI, administrative-boundary, street/path and Tentacle calculations need source geometry.

1. Open the game in HideLine and go to **Map → Deduction map**.
2. Open the source Google My Map in a browser.
3. Use its menu to export the map as KML/KMZ. Export the whole map rather than one layer when possible.
4. In HideLine's **Map data** card, choose that KML/KMZ file and select **Import file**.
5. Review the feature totals and classified layer chips.

HideLine can also import GeoJSON. Supplying a `category` property gives the most reliable classification. Supported category IDs include:

```text
park, zoo, museum, cinema, hospital, library, consulate, aquarium,
water, high_speed_rail, street_path, borough, constituency, ward
```

Unclassified features are retained but are not used for automatic deductions. If an important source layer is not classified correctly, adjust its folder/name in the My Map or supply GeoJSON with an explicit category.

## Confirm the detailed mask

1. In **Question tools**, choose **Radar**.
2. Pick a point near one edge of a station circle, set a radius that crosses the circle and apply a Yes or No answer.
3. Open **Answer areas** and set **Cell detail** to **Selected station only**.
4. Select a partial station. The impossible part of its 500 m circle should be grey, while the possible part is green.
5. Select **Inspect area** from a partial station row to jump directly to its detailed view.

## Confirm Tentacles

1. Import map data containing museum, library, movie-theatre or hospital POIs.
2. Choose **Question tools → Tentacles**.
3. Add the seeker's pin and the exact POI name returned by the hider.
4. HideLine limits the valid POIs to that category within 2 km of the seeker pin, then greys cells from which another valid POI would be closer.

A Tentacle answer remains unresolved and amber when the source category is absent or the POI name cannot be matched. This is deliberate: the app does not silently guess a different feature.

## Confirm the Endgame circle

1. Open **Endgame circle**.
2. Choose the suspected hiding station. All 100 stations remain selectable, including ones eliminated earlier.
3. Record new questions with **Endgame — fixed hiding spot** selected, or add locked manual tools.
4. The map focuses on only that station's 500 m circle and intersects all locked answers at one common point, including in the built-in offline vector fallback.
5. Grey cells are excluded, green cells remain possible, and amber cells indicate an answer still needs map data or human review.

Pre-endgame answers are intentionally not combined into one physical location because the hiders may move within the station zone between answers. Use **Answer areas** to inspect those snapshots separately.

## Photo and altitude answers

Every Photo and altitude/floor question is linked to the audit trail, but HideLine does not run automated image recognition, reverse-image search or AI solving. After a fair human deduction, use **Question tools → Manual area** to draw a circle or polygon and link it to the answered question, or make manual station eliminations.

## Accuracy

The detailed view uses a high-resolution grid clipped to the exact 500 m station circle. It is a planning aid rather than a legal/geodetic boundary. Use the authoritative game map and player judgement for borderline paths, entrances, disputed POIs, bridges/tunnels and source-layer errors.
