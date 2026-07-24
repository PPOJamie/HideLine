# Update HideLine to 2.0 — Simple Game Day

HideLine 2.0 keeps the existing game data and multiplayer model but replaces the complex map-layer interface with a focused four-tab game-day experience.

## What changes

- Four primary tabs: **Game**, **Questions**, **Map** and **More**.
- The Game screen shows the timer, current role and only the actions relevant to that phase.
- The Questions screen prioritises the waiting question and keeps long guidance/history collapsed.
- The Map always shows one combined deduction result; there is no normal layer selector.
- The Endgame view shows one station circle and has a clear **Back to all stations** button.
- Score, cards, traps and station selection remain available under More.
- Technical map import/manual geometry tools are hidden under **Map not matching?**.

No Supabase migration is required when upgrading from version 1.1 or later.

## Update an existing GitHub repository

1. Download and extract `HideLine-Simple-Game-Day-Update-v2.0.0.zip`.
2. Open the **Code** page of your GitHub `HideLine` repository.
3. Select **Add file → Upload files**.
4. Drag everything *inside* the extracted update folder into GitHub.
5. Allow GitHub to replace files with the same names.
6. Use the commit message:

   ```text
   Simplify HideLine for game day
   ```

7. Commit directly to `main`.
8. Open **Actions** and wait for the Pages deployment to receive a green tick.
9. Refresh the published app. For an installed PWA, close it fully, reopen it and refresh once so the 2.0 service worker replaces the old cache.

The update archive does **not** include `config.js`, so it will not overwrite Supabase credentials or the configured Google map ID.

## Existing games and data

The app keeps the same local-storage keys and Connected Mode team-state structure. Existing rooms, answers, deductions, cards and score records should therefore remain available. The old map settings are normalised into the new combined-map view the next time the map is opened.

## Roll back

The full version 1.3 repository can be restored by uploading that release again. Export important game records before any rollback because older code may not understand later state fields.
