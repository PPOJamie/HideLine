import test from "node:test";
import assert from "node:assert/strict";
import { renderShell } from "../src/ui/shell.js";
import { renderModal } from "../src/ui/modals.js";

function baseState() {
  return {
    profile: { id: "player-1", name: "Jamie", team: "alpha" },
    ui: { view: "play", installPromptAvailable: false, questionCategory: "all", questionSearch: "" },
    connection: { mode: "local", status: "offline", roomCode: null },
    game: { round: 1, phase: "seeking", hiderTeam: "bravo", teams: { alpha: { name: "Team Alpha" }, bravo: { name: "Team Bravo" } } },
    questions: [],
    location: { current: null },
    privateTeamState: { spatialData: { features: [] } },
    settings: { repeatRewardMode: "multiply-both" }
  };
}

test("question coordinate fields offer a dedicated map picker", () => {
  const html = renderModal("ask-question", baseState(), { questionId: "radar-2" });
  assert.match(html, /data-action="coordinate-picker-open"/);
  assert.match(html, /Pick coordinates from map/);
  assert.match(html, /data-prefix="deductionCentre"/);
});

test("the shell includes a separate coordinate picker dialog", () => {
  const html = renderShell(baseState(), "<p>content</p>");
  assert.match(html, /id="coordinate-picker-modal"/);
});

test("Thames-side Matching uses a map pin instead of a manual side dropdown", () => {
  const html = renderModal("ask-question", baseState(), { questionId: "matching-landmass" });
  assert.match(html, /Seeker pin for Thames-side matching/);
  assert.match(html, /data-prefix="deductionSeeker"/);
  assert.doesNotMatch(html, /name="deductionSeekerSide"/);
});
