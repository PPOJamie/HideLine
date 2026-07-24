import test from "node:test";
import assert from "node:assert/strict";
import { renderDeductionView } from "../src/ui/deduction-view.js";
import { renderShell } from "../src/ui/shell.js";

function stateFor(mode) {
  return {
    game: {
      name: "London Hide + Seek",
      round: 1,
      phase: mode === "endgame" ? "endgame" : "seeking",
      hiderTeam: "bravo",
      members: [],
      teams: { alpha: { name: "Team Alpha" }, bravo: { name: "Team Bravo" } }
    },
    profile: { name: "Jamie", team: "alpha" },
    connection: { mode: "local", status: "offline", roomCode: null },
    privateTeamState: {
      deductionByRound: {
        1: {
          constraints: [{
            id: "manual-radar",
            type: "radar",
            movementMode: "mobile",
            centre: { lat: 51.5, lng: -0.1 },
            radiusMetres: 1000,
            answer: "yes"
          }],
          mapDisplayMode: mode,
          areaConstraintId: "all",
          showAreaMask: true,
          showEliminated: true,
          showZones: true,
          maskScope: "all",
          undoStack: []
        }
      },
      spatialData: { version: 1, sourceName: "No map data imported", importedAt: null, features: [] }
    },
    questions: [],
    ui: {
      view: "map",
      deductionTool: "radar",
      deductionSearch: "",
      deductionSelectedStationId: null,
      installPromptAvailable: false
    },
    location: { current: null }
  };
}

test("the standard deduction view combines all usable answers automatically", () => {
  const html = renderDeductionView(stateFor("answer"));
  assert.match(html, />\s*All stations\s*</);
  assert.match(html, /Everything is combined automatically\./);
  assert.match(html, /Green survives every map-ready answer/);
  assert.doesNotMatch(html, /Question tools/);
  assert.doesNotMatch(html, /deduction-builder/);
});

test("the Endgame view keeps earlier answers and has one clear route back", () => {
  const html = renderDeductionView(stateFor("endgame"));
  assert.match(html, /data-action="deduction-exit-endgame"/);
  assert.match(html, />\s*Back to all stations\s*</);
  assert.match(html, /All earlier answers are carried into Endgame automatically/);
  assert.match(html, /Earlier clue/);
  assert.match(html, /blue hatching/);
  assert.match(html, /do not need to ask the questions again/i);
});

test("the primary navigation contains only the three game-day destinations", () => {
  const state = stateFor("answer");
  state.ui.view = "play";
  const html = renderShell(state, "<p>Content</p>");
  const primary = html.match(/<nav class="side-nav">([\s\S]*?)<\/nav>/)?.[1] || "";
  assert.match(primary, />\s*Game\s*</);
  assert.match(primary, />\s*Questions\s*</);
  assert.match(primary, />\s*Map\s*</);
  assert.doesNotMatch(primary, />\s*Game kit\s*</);
  assert.doesNotMatch(primary, />\s*Quick rules\s*</);
});
