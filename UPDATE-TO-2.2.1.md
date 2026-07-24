# Repairing HideLine with version 2.2.1

Version 2.2.1 repairs deployments in which browser upload placed nested source files in the repository root or replaced `index.html` with documentation. It also strengthens question-coordinate persistence and pending-question notifications.

## Why a clean replacement is required

GitHub Pages must receive the exact project folder structure. Files such as these must remain nested:

```text
src/app.js
src/core/notifications.js
src/core/question-location.js
src/ui/question-location.js
src/ui/modals.js
```

A file named `notifications.js` or `question-location.js` at the repository root is not used by the app. A root `index.html` beginning with `# Connected Mode setup` is documentation rather than the web-app entry page.

## Safest repair with GitHub Desktop

1. Install and open GitHub Desktop.
2. Clone `PPOJamie/HideLine`.
3. Open the cloned repository folder.
4. Copy the current `config.js` somewhere safe.
5. Delete everything in the cloned folder except the hidden `.git` folder and the saved `config.js`.
6. Extract the 2.2.1 clean-repair ZIP.
7. Copy everything inside its `repository-files` folder into the cloned repository.
8. Put the saved `config.js` back at the repository root.
9. In GitHub Desktop, commit with `Clean repair to HideLine 2.2.1`.
10. Select **Push origin**.
11. Wait for the Pages workflow to finish with a green tick.

The 2.2.1 workflow now checks the repository layout. It will refuse to deploy if the entry page is Markdown, if required nested modules are missing, or if source files have been flattened into the root.

## Test after deployment

1. Open **Settings → Game notifications** and choose **Test pop-up**. A dark HideLine alert must appear immediately.
2. On a seeker device, ask **2 km Radar**, choose **Pick coordinates from map**, choose a point and select **Use this point**.
3. After asking, the hider device must show **Question location** with the numeric coordinates and an **Open map** link.
4. The hider device should also receive a persistent **Question to answer** pop-up. If the Realtime event is interrupted, HideLine rechecks pending questions every five seconds and when the app returns to the foreground.

Operating-system notifications are separate from in-app pop-ups. They require browser permission and are only attempted when HideLine is in the background. A fully terminated mobile PWA may be suspended by the operating system.

## Supabase

No database migration is required for 2.2.1. Keep the existing `config.js` and do not rerun the base schema.
