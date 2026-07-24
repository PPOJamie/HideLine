# Updating HideLine to 2.1.3

This is a frontend repair release. It restores the intended text spacing, cards and activity layout while retaining the Connected Mode map-performance changes from 2.1.2.

## What caused the problem

The previous small update replaced the application controller and stylesheet but did not force every browser and repository to replace the matching UI renderer files. A device could therefore combine an older HTML renderer with a newer stylesheet, producing compressed text and missing box layouts.

## Install

1. Extract `HideLine-Interface-Repair-Update-v2.1.3.zip`.
2. Open the **Code** page of the GitHub `HideLine` repository.
3. Choose **Add file → Upload files**.
4. Drag everything inside the extracted update folder into GitHub.
5. Confirm replacement of existing files and commit directly to `main`.
6. Wait for the GitHub Pages workflow to receive a green tick.
7. On every device, close HideLine completely, reopen it and refresh once.

The package deliberately excludes `config.js`, so existing Supabase credentials and map settings are retained. No Supabase migration is required.

## Verify

The Game screen should show four separate shortcut cards, properly spaced team/activity rows, and a normal message input. The map should remain responsive and should not jump every 15–20 seconds.
