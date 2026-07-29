# Update to HideLine 2.3.0

HideLine 2.3.0 is the game-day playtest repair. It fixes the timer and live-form problems, makes answers easier to review, explains every mapped measurement, and adds built-in administrative boundary sources and easier place selection.

## What this update changes

1. **Exact round starts** - selecting **Start now** records the precise second the button is pressed. A scheduled start is optional and accepts seconds.
2. **Question form drafts are protected** - unsaved coordinates, notes, selected places, checkboxes, radio buttons and open sections survive Connected Mode updates while the modal is open.
3. **Answers are easier to find** - **View answer** is available from the latest-answer card, question history, notifications and Recent Activity. It opens the full answer, question wording, pins, reference feature, notes, timings and photo evidence.
4. **Game boundary presentation is honest** - the red line is used only for the exact boundary imported from the configured Google My Map. The built-in approximation is amber and dashed.
5. **Measuring questions show their method** - the app names the exact map feature used, shows the nearest pin, line or polygon-edge point, displays the seeker's distance and explains what the hider must compare against.
6. **Administrative boundaries load automatically** - London borough, electoral ward and Westminster constituency polygons are requested from built-in official GLA/ONS sources and cached by the browser. They no longer rely on finding those layers in the Google My Map export.
7. **Tentacle answers use a drop-down** - the hider chooses from the valid mapped places within 2 km of the seeker pin.
8. **POI questions use selectable map places** - park, zoo, museum, cinema, hospital, library, consulate, aquarium, water and high-speed-rail workflows can confirm the exact feature while the question is asked.

## Install over HideLine 2.2.2

GitHub Desktop is recommended because it preserves the supplied folder structure.

1. Download and extract the 2.3.0 update ZIP.
2. In GitHub Desktop, open `PPOJamie/HideLine` and choose **Repository -> Show in Explorer** or **Show in Finder**.
3. Open the extracted `HideLine-v2.3.0-update` folder.
4. Copy everything inside it into the local HideLine repository folder.
5. Allow existing files to be replaced.
6. Return to GitHub Desktop and use the summary `Apply HideLine 2.3.0 game-day fixes`.
7. Select **Commit to main**, then **Push origin**.
8. Wait for the GitHub Pages Action to receive a green tick.
9. Completely close HideLine on every phone, reopen it and refresh once.

The update ZIP deliberately excludes `config.js`, so your Supabase URL, publishable key and Google map ID are preserved.

## No Supabase migration

HideLine 2.3.0 does not change the database schema. Do not rerun the base schema or the previous room-join repair.

## Game boundary check

Open **Map -> Find hiders**.

- A **solid red** boundary means the exact polygon from the configured Google My Map is loaded.
- An **amber dashed** boundary is the labelled planning fallback.

HideLine attempts the public KML load automatically. If the fallback remains, open the map-data section and select **Load official game map**. If Google blocks the direct browser request, export the My Map as KML or KMZ and import that file manually.

## Administrative boundary check

Open the map-data section. London boroughs, electoral wards and constituencies should each show **Ready** after the first online load. The browser then caches the Central London features for later use. Select **Refresh official boundaries** if a layer failed during a weak connection.

## Suggested playtest

1. Start a three-minute custom round with **Start now** and confirm it begins at 03:00.
2. Open a Radar question, select coordinates, and leave the modal open while another device sends an update. Confirm the coordinates remain.
3. Answer the question and use **View answer** from both Questions and Recent Activity.
4. Check that the exact game boundary is solid red or that the approximation is clearly amber and dashed.
5. Ask Body of Water Measuring and inspect the orange seeker reference point and line. On the hider map, use GPS to see the teal nearest water-edge result.
6. Ask London Borough, Electoral Ward and Constituency questions and confirm the official boundary names appear.
7. Ask a Tentacle question and confirm the hider receives a drop-down of valid places within 2 km.
8. Ask a nearest-park or nearest-museum Matching question and confirm the seeker can select or automatically resolve the exact mapped place.
