import test from "node:test";
import assert from "node:assert/strict";
import { renderShell } from "../src/ui/shell.js";
import { renderPlay } from "../src/ui/play.js";
import { renderQuestionsView } from "../src/ui/questions-view.js";
import { renderRulesView } from "../src/ui/rules-view.js";
import { renderModal } from "../src/ui/modals.js";

function baseState() {
  return {
    profile: { id: "player-1", name: "Jamie", team: "alpha" },
    ui: { view: "play", installPromptAvailable: false, questionCategory: "all", questionSearch: "" },
    connection: { mode: "local", status: "offline", roomCode: null },
    game: null,
    questions: [],
    settings: { repeatRewardMode: "multiply-both" }
  };
}

test("the primary interface contains only four game-day tabs", () => {
  const html = renderShell(baseState(), "<p>content</p>");
  const mobileNav = html.match(/<nav class="mobile-nav[\s\S]*?<\/nav>/)?.[0] || "";
  assert.equal((mobileNav.match(/class="nav-button"/g) || []).length, 4);
  for (const label of ["Game", "Questions", "Map", "More"]) assert.match(mobileNav, new RegExp(`>${label}<`));
  assert.doesNotMatch(mobileNav, /Schedule|Checklist|Map data|Answer areas/);
});

test("the empty Game screen explains the three-step flow without setup clutter", () => {
  const html = renderPlay(baseState());
  assert.match(html, /Start the round/);
  assert.match(html, /Ask one question/);
  assert.match(html, /Follow the live map/);
  assert.doesNotMatch(html, /Planned Game Timings|Answer areas/);
});

test("the Questions screen keeps detailed guidance behind How to use", () => {
  const html = renderQuestionsView(baseState());
  assert.match(html, /Choose the next question/);
  assert.match(html, /<summary>How to use<\/summary>/);
  assert.match(html, /Question history \(0\)/);
});

test("Quick Rules exposes only the essential game-day numbers", () => {
  const html = renderRulesView();
  for (const value of ["45 min", "500 m", "5 min", "10 min", "2 m"]) assert.match(html, new RegExp(value.replace(" ", "\\s")));
  assert.match(html, /Use the full handbook only for edge cases/);
});


test("question coordinate fields offer a dedicated map picker", () => {
  const state = {
    ...baseState(),
    game: { round: 1, phase: "seeking" },
    location: { current: null },
    privateTeamState: { spatialData: { features: [] } }
  };
  const html = renderModal("ask-question", state, { questionId: "radar-2" });
  assert.match(html, /data-action="coordinate-picker-open"/);
  assert.match(html, /Pick coordinates from map/);
});

test("the shell includes a separate coordinate picker dialog", () => {
  const html = renderShell(baseState(), "<p>content</p>");
  assert.match(html, /id="coordinate-picker-modal"/);
});

test("Thames-side Matching uses a map pin instead of a manual side dropdown", () => {
  const state = {
    ...baseState(),
    game: { round: 1, phase: "seeking" },
    location: { current: null },
    privateTeamState: { spatialData: { features: [] } }
  };
  const html = renderModal("ask-question", state, { questionId: "matching-landmass" });
  assert.match(html, /Seeker pin for Thames-side matching/);
  assert.match(html, /data-prefix="deductionSeeker"/);
  assert.doesNotMatch(html, /name="deductionSeekerSide"/);
});
