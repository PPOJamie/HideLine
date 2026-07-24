import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const mapSource = await readFile(new URL("../src/services/map.js", import.meta.url), "utf8");

test("presence heartbeats do not trigger a full Connected Mode hydration", () => {
  assert.match(appSource, /addEventListener\("presence", \(\) => this\.updateConnectionChrome\(\)\)/);
  assert.doesNotMatch(appSource, /addEventListener\("presence", \(\) => this\.scheduleRemoteRefresh\(\)\)/);
});

test("live positions are applied directly without rebuilding the deduction map", () => {
  assert.match(appSource, /table === "positions"[\s\S]*this\.applyRemotePosition\(payload\)/);
  assert.match(appSource, /source: "remote-position", persist: false/);
  assert.match(appSource, /noFullRender = new Set\(\["connection", "location", "remote-position", "presence"\]\)/);
});

test("area masks redraw after a pan or zoom instead of on every movement frame", () => {
  assert.match(mapSource, /map\.on\("movestart zoomstart", hideDuringMotion\)/);
  assert.match(mapSource, /map\.on\("moveend zoomend resize", finishMotion\)/);
  assert.doesNotMatch(mapSource, /map\.on\("move zoom resize viewreset", schedule\)/);
});

test("deduction map viewport is retained across meaningful live updates", () => {
  assert.match(mapSource, /deductionViewportCache/);
  assert.match(mapSource, /preservedViewport\?\.centre/);
  assert.match(mapSource, /activeDeductionViewportKey = viewportKey/);
});
