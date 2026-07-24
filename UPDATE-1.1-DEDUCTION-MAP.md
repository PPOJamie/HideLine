# Update an existing HideLine repository to 1.1.0

This update adds the private Live Deduction Map without changing your public `config.js` values or deleting existing browser game data.

## Update through the GitHub website

1. Download and extract `HideLine-Deduction-Map-Update-v1.1.0.zip`.
2. Open your `HideLine` repository on GitHub and select **Code**.
3. Choose **Add file → Upload files**.
4. Open the extracted update folder and drag **all contents inside it** into GitHub's upload area. Do not upload the ZIP itself and do not add another enclosing folder.
5. GitHub should list a mixture of changed files and new files, including:
   - `src/core/deduction.js`
   - `src/data/station-geo.js`
   - `src/ui/deduction-view.js`
   - `supabase/migrations/002_deduction_map.sql`
6. Enter the commit message `Add Live Deduction Map` and select **Commit changes**.
7. Open **Actions** and wait for the Pages deployment to show a green tick. A repository using GitHub's **Static HTML** Pages workflow can deploy this app directly; there is no build step.
8. Open the published site, refresh once, then close and reopen any installed copy so the new service worker takes control.

The update package deliberately does not contain `config.js`, so it will not overwrite any Supabase URL, anon key or Google map ID you have already entered there.

## Connected Mode database step

- **Existing HideLine 1.0 Supabase project:** run `supabase/migrations/002_deduction_map.sql` once in the Supabase SQL Editor.
- **No Supabase project yet:** no action is needed for Local Mode. When enabling Connected Mode later, run the current `supabase/migrations/001_hideline.sql`; it already includes the 1.1 private team-state field.

The upgrade uses the existing JSONB team-state column, so no current room row needs a table conversion.

## Confirm the update

1. Open **Map → Deduction map**.
2. Confirm that the dashboard begins at **100 / 100** stations.
3. In the Question tool, select **Matching — station-name length**.
4. Choose `Tower Hill`, select `Same length`, and apply it.
5. The board should fall to 10 remaining stations. Select **Undo** to return to 100.

For automatic use during a game, open **Ask**, choose a supported Radar, Thermometer or Matching question, leave **Add this answer to the Deduction Map** enabled, enter the required seeker pin/line details, and submit the question. The private seeker map updates after the hider records the answer.

## What is private

In Connected Mode, the resulting elimination board, manual deductions, ignored answers, station priorities and overrides are saved only to the seeker's team state. The shared question record still contains information the hider needs to answer, such as the seeker pin, travel endpoints or selected train stops.

## Accuracy rule

The app samples 97 points across every 500 m station zone. Before endgame, answers are separate snapshots because hiders may move inside the zone. Endgame-locked answers are intersected at one fixed sampled point. Use the authoritative Google My Maps layer for borderline cases, administrative boundaries and curated POI rulings.
