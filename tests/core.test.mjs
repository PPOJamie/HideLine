import test from "node:test";
import assert from "node:assert/strict";
import { calculateScore } from "../src/core/score.js";
import { haversineMetres, isWithinRadius } from "../src/core/geo.js";
import { activeElapsedSeconds, formatDuration } from "../src/core/time.js";
import { stationNameLength, STATIONS } from "../src/data/stations.js";
import { repeatedReward, QUESTION_BY_ID } from "../src/data/questions.js";

test("score formula applies traps before percentage and fixed bonuses afterwards", () => {
  const result = calculateScore({
    hidingSeconds: 3600,
    hidingPeriodSeconds: 2700,
    timeTraps: [{ seconds: 600 }],
    percentageBonuses: [{ percent: 25 }],
    timeBonuses: [{ seconds: 300 }],
    curseExtraTime: [{ seconds: 120 }],
    curseCures: [{ seconds: 2700 }],
    otherAdjustments: [{ seconds: -1800 }]
  });
  assert.equal(result.beforePercentage, 4200);
  assert.equal(result.afterPercentage, 5250);
  assert.equal(result.totalHidingSeconds, 6570);
  assert.equal(result.totalRoundSeconds, 9270);
});

test("haversine distance recognises a 500 m hiding zone", () => {
  const station = { lat: 51.5033, lng: -0.1195 };
  const near = { lat: 51.505, lng: -0.1195 };
  const far = { lat: 51.51, lng: -0.1195 };
  assert.ok(haversineMetres(station, near) < 500);
  assert.equal(isWithinRadius(near, station, 500), true);
  assert.equal(isWithinRadius(far, station, 500), false);
});

test("paused time is excluded from active elapsed time", () => {
  const start = "2026-07-23T09:00:00.000Z";
  const end = "2026-07-23T10:00:00.000Z";
  const pauses = [{ startedAt: "2026-07-23T09:15:00.000Z", endedAt: "2026-07-23T09:25:00.000Z" }];
  assert.equal(activeElapsedSeconds(start, end, pauses, end), 3000);
  assert.equal(formatDuration(3000), "50:00");
});

test("station name length counts spaces and punctuation", () => {
  assert.equal(stationNameLength("Tower Hill"), 10);
  assert.equal(stationNameLength("St. Paul's"), 10);
  assert.equal(STATIONS.length, 100);
});

test("repeat reward can multiply both draw and keep", () => {
  const question = QUESTION_BY_ID.get("matching-park");
  assert.deepEqual(repeatedReward(question, 3, "multiply-both"), { draw: 9, keep: 3, multiplier: 3 });
  assert.deepEqual(repeatedReward(question, 3, "draw-only"), { draw: 9, keep: 1, multiplier: 3 });
});
