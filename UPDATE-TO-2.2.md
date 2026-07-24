# Updating HideLine to 2.2.0

HideLine 2.2.0 adds live game alerts, visible and clickable question coordinates, and a much clearer Endgame colour scheme.

## Update an existing GitHub repository

1. Extract the HideLine 2.2.0 update ZIP.
2. Open the `HideLine` repository on GitHub.
3. Select **Add file → Upload files**.
4. Upload everything inside the extracted update folder, preserving the folders.
5. Confirm replacement of the existing files and commit directly to `main`.
6. Wait for the GitHub Pages workflow to finish with a green tick.
7. Completely close and reopen HideLine on every device, then refresh once so the 2.2.0 service worker replaces the old cache.

The update package does not contain `config.js`; existing Supabase and Google map settings are preserved.

## Notifications

Important Connected Mode events now create an in-app pop-up. A new question produces an **Answer now** alert on the hider devices; answers, pauses, releases, Endgame changes, transit notices, safety checks and round changes also create relevant alerts.

In-app alerts are always active. To permit operating-system alerts while HideLine is open in the background, open **Settings → Game notifications** and select **Enable device alerts**. Browsers and mobile operating systems can suspend a web app after it has been fully closed, so this release does not claim guaranteed push delivery to a completely terminated app.

## Question coordinates

The active question now displays every recorded seeker/start/end/reference coordinate. Each coordinate is a link that opens the location in Google Maps. The collapsed question history also includes an **Open pin** action.

Coordinates chosen with **Pick coordinates from map** are automatically included. Existing question records containing structured coordinate data will also display their pins after the update.

## Endgame colours

The Endgame mask now uses:

- bright green for **Possible now**;
- strong red for **Ruled out now**;
- purple hatching for an earlier mobile-location clue;
- amber for an unresolved clue that still needs data or judgement.

## Supabase

No database migration is required. Existing room codes, team-private deductions, questions and answers continue to use the current schema.
