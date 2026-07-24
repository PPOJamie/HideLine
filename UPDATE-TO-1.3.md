# Update an existing HideLine repository to 1.3.0

HideLine 1.3.0 adds the combined all-answer exclusion overlay and a reliable way to leave the single-circle Endgame view.

## Recommended package

Use `HideLine-Combined-Overlay-Reset-Update-v1.3.0.zip` for an existing GitHub repository. It contains only the changed and new files and does **not** contain `config.js`, so it will not overwrite Supabase credentials or the configured Google map ID.

## Upload through GitHub

1. Download and extract the update ZIP.
2. Open the `HideLine` repository on GitHub.
3. Select **Code → Add file → Upload files**.
4. Drag everything **inside** the extracted update folder into the upload area.
5. Confirm GitHub says the existing files will be replaced.
6. Use the commit message:

   ```text
   Add combined deduction overlay and Endgame reset
   ```

7. Commit directly to `main`.
8. Open **Actions** and wait for the Pages deployment to receive a green tick.
9. Open the published app and perform a hard refresh. For an installed PWA, close it completely, reopen it and refresh once so the `v1.3.0` service worker replaces the previous cache.

## Using the new controls

Open **Map → Deduction map → Answer areas**. The first selector option is now:

```text
All linked answers — combined overlay
```

In this view:

- Grey means at least one ready linked answer excludes that cell.
- Darker grey means several answers exclude it.
- Green means every ready displayed answer permits that coordinate.
- Amber means the app still needs map data or player review.

After selecting an individual answer, use **Show all areas** above the Linked answers list to restore the complete overlay.

Inside **Endgame circle**, use **Show all circles** to clear the focused station and return to the complete Overview. This changes only the view; it does not delete question history or deductions.

## Important movement rule

The combined pre-Endgame mask is a planning overlay. The hider may move within the 500 m station zone between questions, so HideLine still evaluates station viability separately for each mobile snapshot. Only Endgame-locked answers are treated as one fixed physical location.

## Supabase

No database migration is required when updating from 1.1 or 1.2. An installation originally configured with HideLine 1.0 still needs `supabase/migrations/002_deduction_map.sql` once.

## Files changed

- `CHANGELOG.md`
- `README.md`
- `UPDATE-TO-1.3.md`
- `docs/ARCHITECTURE.md`
- `manifest.webmanifest`
- `package.json`
- `service-worker.js`
- `src/app.js`
- `src/core/constants.js`
- `src/core/deduction.js`
- `src/services/map.js`
- `src/styles.css`
- `src/ui/deduction-view.js`
- `src/ui/icons.js`
- `tests/deduction.test.mjs`
- `tests/deduction-view.test.mjs`
