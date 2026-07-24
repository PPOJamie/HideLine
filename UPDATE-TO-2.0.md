# Updating HideLine to 2.0

HideLine 2.0 replaces the layered technical interface with three game-day screens: **Game**, **Questions** and **Map**. Existing games, questions, cards, deductions and Supabase configuration remain compatible.

## GitHub update

1. Extract the HideLine 2.0 update package.
2. Open the **Code** page of the existing GitHub repository.
3. Select **Add file → Upload files**.
4. Drag everything inside the extracted update folder into GitHub.
5. Confirm replacement of the existing files.
6. Commit directly to `main` with a message such as:

```text
Simplify HideLine game-day interface
```

7. Open **Actions** and wait for the Pages workflow to receive a green tick.
8. Refresh the published app. For an installed copy, close it completely, reopen it and refresh once so the new service worker replaces the previous cache.

The update package deliberately excludes `config.js`, so it will not overwrite existing Supabase credentials or the configured Google map ID.

## What happens to existing saved data

The browser migration keeps the current game and moves old display preferences to the simplified defaults:

- the former Tools screen opens on Game;
- the map opens on the combined all-answer view;
- Endgame remains selected only when it was already active;
- area masks and 500 m circles stay enabled.

## Supabase

No database migration is required when upgrading from HideLine 1.1, 1.2 or 1.3.

An installation still using the original HideLine 1.0 schema must run:

```text
supabase/migrations/002_deduction_map.sql
```

## Rollback

The full 1.3 repository can be restored from Git history or the earlier release package. Browser state written by 2.0 uses the same core game structure, but always export important live-game data before replacing a deployed version.
