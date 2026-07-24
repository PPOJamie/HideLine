import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const playSource = await readFile(new URL("../src/ui/play.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");

test("the current Game renderer uses the current card and activity components", () => {
  assert.match(playSource, /class="simple-stat-grid"/);
  assert.match(playSource, /class="simple-list-row activity-row"/);
  assert.doesNotMatch(playSource, /class="simple-snapshot-grid"/);
  assert.doesNotMatch(playSource, /class="simple-event-list"/);
});

test("legacy Game markup remains readable during a mixed-cache PWA upgrade", () => {
  for (const selector of [
    ".simple-snapshot-grid",
    ".simple-snapshot > strong",
    ".simple-event-list article",
    ".simple-event-list time",
    ".simple-team-summary .simple-team-row",
    ".simple-chat"
  ]) {
    assert.ok(styles.includes(selector), `Missing compatibility selector: ${selector}`);
  }
});

test("the 2.2.1 service worker precaches the Game renderer in a new shell", () => {
  assert.match(serviceWorker, /hideline-shell-v2\.2\.1/);
  assert.match(serviceWorker, /"\.\/src\/ui\/play\.js"/);
});
