# HideLine 2.3.3 update guide

Version 2.3.3 repairs the mobile Body of Water map and adds a bundled water-edge atlas so the question can produce Find Hiders shading without relying on imported water polygons.

## What changes

### Mobile water picker

The map and confirmation controls are now separate layout rows. On phones, the selected coordinates and these controls remain visible below the map:

- **Cancel**
- **Use this water edge**

The map area can pan and zoom without trapping the confirmation button below the visible page. The footer also includes mobile safe-area padding for installed PWAs.

### Built-in water-edge atlas

HideLine now bundles planning geometry for 36 major named water features across the game area, including:

- River Thames
- Regent's Canal and its main basins
- Grand Union Canal Paddington Arm and Paddington Basin
- St Katharine Docks, Shadwell Basin, Greenland Dock and South Dock
- Canada Water lake
- The Serpentine, Long Water and Round Pond
- major named park lakes and ponds in the play area

The atlas contains line or polygon edge geometry. Station pins, point placemarks, swimming pools and fountains cannot be used as water edges.

After either team chooses their current location, HideLine automatically selects the nearest mapped bank or shoreline and calculates the distance. **Review on map** remains available for borderline rulings or an omitted small water body.

### Find Hiders shading

A Body of Water answer now becomes map-ready immediately. For every sampled candidate location, HideLine calculates the distance to that candidate's own nearest valid water edge and compares it with the seeker's stored distance.

A same-named imported point placemark can no longer replace a usable built-in shoreline. This specifically prevents a place or station pin such as Canada Water from disabling or corrupting the water deduction.

The atlas is a game-planning dataset rather than a surveyed shoreline. The normal map and player judgement remain authoritative for tiny waters, foreshore details and borderline banks.

## Install with GitHub Desktop

1. Download and extract `HideLine-Water-Atlas-Mobile-Picker-Fix-Update-v2.3.3.zip`.
2. Open GitHub Desktop and select the local `PPOJamie/HideLine` repository.
3. Select **Repository → Show in Explorer** or **Show in Finder**.
4. Open the extracted `HideLine-v2.3.3-update` folder.
5. Copy everything inside that folder into the local HideLine repository.
6. Allow matching files to be replaced and keep the supplied folder structure.
7. Return to GitHub Desktop.
8. Commit with:

   ```text
   Fix water picker and add built-in water atlas
   ```

9. Select **Push origin**.
10. Open GitHub **Actions** and wait for the Pages deployment to receive a green tick.
11. Completely close HideLine on every device, reopen it and refresh once.

The update does not contain `config.js`, so it will not replace your Supabase URL, publishable key or Google map configuration.

## Test after deployment

### Seeker test

1. Open **Questions → Measuring → Body of Water**.
2. Choose the seeker location.
3. Confirm that a named nearest edge and distance appear automatically.
4. Select **Review on map**.
5. Pan and zoom the map.
6. Confirm that **Use this water edge** remains visible below the map.
7. Submit the point and ask the question.

### Hider test

1. Open the pending Body of Water question.
2. Select **Calculate and answer**.
3. Choose the hider's current location.
4. Confirm that HideLine selects a nearest water edge and calculates **Closer** or **Further**.
5. Submit the calculated answer.

### Find Hiders test

1. Open **Map → Find Hiders** on the seeker device.
2. Confirm that the Body of Water answer is listed as map-ready rather than unresolved.
3. Confirm that the station circles show green/grey area shading from the water-distance comparison.

## Supabase

No Supabase migration is required. Existing rooms, questions, answers and team-private deductions remain compatible.
