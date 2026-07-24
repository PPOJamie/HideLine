import { readFile, readdir, access } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION } from "../src/core/constants.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const index = await readFile(resolve(root, "index.html"), "utf8");
assert(/^\s*<!doctype html>/i.test(index), "index.html must be the HideLine HTML entry page, not Markdown or documentation text.");
assert(index.includes(`./src/app.js?v=${APP_VERSION}`), `index.html must load src/app.js version ${APP_VERSION}.`);
assert(index.includes(`./src/styles.css?v=${APP_VERSION}`), `index.html must load src/styles.css version ${APP_VERSION}.`);
assert(index.includes(`window.__HIDELINE_EXPECTED_VERSION__ = "${APP_VERSION}"`), "index.html must include the matching deployment-version guard.");
assert(!index.startsWith("# Connected Mode setup"), "index.html has been overwritten by the Supabase README.");

const worker = await readFile(resolve(root, "service-worker.js"), "utf8");
assert(worker.includes(`hideline-shell-v${APP_VERSION}`), `service-worker.js must use cache version ${APP_VERSION}.`);
assert(worker.includes(`./src/app.js?v=${APP_VERSION}`), "The service worker must cache the versioned app entry file.");
assert(worker.includes("./src/core/notifications.js"), "The service worker must cache the notifications module.");
assert(worker.includes("./src/core/question-location.js"), "The service worker must cache the question-location module.");

const requiredFiles = [
  "src/app.js",
  "src/styles.css",
  "src/core/notifications.js",
  "src/core/question-location.js",
  "src/ui/question-location.js",
  "src/ui/questions-view.js",
  "src/ui/modals.js",
  "src/ui/shell.js",
  "src/services/supabase.js"
];
for (const relative of requiredFiles) {
  try { await access(resolve(root, relative)); }
  catch { failures.push(`Required application file is missing: ${relative}`); }
}

const rootEntries = await readdir(root, { withFileTypes: true });
const allowedRootJs = new Set(["config.js", "config.example.js", "service-worker.js"]);
const misplaced = rootEntries
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => {
    if (allowedRootJs.has(name)) return false;
    if ([".js", ".mjs"].includes(extname(name))) return true;
    return /^(styles|modals|shell|store|supabase|notifications|question-location|deduction-view)(?: \(\d+\))?\.(?:js|css)$/i.test(name);
  });
assert(!misplaced.length, `Nested source files were flattened into the repository root: ${misplaced.join(", ")}. Use the clean replacement package and preserve folders.`);

const suspiciousDuplicates = rootEntries
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => / \(\d+\)\./.test(name) || /^README \(\d+\)\.md$/i.test(name));
assert(!suspiciousDuplicates.length, `Duplicate browser-upload files are present at the repository root: ${suspiciousDuplicates.join(", ")}.`);

const appSource = await readFile(resolve(root, "src/app.js"), "utf8");
assert(appSource.includes("serialiseQuestionLocations"), "src/app.js is missing canonical question-coordinate persistence.");
assert(appSource.includes("syncPendingQuestionNotifications"), "src/app.js is missing pending-question notification reconciliation.");
assert(appSource.includes("window.__HIDELINE_LOADED_VERSION__ = APP_VERSION"), "src/app.js is missing the deployment-version handshake.");

if (failures.length) {
  console.error("Repository layout validation failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Validated repository layout for HideLine ${APP_VERSION}: entry page, versioned assets, notification/location modules and nested folder structure are intact.`);
