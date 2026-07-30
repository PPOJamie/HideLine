# HideLine 2.3.2 update guide

This release completely replaces the Body of Water dropdown. No other question type has been redesigned.

## What changed

### Asking Body of Water

1. Open **Questions → Measuring → Body of water**.
2. Choose the seeker's current position with **Use current GPS** or **Pick coordinates from map**.
3. Select **Select nearest water edge on map**.
4. On the normal basemap, zoom in and tap the exact nearest bank or shoreline of the nearest valid named blue water area.
5. The map shows:
   - a blue marker for the seeker position;
   - an orange marker for the selected water edge;
   - an orange dashed measurement line.
6. Select **Use this exact edge**. HideLine calculates and stores the seeker-to-edge distance automatically.
7. The water name is optional and is kept only as an audit note. It is not used in the calculation.

There is no water-name dropdown and HideLine does not guess which water body the players mean. When online map tiles are unavailable, expand **Enter exact water-edge coordinates manually** and paste the edge point measured in Google Maps.

### Answering Body of Water

1. On the hider device, open the pending question and select **Calculate and answer**.
2. Choose the hider's physical position at the moment of answering.
3. Select **Select my nearest water edge on map** and tap the exact nearest edge of the hider's own nearest valid named blue water area.
4. HideLine compares the hider's distance with the seeker's saved baseline and shows **Closer** or **Further**.
5. Select **Submit calculated answer**.

The hider's position and selected edge are used inside the modal only. They are not attached to the shared question or sent to the opposing team.

### Valid water references

Follow the handbook rule: use a named area shaded blue on the normal map and measure to its nearest edge. Swimming pools and fountains do not count. Point placemarks and station pins are not valid water-edge geometry. In particular, **Canada Water station is not treated as a body of water**.

A pending Body of Water question created with the old list is labelled for re-asking. This prevents a stale or incorrect place-name reference from being reused.

## Install over HideLine 2.3.1

1. Download and extract `HideLine-Body-of-Water-Rework-Update-v2.3.2.zip`.
2. In GitHub Desktop, open the local `PPOJamie/HideLine` repository.
3. Select **Repository → Show in Explorer** or **Show in Finder**.
4. Open the extracted `HideLine-v2.3.2-update` folder.
5. Copy everything inside that folder into the repository, preserving the supplied folders and replacing matching files.
6. Return to GitHub Desktop.
7. Commit with:

   ```text
   Rework Body of Water question
   ```

8. Select **Push origin**.
9. Wait for the GitHub Pages workflow to turn green.
10. Completely close HideLine on every device, reopen it and refresh once so the 2.3.2 service worker replaces the previous cache.

The update package does not contain `config.js`, so it does not replace the Supabase URL, publishable key or Google map configuration.

## Supabase

No Supabase migration is required. Existing rooms and completed questions remain compatible.

## Quick two-device test

1. Join one device as seekers and one as hiders.
2. Ask a new Body of Water question.
3. Confirm that no water-name dropdown appears.
4. Pick the seeker location and exact water edge; confirm a distance is shown before asking.
5. On the hider device, open **Calculate and answer**.
6. Pick the hider location and exact water edge; confirm the app displays Closer or Further.
7. Submit the answer and confirm only the answer—not the hider's private coordinates—appears on the seeker device.
