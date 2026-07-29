# Update to HideLine 2.3.1

HideLine 2.3.1 repairs the Body of Water Measuring workflow and the London administrative-boundary loader.

## What changes

### Body of Water

1. Choose the seeker pin.
2. Select **Pick nearest water edge from map**.
3. Tap a mapped body of water or its bank. HideLine snaps the reference to the nearest edge of that selected water body from the seeker pin.
4. When the named water is missing from the imported list, tap the shoreline directly and enter its name.
5. HideLine saves the exact reference coordinate and calculates the seeker distance automatically.

A manual shoreline remains a visible review clue. It is not used for unsafe automatic area elimination unless a complete geometry for that named water body is available.

### Boroughs, wards and constituencies

- The old human-facing/MapServer requests have been removed.
- HideLine now uses fixed official ONS FeatureServer layer URLs and field names.
- Queries use a Central London spatial envelope and client-side London-code filtering instead of the SQL expression that could return HTTP 400.
- GeoJSON automatically falls back to ArcGIS JSON.
- HTML/error responses are rejected rather than cached as boundary data.
- The Map Data panel reports each layer separately.

A successful response is cached in the browser for later use. Select **Clear cache and retry boundaries** after installing this update so any invalid response from an earlier release is removed.

## Installation

1. Download and extract the 2.3.1 update ZIP.
2. In GitHub Desktop, open the local `PPOJamie/HideLine` repository.
3. Select **Repository → Show in Explorer** or **Show in Finder**.
4. Open the extracted `HideLine-v2.3.1-update` folder.
5. Copy everything inside it into the local repository, preserving the supplied folders.
6. Allow matching files to be replaced.
7. Commit with the summary `Repair water references and official boundaries`.
8. Select **Push origin**.
9. Wait for the GitHub Pages Action to receive a green tick.
10. Completely close HideLine on every device, reopen it and refresh once.

The update package does not contain `config.js`, so it cannot overwrite the existing Supabase project URL, publishable key or Google map ID.

## Supabase

No Supabase migration is required. Do not rerun the base schema or previous room-join repair.

## Quick test

1. Open **Map → Find Hiders → Map data and reset**.
2. Select **Clear cache and retry boundaries**.
3. Confirm that boroughs, wards and constituencies each show **ready**.
4. Open **Questions → Body of water**.
5. Choose the seeker pin and select **Pick nearest water edge from map**.
6. Tap a water polygon or shoreline, then select **Use this point**.
7. Confirm that the water name, exact coordinate and calculated distance appear before submitting the question.
