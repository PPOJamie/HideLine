# Updating HideLine to 2.1.2

This update fixes the Connected Mode map repeatedly refreshing, recentring and becoming difficult to pan while live Supabase updates arrive.

## What changed

- Supabase presence heartbeats no longer reload the whole game.
- Live player positions update the zone map in place.
- Roster and timeline changes no longer rebuild the deduction map.
- Game and team changes rebuild the map only when they alter questions, deductions, the round, Endgame state or imported map data.
- The current deduction-map centre and zoom are retained after a meaningful live update.
- Detailed grey/green masks are hidden during a drag or pinch and redrawn after the gesture finishes.

## Uploading the update

1. Extract `HideLine-Connected-Map-Performance-Update-v2.1.2.zip`.
2. Open the **Code** page of your GitHub repository.
3. Choose **Add file → Upload files**.
4. Drag everything inside the extracted update folder into GitHub.
5. Confirm that the existing files will be replaced.
6. Commit directly to `main` with the message:

```text
Improve Connected Mode map performance
```

7. Wait for the GitHub Pages workflow to show a green tick.
8. Fully close the installed app on each phone, reopen it and refresh once so the new service worker replaces the old cache.

The update package does not contain `config.js`, so it will not overwrite your Supabase URL, publishable key or Google map configuration.

## Supabase

No additional Supabase migration is needed for this performance fix.

The update also includes `supabase/migrations/003_fix_join_game_ambiguity.sql` for repository completeness. Because you have already run the join repair successfully, you do not need to run it again.

## Quick test

1. Open the same Connected Mode room on two devices.
2. Enable location sharing on one or both devices.
3. Open **Map → Find hiders** and pan or zoom for at least one minute.
4. The map should stay at the chosen view rather than jumping back every 15–20 seconds.
5. Ask and answer a map-linked question on the other device.
6. The new deduction should appear while the current centre and zoom remain in place.
