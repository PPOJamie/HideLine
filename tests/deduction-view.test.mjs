import test from "node:test";
import assert from "node:assert/strict";
import { renderDeductionView } from "../src/ui/deduction-view.js";

function stateFor(mode) {
  return {
    game: { round: 1, phase: "seeking", hiderTeam: "bravo" },
    profile: { team: "alpha" },
    connection: { mode: "local" },
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
          maskScope: "all"
        }
      },
      spatialData: { version: 1, sourceName: "No map data imported", importedAt: null, features: [] }
    },
    questions: [],
    ui: { deductionTool: "radar", deductionSearch: "", deductionSelectedStationId: null },
    location: { current: null }
  };
}

test("the simplified live map always uses the combined all-answer overlay", () => {
  const html = renderDeductionView(stateFor("answer"));
  assert.match(html, /The map always combines every usable answer/);
  assert.match(html, /aria-label="Live deduction map showing all excluded areas"/);
  assert.match(html, /Grey areas are impossible/);
  assert.doesNotMatch(html, /Show area/);
});

test("Endgame view provides an explicit route back to all station circles", () => {
  const html = renderDeductionView(stateFor("endgame"));
  assert.match(html, /data-action="deduction-exit-endgame"/);
  assert.match(html, /Back to all stations/);
  assert.match(html, /Every earlier answer is carried in automatically/);
  assert.match(html, /Earlier clue/);
  assert.match(html, />Earlier<\/span>/);
});
