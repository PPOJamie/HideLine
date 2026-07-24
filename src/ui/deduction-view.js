import { DEFAULT_DURATIONS, PHASES } from "../core/constants.js";
import { escapeHtml } from "../core/format.js";
import {
  DEDUCTION_AREA_SELECTION_ALL,
  DEDUCTION_MAP_MODES,
  DEDUCTION_MOVEMENT,
  DEDUCTION_STATUS,
  DEDUCTION_TOOL_TYPES,
  constraintResolution,
  constraintTitle,
  deductionSummary,
  deriveAutomaticConstraints,
  evaluateStationPossibilities,
  evaluateZoneAreaMask,
  isMaskConstraint,
  lineName,
  normaliseDeductionRoundState
} from "../core/deduction.js";
import { normaliseSpatialData, spatialCategoryLabel, spatialDataStats } from "../core/spatial.js";
import { RAIL_LINES, STATION_GEO_BY_ID } from "../data/station-geo.js";
import { STATIONS, STATION_BY_ID, stationNameLength } from "../data/stations.js";
import { icon } from "./icons.js";

const FEATURE_CATEGORIES = Object.freeze([
  ["park", "Parks"],
  ["zoo", "Zoos"],
  ["museum", "Museums"],
  ["cinema", "Movie theatres"],
  ["hospital", "Hospitals"],
  ["library", "Libraries"],
  ["consulate", "Foreign consulates"],
  ["aquarium", "Aquariums"],
  ["water", "Bodies of water"],
  ["high_speed_rail", "High-speed railway lines"],
  ["street_path", "Streets / paths"]
]);

const REGION_CATEGORIES = Object.freeze([
  ["borough", "London borough"],
  ["constituency", "Parliamentary constituency"],
  ["ward", "Electoral ward"]
]);

function stationOptions(selectedId = "", includeBlank = true, stations = STATIONS) {
  return `${includeBlank ? '<option value="">Choose a hiding station…</option>' : ""}${stations.map((station) => `<option value="${station.id}" ${station.id === selectedId ? "selected" : ""}>${escapeHtml(station.name)}${station.note ? ` — ${escapeHtml(station.note)}` : ""}</option>`).join("")}`;
}

function lineOptions(selectedId = "") {
  const groups = new Map();
  for (const line of RAIL_LINES) {
    if (!groups.has(line.group)) groups.set(line.group, []);
    groups.get(line.group).push(line);
  }
  return `<option value="">Choose a line or operator…</option>${[...groups.entries()].map(([group, lines]) => `<optgroup label="${escapeHtml(group)}">${lines.map((line) => `<option value="${line.id}" ${selectedId === line.id ? "selected" : ""}>${escapeHtml(line.name)}</option>`).join("")}</optgroup>`).join("")}`;
}

function categoryOptions(categories, selected = "") {
  return categories.map(([id, label]) => `<option value="${id}" ${id === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function questionLinkOptions(state) {
  const round = state.game?.round || 1;
  const records = state.questions
    .filter((record) => (record.round || 1) === round && record.status === "answered" && record.askedByTeam === state.profile.team)
    .sort((a, b) => new Date(b.answeredAt || b.askedAt) - new Date(a.answeredAt || a.askedAt));
  return `<option value="">No linked question</option>${records.map((record) => `<option value="${record.id}">${escapeHtml(record.questionName)} — ${escapeHtml(record.answer || "answered")}</option>`).join("")}`;
}

export function buildDeductionViewModel(state) {
  const round = state.game?.round || 1;
  const roundState = normaliseDeductionRoundState(state.privateTeamState?.deductionByRound?.[round]);
  const displayMode = roundState.mapDisplayMode === DEDUCTION_MAP_MODES.ENDGAME
    ? DEDUCTION_MAP_MODES.ENDGAME
    : DEDUCTION_MAP_MODES.ANSWER;
  const spatialData = normaliseSpatialData(state.privateTeamState?.spatialData);
  const allAutomatic = deriveAutomaticConstraints({
    questions: state.questions,
    team: state.profile.team,
    round,
    ignoredIds: []
  });
  const ignored = new Set(roundState.ignoredAutoConstraintIds || []);
  const automatic = allAutomatic.filter((constraint) => !ignored.has(constraint.id));
  const manual = (roundState.constraints || []).filter((constraint) => constraint?.enabled !== false);
  const constraints = [...automatic, ...manual];
  const mergedStations = STATIONS.map((station) => ({ ...station, ...(STATION_GEO_BY_ID.get(station.id) || {}) }));
  const results = evaluateStationPossibilities({
    stations: mergedStations,
    constraints,
    stationOverrides: roundState.stationOverrides,
    radiusMetres: DEFAULT_DURATIONS.hidingZoneRadiusMetres,
    spatialFeatures: spatialData.features
  });
  const areaConstraints = constraints.filter(isMaskConstraint);
  const areaSelectionAll = true;
  const activeAreaConstraint = null;
  const answerConstraints = areaConstraints;
  const remaining = results.filter((result) => result.possible);
  const selectedCandidate = results.find((result) => result.id === roundState.endgameStationId)
    || results.find((result) => result.id === state.ui.deductionSelectedStationId)
    || remaining.find((result) => result.priority)
    || remaining[0]
    || null;
  const endgameMask = selectedCandidate
    ? evaluateZoneAreaMask({
      station: selectedCandidate,
      constraints,
      mode: "endgame",
      spatialFeatures: spatialData.features,
      cellSizeMetres: 25
    })
    : null;
  const endgameHistoryMask = selectedCandidate
    ? evaluateZoneAreaMask({
      station: selectedCandidate,
      constraints,
      mode: "history",
      spatialFeatures: spatialData.features,
      cellSizeMetres: 25
    })
    : null;
  const resolutions = new Map(constraints.map((constraint) => [constraint.id, constraintResolution(constraint, { spatialFeatures: spatialData.features })]));
  return {
    round,
    roundState,
    displayMode,
    spatialData,
    spatialStats: spatialDataStats(spatialData),
    allAutomatic,
    automatic,
    manual,
    constraints,
    areaConstraints,
    areaSelectionAll,
    activeAreaConstraint,
    answerConstraints,
    results,
    remaining,
    endgameStation: selectedCandidate,
    endgameMask,
    endgameHistoryMask,
    resolutions,
    summary: deductionSummary(results),
    isHider: Boolean(state.game && state.profile.team === state.game.hiderTeam),
    canView: state.connection.mode !== "connected" || !state.game || state.profile.team !== state.game.hiderTeam
  };
}

function metric(label, value, note, tone = "") {
  return `<div class="metric-card card deduction-metric ${tone}"><span class="metric-label">${escapeHtml(label)}</span><strong class="metric-value">${escapeHtml(value)}</strong><span class="tiny muted">${escapeHtml(note)}</span></div>`;
}

function renderPrivacyLocked() {
  return `
    <section class="card card-pad deduction-private-lock">
      <div class="empty-state" style="min-height:420px"><div class="empty-state-inner">
        <span class="empty-icon">${icon("lock")}</span>
        <h2>Seeker-team private map</h2>
        <p>The Deduction Map is intentionally hidden from the active hider team in Connected Mode. Question and answer records still remain shared as the handbook requires.</p>
        <p class="small muted">Switch to the seeker-team profile only on a device that belongs to that team.</p>
      </div></div>
    </section>`;
}

function movementField(state, id) {
  const defaultMode = state.game?.phase === PHASES.ENDGAME ? DEDUCTION_MOVEMENT.LOCKED : DEDUCTION_MOVEMENT.MOBILE;
  return `
    <div class="field"><label for="${id}-movement">Hider movement at this answer</label>
      <select id="${id}-movement" name="movementMode">
        <option value="mobile" ${defaultMode === "mobile" ? "selected" : ""}>Before endgame — hider could move within the 500 m zone</option>
        <option value="locked" ${defaultMode === "locked" ? "selected" : ""}>Endgame — same fixed hiding spot</option>
      </select>
      <span class="field-hint">Pre-endgame answers are displayed one snapshot at a time. Endgame answers are intersected at one common point.</span>
    </div>`;
}

function coordinatePair(prefix, label, state, options = {}) {
  const current = options.useCurrent ? state.location?.current : null;
  const lat = current?.lat != null ? Number(current.lat).toFixed(6) : "";
  const lng = current?.lng != null ? Number(current.lng).toFixed(6) : "";
  const disabled = options.disabled ? "disabled" : "";
  return `
    <fieldset class="coordinate-pair">
      <legend>${escapeHtml(label)}</legend>
      <div class="field-row">
        <div class="field"><label for="${prefix}-lat">Latitude</label><input id="${prefix}-lat" name="${prefix}Lat" inputmode="decimal" type="number" step="any" min="-90" max="90" value="${lat}" required ${disabled} /></div>
        <div class="field"><label for="${prefix}-lng">Longitude</label><input id="${prefix}-lng" name="${prefix}Lng" inputmode="decimal" type="number" step="any" min="-180" max="180" value="${lng}" required ${disabled} /></div>
      </div>
      <div class="button-row compact">
        <button class="button button-soft button-small" type="button" data-action="deduction-fill-gps" data-prefix="${prefix}" ${disabled}>${icon("location")} Use GPS</button>
        <button class="button button-soft button-small" type="button" data-action="coordinate-picker-open" data-prefix="${prefix}" data-label="${escapeHtml(label)}" ${disabled}>${icon("map")} Pick coordinates from map</button>
      </div>
    </fieldset>`;
}

function commonManualFields(state) {
  return `
    <div class="field"><label for="deduction-label">Optional label</label><input id="deduction-label" name="label" maxlength="100" placeholder="e.g. Radar from Borough" /></div>
    <div class="field"><label for="deduction-linked-question">Link to an answered question</label><select id="deduction-linked-question" name="linkedQuestionInstanceId">${questionLinkOptions(state)}</select><span class="field-hint">Useful for photographs, altitude/floor answers and any clue that needs seeker judgement.</span></div>`;
}

function radarForm(state) {
  return `<form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.RADAR}">
    <div class="callout">${icon("radar")}<p><strong>Radar circle</strong>Enter the seeker pin and answer. Grey cells are impossible; green cells could have produced the answer.</p></div>
    ${coordinatePair("centre", "Seeker pin", state, { useCurrent: true })}
    <div class="field-row"><div class="field"><label for="radar-radius">Radius (km)</label><input id="radar-radius" name="radiusKm" type="number" inputmode="decimal" step="0.05" min="0.05" max="50" value="2" required /></div><div class="field"><label for="radar-answer">Answer</label><select id="radar-answer" name="answer"><option value="yes">Yes — inside</option><option value="no">No — outside</option></select></div></div>
    ${movementField(state, "radar")}${commonManualFields(state)}
    <button class="button button-primary" type="submit">${icon("plus")} Apply radar deduction</button>
  </form>`;
}

function thermometerForm(state) {
  return `<form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.THERMOMETER}">
    <div class="callout">${icon("thermometer")}<p><strong>Thermometer</strong>“Hotter” keeps points closer to the end; “Colder” keeps points closer to the start.</p></div>
    ${coordinatePair("start", "Start position", state)}${coordinatePair("end", "End position", state, { useCurrent: true })}
    <div class="field"><label for="thermometer-answer">Answer</label><select id="thermometer-answer" name="answer"><option value="hotter">Hotter</option><option value="colder">Colder</option></select></div>
    ${movementField(state, "thermometer")}${commonManualFields(state)}
    <button class="button button-primary" type="submit">${icon("plus")} Apply thermometer deduction</button>
  </form>`;
}

function distanceForm(state) {
  return `<form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.DISTANCE}">
    <div class="callout warning">${icon("alert")}<p><strong>Exact reference point only.</strong>Use the imported nearest-feature tool for “nearest park/museum/hospital” questions.</p></div>
    ${coordinatePair("seeker", "Seeker pin", state, { useCurrent: true })}${coordinatePair("target", "Exact reference pin", state)}
    <div class="field"><label for="distance-answer">Answer</label><select id="distance-answer" name="answer"><option value="closer">Hider is closer</option><option value="further">Hider is farther</option></select></div>
    ${movementField(state, "distance")}${commonManualFields(state)}
    <button class="button button-primary" type="submit">${icon("plus")} Apply exact-distance deduction</button>
  </form>`;
}

function featureMatchForm(state) {
  return `<form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_MATCH}">
    <div class="callout">${icon("match")}<p><strong>Nearest-feature matching</strong>Uses the authoritative imported POI/path layer to build nearest-feature regions automatically.</p></div>
    <div class="field"><label for="feature-match-category">Layer</label><select id="feature-match-category" name="category">${categoryOptions(FEATURE_CATEGORIES, "museum")}</select></div>
    ${coordinatePair("seeker", "Seeker pin", state, { useCurrent: true })}
    <div class="field"><label for="feature-match-answer">Answer</label><select id="feature-match-answer" name="answer"><option value="yes">Yes — same nearest feature</option><option value="no">No — different nearest feature</option></select></div>
    ${movementField(state, "feature-match")}${commonManualFields(state)}
    <button class="button button-primary" type="submit">${icon("plus")} Apply nearest-feature match</button>
  </form>`;
}

function regionMatchForm(state) {
  return `<form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.REGION_MATCH}">
    <div class="callout">${icon("map")}<p><strong>Administrative-region matching</strong>Uses imported borough, constituency or ward polygons.</p></div>
    <div class="field"><label for="region-match-category">Boundary layer</label><select id="region-match-category" name="category">${categoryOptions(REGION_CATEGORIES, "borough")}</select></div>
    ${coordinatePair("seeker", "Seeker pin", state, { useCurrent: true })}
    <div class="field"><label for="region-match-answer">Answer</label><select id="region-match-answer" name="answer"><option value="yes">Yes — same region</option><option value="no">No — different region</option></select></div>
    ${movementField(state, "region-match")}${commonManualFields(state)}
    <button class="button button-primary" type="submit">${icon("plus")} Apply region match</button>
  </form>`;
}

function featureDistanceForm(state) {
  return `<form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE}">
    <div class="callout">${icon("measure")}<p><strong>Nearest-feature measuring</strong>Compares the seeker and every map cell with the nearest imported feature in a category.</p></div>
    <div class="field"><label for="feature-distance-category">Layer</label><select id="feature-distance-category" name="category">${categoryOptions(FEATURE_CATEGORIES, "park")}</select></div>
    ${coordinatePair("seeker", "Seeker pin", state, { useCurrent: true })}
    <div class="field-row"><div class="field"><label for="feature-distance-answer">Answer</label><select id="feature-distance-answer" name="answer"><option value="closer">Hider is closer</option><option value="further">Hider is farther</option></select></div><div class="field"><label class="checkbox-row compact"><input type="checkbox" name="boundaryOnly" /><span>Measure to polygon boundary only</span></label><span class="field-hint">Use for the borough-boundary question.</span></div></div>
    ${movementField(state, "feature-distance")}${commonManualFields(state)}
    <button class="button button-primary" type="submit">${icon("plus")} Apply nearest-feature distance</button>
  </form>`;
}

function stationDistanceForm(state) {
  return `<form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.NEAREST_STATION_DISTANCE}">
    <div class="callout">${icon("station")}<p><strong>Nearest hiding-station measuring</strong>Uses all 100 handbook station pins embedded in HideLine.</p></div>
    ${coordinatePair("seeker", "Seeker pin", state, { useCurrent: true })}
    <div class="field"><label for="station-distance-answer">Answer</label><select id="station-distance-answer" name="answer"><option value="closer">Hider is closer</option><option value="further">Hider is farther</option></select></div>
    ${movementField(state, "station-distance")}${commonManualFields(state)}
    <button class="button button-primary" type="submit">${icon("plus")} Apply station-distance deduction</button>
  </form>`;
}

function tentacleForm(state) {
  return `<form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.TENTACLE}">
    <div class="callout">${icon("tentacles")}<p><strong>Tentacles</strong>HideLine first limits the imported POIs to those within 2 km of the seeker pin, then keeps cells for which the named answer is the closest valid POI.</p></div>
    <div class="field"><label for="tentacle-category">POI category</label><select id="tentacle-category" name="category">${categoryOptions(FEATURE_CATEGORIES.filter(([id]) => ["museum", "library", "cinema", "hospital"].includes(id)), "museum")}</select></div>
    ${coordinatePair("seeker", "Seeker pin", state, { useCurrent: true })}
    <div class="field"><label for="tentacle-answer-feature">POI name returned by the hider</label><input id="tentacle-answer-feature" name="answerFeatureName" maxlength="160" required placeholder="e.g. The British Museum" /></div>
    ${movementField(state, "tentacle")}${commonManualFields(state)}
    <button class="button button-primary" type="submit">${icon("plus")} Apply tentacle deduction</button>
  </form>`;
}

function stationNameForm(state) {
  return `<form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.STATION_NAME}">
    <div class="callout">${icon("station")}<p><strong>Station-name length</strong>Uses the exact 100 handbook names, including spaces and punctuation.</p></div>
    <div class="field"><label for="name-seeker-station">Seeker station</label><select id="name-seeker-station" name="seekerStationId" required>${stationOptions()}</select></div>
    <div class="field"><label for="name-answer">Hider's answer</label><select id="name-answer" name="answer"><option value="same">Same length</option><option value="longer">Hider station name is longer</option><option value="shorter">Hider station name is shorter</option></select></div>
    ${commonManualFields(state)}<button class="button button-primary" type="submit">${icon("plus")} Filter by name length</button>
  </form>`;
}

function transitForm(state) {
  return `<form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.TRANSIT}">
    <div class="callout warning">${icon("train")}<p><strong>Branches and stopping patterns matter.</strong>Exact stops take priority over the broad preset.</p></div>
    <div class="field"><label for="transit-line">Line / operator preset</label><select id="transit-line" name="lineId">${lineOptions()}</select></div>
    <div class="field"><label for="transit-stops">Exact stops in the game area (optional)</label><select id="transit-stops" name="stationIds" multiple size="8">${stationOptions("", false)}</select><span class="field-hint">Desktop: Ctrl/Cmd-click. Mobile: tap each stop.</span></div>
    <div class="field"><label for="transit-answer">Answer</label><select id="transit-answer" name="answer"><option value="yes">Yes — that train stops at the hiding station</option><option value="no">No — it does not stop there</option></select></div>
    ${commonManualFields(state)}<button class="button button-primary" type="submit">${icon("plus")} Apply transit deduction</button>
  </form>`;
}

function thamesForm(state) {
  return `<form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.THAMES}">
    <div class="callout warning">${icon("info")}<p><strong>Planning approximation.</strong>The river centreline is simplified. Bridges and tunnels count as matching both sides.</p></div>
    <div class="field-row"><div class="field"><label for="thames-side">Seeker side</label><select id="thames-side" name="seekerSide"><option value="north">North of the Thames</option><option value="south">South of the Thames</option><option value="both">On a bridge / in a tunnel</option></select></div><div class="field"><label for="thames-answer">Answer</label><select id="thames-answer" name="answer"><option value="yes">Yes — same landmass</option><option value="no">No — different landmass</option></select></div></div>
    ${movementField(state, "thames")}${commonManualFields(state)}<button class="button button-primary" type="submit">${icon("plus")} Apply Thames-side deduction</button>
  </form>`;
}

function manualAreaForm(state) {
  return `<form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.MANUAL_AREA}">
    <div class="callout warning">${icon("edit")}<p><strong>Manual area mask</strong>Use this after a photo, altitude/floor answer, matched street or any clue that needs fair seeker judgement. It is recorded in the audit trail and can be linked to the question.</p></div>
    <div class="field"><label for="manual-area-shape">Shape</label><select id="manual-area-shape" name="shape" data-action="deduction-area-shape"><option value="polygon">Polygon</option><option value="circle">Circle</option></select></div>
    <div class="deduction-shape-fields" data-shape-fields="polygon">
      <div class="field"><label for="manual-area-points">Polygon vertices</label><textarea id="manual-area-points" name="polygonPoints" rows="6" placeholder="51.501000,-0.120000&#10;51.504000,-0.115000&#10;51.500000,-0.108000"></textarea><span class="field-hint">One latitude,longitude pair per line. Add at least three vertices in order around the area.</span></div>
      <div class="button-row compact"><button class="button button-soft button-small" type="button" data-action="deduction-pick-vertex" data-prefix="polygon">${icon("map")} Add vertex on map</button><button class="button button-soft button-small" type="button" data-action="deduction-clear-vertices">${icon("refresh")} Clear vertices</button></div>
    </div>
    <div class="deduction-shape-fields" data-shape-fields="circle" hidden>
      ${coordinatePair("centre", "Circle centre", state, { useCurrent: true, disabled: true })}
      <div class="field"><label for="manual-area-radius">Radius (metres)</label><input id="manual-area-radius" name="radiusMetres" type="number" min="5" max="20000" step="5" value="250" disabled /></div>
    </div>
    <div class="field"><label for="manual-area-answer">Keep / exclude</label><select id="manual-area-answer" name="answer"><option value="inside">Keep only inside the shape</option><option value="outside">Exclude the inside of the shape</option></select></div>
    ${movementField(state, "manual-area")}${commonManualFields(state)}
    <button class="button button-primary" type="submit">${icon("plus")} Apply manual area</button>
  </form>`;
}

function renderTool(state) {
  const selected = state.ui.deductionTool || DEDUCTION_TOOL_TYPES.RADAR;
  const forms = {
    [DEDUCTION_TOOL_TYPES.RADAR]: radarForm,
    [DEDUCTION_TOOL_TYPES.THERMOMETER]: thermometerForm,
    [DEDUCTION_TOOL_TYPES.DISTANCE]: distanceForm,
    [DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_MATCH]: featureMatchForm,
    [DEDUCTION_TOOL_TYPES.REGION_MATCH]: regionMatchForm,
    [DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE]: featureDistanceForm,
    [DEDUCTION_TOOL_TYPES.NEAREST_STATION_DISTANCE]: stationDistanceForm,
    [DEDUCTION_TOOL_TYPES.TENTACLE]: tentacleForm,
    [DEDUCTION_TOOL_TYPES.STATION_NAME]: stationNameForm,
    [DEDUCTION_TOOL_TYPES.TRANSIT]: transitForm,
    [DEDUCTION_TOOL_TYPES.THAMES]: thamesForm,
    [DEDUCTION_TOOL_TYPES.MANUAL_AREA]: manualAreaForm
  };
  const render = forms[selected] || radarForm;
  return `<section class="card card-pad stack deduction-builder">
    <div class="section-head"><div><p class="eyebrow">Add or refine a deduction</p><h2>Question tools</h2></div></div>
    <div class="field"><label for="deduction-tool">Tool</label><select id="deduction-tool" data-action="deduction-tool">
      <option value="radar" ${selected === "radar" ? "selected" : ""}>Radar</option>
      <option value="thermometer" ${selected === "thermometer" ? "selected" : ""}>Thermometer</option>
      <option value="nearest-feature-match" ${selected === "nearest-feature-match" ? "selected" : ""}>Matching — nearest feature</option>
      <option value="region-match" ${selected === "region-match" ? "selected" : ""}>Matching — borough / constituency / ward</option>
      <option value="nearest-feature-distance" ${selected === "nearest-feature-distance" ? "selected" : ""}>Measuring — nearest feature / boundary</option>
      <option value="nearest-station-distance" ${selected === "nearest-station-distance" ? "selected" : ""}>Measuring — nearest hiding station</option>
      <option value="distance" ${selected === "distance" ? "selected" : ""}>Measuring — exact reference point</option>
      <option value="tentacle" ${selected === "tentacle" ? "selected" : ""}>Tentacles</option>
      <option value="station-name-length" ${selected === "station-name-length" ? "selected" : ""}>Matching — station-name length</option>
      <option value="transit-line" ${selected === "transit-line" ? "selected" : ""}>Matching — transit line</option>
      <option value="thames-side" ${selected === "thames-side" ? "selected" : ""}>Matching — Thames side</option>
      <option value="manual-area" ${selected === "manual-area" ? "selected" : ""}>Manual area — photos / judgement</option>
    </select></div>
    ${render(state)}
  </section>`;
}

function renderMapDataManager(model) {
  const stats = model.spatialStats;
  const categories = Object.entries(stats.categories).filter(([category]) => category !== "unknown").sort((a, b) => b[1] - a[1]);
  return `<section class="card card-pad stack spatial-data-card">
    <div class="section-head"><div><p class="eyebrow">Authoritative layers</p><h2>Map data</h2><p>Import the Google My Maps KML/KMZ so POI matching, measuring, boundaries and Tentacles use the same curated layers as the game.</p></div></div>
    <div class="grid grid-3 compact-grid">
      ${metric("Features", String(stats.total), stats.sourceName || "not imported")}
      ${metric("Classified", String(stats.total - (stats.categories.unknown || 0)), `${categories.length} usable layers`, stats.total ? "mint" : "warning")}
      ${metric("Unclassified", String(stats.categories.unknown || 0), "kept but not auto-used", stats.categories.unknown ? "warning" : "")}
    </div>
    ${categories.length ? `<div class="spatial-category-chips">${categories.map(([category, count]) => `<span class="badge badge-neutral">${escapeHtml(spatialCategoryLabel(category))}: ${count}</span>`).join("")}</div>` : `<div class="callout warning">${icon("info")}<p><strong>No authoritative feature layers imported.</strong>Radar, thermometer, station name, transit and Thames deductions still work. POI, region and Tentacle answers remain linked and will calculate automatically after import.</p></div>`}
    <form class="stack" data-form="spatial-data-import">
      <div class="field"><label for="spatial-data-file">KML, KMZ or GeoJSON file</label><input id="spatial-data-file" name="spatialDataFile" type="file" accept=".kml,.kmz,.geojson,.json,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" required /><span class="field-hint">In Google My Maps, open the three-dot menu and export the whole map as KML/KMZ. HideLine stores only simplified geometry in the seeker team's private state.</span></div>
      <div class="button-row"><button class="button button-primary button-small" type="submit">${icon("uploadCloud")} Import file</button><button class="button button-soft button-small" type="button" data-action="spatial-data-load-configured">${icon("download")} Try public map</button>${stats.total ? `<button class="button button-danger button-small" type="button" data-action="spatial-data-clear">${icon("trash")} Clear data</button>` : ""}</div>
    </form>
  </section>`;
}

function constraintDetails(constraint) {
  if (constraint.type === DEDUCTION_TOOL_TYPES.RADAR) return `${Number(constraint.radiusMetres) < 1000 ? `${Math.round(Number(constraint.radiusMetres))} m` : `${Number((Number(constraint.radiusMetres) / 1000).toFixed(2))} km`} · ${escapeHtml(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.TRANSIT) return `${constraint.stationIds?.length ? `${constraint.stationIds.length} exact stops` : escapeHtml(lineName(constraint.lineId))} · ${escapeHtml(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.STATION_NAME) return `${constraint.seekerLength} characters · ${escapeHtml(constraint.answer)}`;
  if (constraint.category) return `${escapeHtml(spatialCategoryLabel(constraint.category))} · ${escapeHtml(constraint.answerFeatureName || constraint.answer || "")}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.MANUAL_AREA) return `${constraint.shape || "polygon"} · ${escapeHtml(constraint.answer || "inside")}${constraint.linkedQuestionInstanceId ? " · linked to question" : ""}`;
  return escapeHtml(constraint.answer || "");
}

function renderConstraintList(model) {
  const ignored = new Set(model.roundState.ignoredAutoConstraintIds || []);
  const items = [
    ...model.allAutomatic.map((constraint) => ({ ...constraint, auto: true, ignored: ignored.has(constraint.id) })),
    ...model.roundState.constraints.map((constraint) => ({ ...constraint, auto: false, ignored: constraint.enabled === false }))
  ];
  return `<section class="card card-pad stack">
    <div class="section-head"><div><p class="eyebrow">Audit trail</p><h2>Linked answers</h2><p>Every handbook question can now appear here. Automatic geometry runs when its required layer exists; judgement-based clues remain explicit rather than guessed.</p></div><div class="button-row compact"><button class="button button-soft button-small" type="button" data-action="deduction-show-all-constraints" ${model.areaConstraints.length ? "" : "disabled"}>${icon("layers")} Show all areas</button><button class="button button-soft button-small" type="button" data-action="deduction-undo" ${model.roundState.undoStack?.length ? "" : "disabled"}>${icon("undo")} Undo</button></div></div>
    ${items.length ? `<div class="deduction-constraint-list">${items.map((constraint) => {
      const resolution = model.resolutions.get(constraint.id) || { ready: false, reason: "Ignored" };
      const stateBadge = constraint.ignored
        ? '<span class="badge badge-warning">Ignored</span>'
        : resolution.ready
          ? '<span class="badge badge-mint">Area ready</span>'
          : resolution.manual
            ? '<span class="badge badge-yellow">Guided review</span>'
            : '<span class="badge badge-warning">Needs map data</span>';
      return `<article class="deduction-constraint ${constraint.ignored ? "ignored" : ""}">
        <div class="deduction-constraint-main"><div class="row gap-sm wrap"><span class="badge ${constraint.auto ? "badge-blue" : "badge-neutral"}">${constraint.auto ? "Question" : "Manual"}</span><span class="badge ${constraint.movementMode === "locked" ? "badge-purple" : "badge-mint"}">${constraint.movementMode === "locked" ? "Endgame locked" : "Mobile snapshot"}</span>${stateBadge}</div><strong>${escapeHtml(constraintTitle(constraint))}</strong><span class="tiny muted">${constraintDetails(constraint)}</span>${!constraint.ignored && !resolution.ready ? `<span class="tiny warning-text">${escapeHtml(resolution.reason || "Not yet resolved")}</span>` : ""}</div>
        <div class="button-column compact">${!constraint.ignored && isMaskConstraint(constraint) ? `<button class="button button-soft button-small" type="button" data-action="deduction-show-constraint" data-id="${escapeHtml(constraint.id)}">${icon("eye")} Show area</button>` : ""}<button class="button button-soft button-small" type="button" data-action="${constraint.auto ? "deduction-toggle-auto" : "deduction-remove-constraint"}" data-id="${escapeHtml(constraint.id)}">${icon(constraint.auto && constraint.ignored ? "eye" : constraint.auto ? "eyeOff" : "trash")} ${constraint.auto ? (constraint.ignored ? "Use" : "Ignore") : "Remove"}</button></div>
      </article>`;
    }).join("")}</div>` : `<div class="empty-state" style="min-height:150px"><div class="empty-state-inner"><span class="empty-icon">${icon("filter")}</span><strong>No linked answers yet</strong><span>Ask a question or add a tool above.</span></div></div>`}
    <div class="button-row"><button class="button button-danger button-small" type="button" data-action="deduction-reset">${icon("refresh")} Reset round map</button></div>
  </section>`;
}

function statusLabel(result) {
  if (result.status === DEDUCTION_STATUS.PRIORITY) return "Priority";
  if (result.status === DEDUCTION_STATUS.PARTIAL) return "Partly possible";
  if (result.status === DEDUCTION_STATUS.ELIMINATED) return "Eliminated";
  return "Possible";
}

function reasonText(result) {
  if (result.failures.length) return result.failures[0];
  if (result.partials.length) return result.partials[0];
  if (result.unresolved?.length) return `${result.unresolved.length} linked answer${result.unresolved.length === 1 ? "" : "s"} awaiting map data or review`;
  if (result.passes.length) return `Passes ${result.passes.length} active deduction${result.passes.length === 1 ? "" : "s"}`;
  return "No active deduction rules yet";
}

function renderStationList(state, model) {
  const query = String(state.ui.deductionSearch || "").trim().toLowerCase();
  const filter = model.roundState.filter || "remaining";
  const filtered = model.results.filter((result) => {
    const matchesSearch = !query || `${result.name} ${result.service} ${result.note}`.toLowerCase().includes(query);
    const matchesFilter = filter === "all" || (filter === "remaining" && result.possible) || (filter === "eliminated" && !result.possible) || (filter === "priority" && result.priority);
    return matchesSearch && matchesFilter;
  });
  return `<section class="card card-pad stack deduction-stations-card">
    <div class="section-head"><div><p class="eyebrow">Station board</p><h2>${filtered.length} shown</h2><p>Tap a row to centre the map. In Answer Areas mode the selected station also receives a higher-resolution mask.</p></div></div>
    <div class="deduction-list-controls"><div class="field"><label for="deduction-search">Search stations</label><input id="deduction-search" data-action="deduction-search" type="search" value="${escapeHtml(state.ui.deductionSearch || "")}" placeholder="Station, service or note" /></div><div class="field"><label for="deduction-filter">Show</label><select id="deduction-filter" data-action="deduction-filter"><option value="remaining" ${filter === "remaining" ? "selected" : ""}>Remaining</option><option value="priority" ${filter === "priority" ? "selected" : ""}>Priority</option><option value="eliminated" ${filter === "eliminated" ? "selected" : ""}>Eliminated</option><option value="all" ${filter === "all" ? "selected" : ""}>All 100</option></select></div></div>
    <div class="deduction-station-list">${filtered.map((result) => {
      const manualEliminated = Boolean(result.override?.eliminated);
      const partialConstraintId = result.partialConstraintIds?.at(-1) || model.activeAreaConstraint?.id || "";
      const partialConstraint = model.constraints.find((constraint) => constraint.id === partialConstraintId);
      const inspectMode = partialConstraint?.movementMode === DEDUCTION_MOVEMENT.LOCKED ? DEDUCTION_MAP_MODES.ENDGAME : DEDUCTION_MAP_MODES.ANSWER;
      return `<article class="deduction-station-row status-${result.status}" data-station-id="${result.id}"><button class="deduction-station-focus" type="button" data-action="deduction-focus-station" data-id="${result.id}"><span class="station-status-dot" aria-hidden="true"></span><span><strong>${escapeHtml(result.name)}</strong><small>${escapeHtml(reasonText(result))}</small></span></button><span class="badge status-badge">${statusLabel(result)}</span><div class="deduction-station-actions">${result.baseStatus === DEDUCTION_STATUS.PARTIAL ? `<button class="button button-soft button-small" type="button" data-action="deduction-inspect-station" data-id="${result.id}" data-constraint-id="${escapeHtml(partialConstraintId)}" data-mode="${inspectMode}">${icon("eye")} Inspect area</button>` : ""}<button class="icon-button ${result.priority ? "active" : ""}" type="button" data-action="deduction-toggle-priority" data-id="${result.id}" title="${result.priority ? "Remove priority" : "Mark priority"}" ${result.possible ? "" : "disabled"}>${icon("star")}</button><button class="button button-soft button-small" type="button" data-action="deduction-toggle-eliminated" data-id="${result.id}">${manualEliminated ? "Restore manual" : "Eliminate"}</button></div></article>`;
    }).join("") || `<div class="empty-state" style="min-height:180px"><div class="empty-state-inner"><span class="empty-icon">${icon("search")}</span><strong>No stations match</strong><span>Clear the search or change the status filter.</span></div></div>`}</div>
  </section>`;
}

function mapModeTabs(roundState) {
  return `<div class="segmented-control deduction-mode-tabs" role="tablist" aria-label="Deduction map view">
    <button type="button" class="${roundState.mapDisplayMode === DEDUCTION_MAP_MODES.OVERVIEW ? "active" : ""}" data-action="deduction-map-display" data-mode="overview">Overview</button>
    <button type="button" class="${roundState.mapDisplayMode === DEDUCTION_MAP_MODES.ANSWER ? "active" : ""}" data-action="deduction-map-display" data-mode="answer">Answer areas</button>
    <button type="button" class="${roundState.mapDisplayMode === DEDUCTION_MAP_MODES.ENDGAME ? "active" : ""}" data-action="deduction-map-display" data-mode="endgame">Endgame circle</button>
  </div>`;
}


function endgameStationOptions(model) {
  const labels = {
    [DEDUCTION_STATUS.POSSIBLE]: "possible",
    [DEDUCTION_STATUS.PARTIAL]: "partial",
    [DEDUCTION_STATUS.PRIORITY]: "priority",
    [DEDUCTION_STATUS.ELIMINATED]: "eliminated"
  };
  return `<option value="">Choose the suspected hiding station…</option>${model.results.map((result) => `<option value="${result.id}" ${model.endgameStation?.id === result.id ? "selected" : ""}>${escapeHtml(result.name)} — ${labels[result.status] || "unknown"}</option>`).join("")}`;
}

function renderMapControls(model) {
  const mode = model.roundState.mapDisplayMode;
  if (mode === DEDUCTION_MAP_MODES.ANSWER) {
    return `<div class="deduction-map-controls detailed-controls">
      <div class="field grow"><label for="deduction-area-constraint">Displayed evidence</label><select id="deduction-area-constraint" data-action="deduction-area-constraint"><option value="${DEDUCTION_AREA_SELECTION_ALL}" ${model.areaSelectionAll ? "selected" : ""}>All linked answers — combined overlay (${model.areaConstraints.length})</option>${model.areaConstraints.length ? `<optgroup label="Individual answer">${model.areaConstraints.map((constraint) => `<option value="${constraint.id}" ${model.activeAreaConstraint?.id === constraint.id ? "selected" : ""}>${escapeHtml(constraintTitle(constraint))}</option>`).join("")}</optgroup>` : ""}</select><span class="field-hint">The combined view greys every cell excluded by one or more ready answers. Choose one answer for a clean single-question mask.</span></div>
      <div class="field"><label for="deduction-mask-scope">Cell detail</label><select id="deduction-mask-scope" data-action="deduction-mask-scope"><option value="all" ${model.roundState.maskScope === "all" ? "selected" : ""}>All visible circles</option><option value="selected" ${model.roundState.maskScope === "selected" ? "selected" : ""}>Selected station only</option></select></div>
      <label class="toggle-row"><input type="checkbox" data-action="deduction-show-area-mask" ${model.roundState.showAreaMask ? "checked" : ""} /><span>Show excluded cells</span></label>
      <label class="toggle-row"><input type="checkbox" data-action="deduction-show-eliminated" ${model.roundState.showEliminated ? "checked" : ""} /><span>Show eliminated stations</span></label>
    </div>`;
  }
  if (mode === DEDUCTION_MAP_MODES.ENDGAME) {
    const lockedAreaConstraints = model.constraints.filter((constraint) => constraint.movementMode === DEDUCTION_MOVEMENT.LOCKED && isMaskConstraint(constraint));
    const fraction = model.endgameMask?.allowedFraction;
    const unresolved = model.endgameMask?.unresolved?.length || 0;
    const areaLabel = !lockedAreaConstraints.length
      ? "100%"
      : fraction == null || unresolved
        ? "Pending"
        : `${Math.round(fraction * 100)}%`;
    const areaNote = !lockedAreaConstraints.length
      ? "no locked answers yet"
      : unresolved
        ? `${unresolved} answer${unresolved === 1 ? "" : "s"} need data/review`
        : `${model.endgameMask?.allowed || 0} of ${model.endgameMask?.total || 0} cells`;
    return `<div class="deduction-map-controls detailed-controls">
      <div class="field grow"><label for="deduction-endgame-station">Endgame station circle</label><select id="deduction-endgame-station" data-action="deduction-endgame-station">${endgameStationOptions(model)}</select><span class="field-hint">All 100 stations remain selectable so a mistaken earlier deduction cannot block the real endgame circle.</span></div>
      <button class="button button-soft endgame-exit-button" type="button" data-action="deduction-exit-endgame">${icon("map")} Show all circles</button>
      <label class="toggle-row"><input type="checkbox" data-action="deduction-show-area-mask" ${model.roundState.showAreaMask ? "checked" : ""} /><span>Grey excluded parts</span></label>
      <div class="endgame-area-readout"><span>Approx. area remaining</span><strong>${areaLabel}</strong><small>${escapeHtml(areaNote)}</small></div>
    </div>`;
  }
  return `<div class="deduction-map-controls"><label class="toggle-row"><input type="checkbox" data-action="deduction-show-zones" ${model.roundState.showZones ? "checked" : ""} /><span>Show all 500 m circles</span></label><label class="toggle-row"><input type="checkbox" data-action="deduction-show-eliminated" ${model.roundState.showEliminated ? "checked" : ""} /><span>Show eliminated stations</span></label></div>`;
}

function mapExplanation(model) {
  const mode = model.roundState.mapDisplayMode;
  if (mode === DEDUCTION_MAP_MODES.ANSWER) {
    if (model.areaSelectionAll) {
      if (!model.answerConstraints.length) {
        return `<div class="callout warning">${icon("info")}<p><strong>No map-ready answers yet.</strong>Ask a structured question, enable its deduction fields, or add a manual area. The combined overlay will update automatically as answers are linked.</p></div>`;
      }
      const mobile = model.answerConstraints.filter((constraint) => constraint.movementMode !== DEDUCTION_MOVEMENT.LOCKED).length;
      const locked = model.answerConstraints.length - mobile;
      return `<div class="callout">${icon("layers")}<p><strong>All exclusions at once.</strong>Grey means at least one of the ${model.answerConstraints.length} displayed answer${model.answerConstraints.length === 1 ? "" : "s"} excludes that cell; darker grey means several answers exclude it. Green survives every ready displayed answer at that coordinate, and amber still needs data or review.${mobile ? ` The ${mobile} mobile snapshot${mobile === 1 ? " is" : "s are"} overlaid for planning only—the station engine still allows the hider to move between answers.` : ""}${locked ? ` ${locked} endgame-locked answer${locked === 1 ? " is" : "s are"} also shown.` : ""}</p></div>`;
    }
    return `<div class="callout">${icon("filter")}<p><strong>One truthful snapshot.</strong>${model.activeAreaConstraint ? `The grey cells could not have produced “${escapeHtml(model.activeAreaConstraint.answerFeatureName || model.activeAreaConstraint.answer || "the answer")}" for this specific question.` : "Choose an answer."} Pre-endgame station viability remains movement-aware because the hider may have moved between questions.</p></div>`;
  }
  if (mode === DEDUCTION_MAP_MODES.ENDGAME) {
    const current = model.constraints.filter(isCurrentEndgameConstraint).length;
    const earlier = model.constraints.filter(isEarlierEndgameConstraint).length;
    return `<div class="callout ${current || earlier ? "" : "warning"}">${icon(current ? "target" : "info")}<p><strong>All answers carried forward.</strong>${current ? `${current} station/fixed-spot answer${current === 1 ? " is" : "s are"} a hard current exclusion.` : "No hard current exclusion yet."}${earlier ? ` ${earlier} earlier mobile clue${earlier === 1 ? " is" : "s are"} retained as blue hatching, because the hider could move before Endgame.` : ""}</p></div>`;
  }
  return `<div class="callout">${icon("info")}<p><strong>Station viability.</strong>Green means the full sampled zone survives, amber means at least one answer cuts through it, grey means the station is ruled out, and purple is a seeker priority. Open Answer Areas to see which exact part of an amber circle survived a chosen answer.</p></div>`;
}

function simpleConstraintState(model, constraint) {
  const resolution = model.resolutions.get(constraint.id) || { ready: false, manual: true, reason: "Needs review" };
  if (resolution.ready) return { label: "Mapped", className: "ready" };
  if (resolution.manual) return { label: "Review", className: "review" };
  return { label: "Needs data", className: "pending" };
}

function renderSimpleAnswerList(model) {
  const items = [
    ...model.allAutomatic.map((constraint) => ({ ...constraint, auto: true })),
    ...model.roundState.constraints.filter((constraint) => constraint?.enabled !== false).map((constraint) => ({ ...constraint, auto: false }))
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  if (!items.length) return `<div class="empty-state simple-empty"><div class="empty-state-inner"><span class="empty-icon">${icon("questions")}</span><strong>No answers yet</strong><span>Ask a question and the map will update automatically.</span></div></div>`;
  return `<div class="simple-linked-list">${items.slice(0, 8).map((constraint) => {
    const status = simpleConstraintState(model, constraint);
    const answer = constraint.answerFeatureName || constraint.answer || constraint.label || "Recorded";
    return `<article><span class="simple-linked-state ${status.className}" aria-hidden="true"></span><div><strong>${escapeHtml(constraintTitle(constraint))}</strong><small>${escapeHtml(String(answer))}</small></div><span>${status.label}</span></article>`;
  }).join("")}</div>${items.length > 8 ? `<p class="tiny muted">Showing the latest 8 of ${items.length} linked answers.</p>` : ""}`;
}

function renderSimpleCorrectionTools(model) {
  const ignored = new Set(model.roundState.ignoredAutoConstraintIds || []);
  const items = [
    ...model.allAutomatic.map((constraint) => ({ ...constraint, auto: true, ignored: ignored.has(constraint.id) })),
    ...model.roundState.constraints.map((constraint) => ({ ...constraint, auto: false, ignored: constraint.enabled === false }))
  ];
  return `<details class="simple-details"><summary>${icon("edit")} Correct a map answer</summary><div class="simple-details-body"><p class="small muted">Use this only when an answer was entered incorrectly or a manual deduction should be removed.</p>${items.length ? `<div class="simple-correction-list">${items.map((constraint) => `<article class="${constraint.ignored ? "ignored" : ""}"><div><strong>${escapeHtml(constraintTitle(constraint))}</strong><small>${escapeHtml(constraint.answerFeatureName || constraint.answer || constraint.label || "Recorded")}</small></div><button class="button button-soft button-small" type="button" data-action="${constraint.auto ? "deduction-toggle-auto" : "deduction-remove-constraint"}" data-id="${escapeHtml(constraint.id)}">${constraint.auto ? (constraint.ignored ? "Use again" : "Ignore") : "Remove"}</button></article>`).join("")}</div>` : `<p class="muted">Nothing to correct yet.</p>`}<div class="button-row"><button class="button button-danger button-small" type="button" data-action="deduction-reset">${icon("refresh")} Reset this round's map</button></div></div></details>`;
}

function renderSimpleStationList(state, model) {
  const query = String(state.ui.deductionSearch || "").trim().toLowerCase();
  const remaining = model.results.filter((result) => result.possible && (!query || `${result.name} ${reasonText(result)}`.toLowerCase().includes(query)));
  const visible = remaining.slice(0, query ? 100 : 18);
  return `<section class="card card-pad simple-station-board"><div class="section-head"><div><h2>Stations still in play</h2><p>Tap a station on the map for details. Use manual eliminate only for deductions made outside the app.</p></div><span class="simple-count-pill">${remaining.length}</span></div><label class="simple-search"><span class="sr-only">Search remaining stations</span>${icon("search")}<input type="search" data-action="deduction-search" value="${escapeHtml(state.ui.deductionSearch || "")}" placeholder="Search stations..." /></label><div class="simple-station-list">${visible.map((result) => `<article class="status-${result.status}"><button type="button" data-action="deduction-focus-station" data-id="${result.id}"><span class="station-status-dot"></span><span><strong>${escapeHtml(result.name)}</strong><small>${result.status === DEDUCTION_STATUS.PARTIAL ? "Some of the 500 m zone remains" : "Still possible"}</small></span></button><div><button class="icon-button ${result.priority ? "active" : ""}" type="button" data-action="deduction-toggle-priority" data-id="${result.id}" title="${result.priority ? "Remove priority" : "Mark priority"}">${icon("star")}</button><button class="button button-soft button-small" type="button" data-action="deduction-toggle-eliminated" data-id="${result.id}">Eliminate</button></div></article>`).join("") || `<div class="empty-state simple-empty"><div class="empty-state-inner"><strong>No stations match</strong><span>Clear the search to see the remaining list.</span></div></div>`}</div>${!query && remaining.length > visible.length ? `<p class="tiny muted">Showing the first ${visible.length}. Search to find any other remaining station.</p>` : ""}</section>`;
}

function renderSimpleMapData(model) {
  const unresolved = model.constraints.filter((constraint) => {
    const resolution = model.resolutions.get(constraint.id);
    return resolution && !resolution.ready && !resolution.manual;
  });
  if (!unresolved.length) return "";
  return `<section class="callout warning simple-data-prompt">${icon("info")}<p><strong>${unresolved.length} answer${unresolved.length === 1 ? "" : "s"} waiting for map data.</strong>Radar, thermometer, station-name, transit and Thames answers still work. Load the official map data once to calculate POI, boundary and Tentacle questions.</p><button class="button button-soft button-small" type="button" data-action="spatial-data-load-configured">${icon("download")} Load map data</button></section>`;
}

function renderSimpleAdvanced(state, model) {
  return `<details class="simple-details advanced-details"><summary>${icon("settings")} Map not matching?</summary><div class="simple-details-body"><p class="small muted">Most games will never need this section. Use it only to load a missing map layer or add a fair manual area for a photo or judgement-based clue.</p>${renderMapDataManager(model)}${renderTool(state)}</div></details>`;
}

function isStationLevelEndgameConstraint(constraint) {
  return [DEDUCTION_TOOL_TYPES.STATION_NAME, DEDUCTION_TOOL_TYPES.TRANSIT].includes(constraint?.type);
}

function isCurrentEndgameConstraint(constraint) {
  return isStationLevelEndgameConstraint(constraint)
    || (constraint?.movementMode === DEDUCTION_MOVEMENT.LOCKED && isMaskConstraint(constraint));
}

function isEarlierEndgameConstraint(constraint) {
  return constraint?.movementMode !== DEDUCTION_MOVEMENT.LOCKED
    && !isStationLevelEndgameConstraint(constraint)
    && isMaskConstraint(constraint);
}

function renderSimpleEndgame(model) {
  const current = model.constraints.filter(isCurrentEndgameConstraint);
  const earlier = model.constraints.filter(isEarlierEndgameConstraint);
  const fraction = model.endgameMask?.allowedFraction;
  const unresolved = model.endgameMask?.unresolved?.length || 0;
  const areaLabel = !current.length ? "100%" : fraction == null || unresolved ? "Pending" : `${Math.round(fraction * 100)}%`;
  const linked = [...current.map((constraint) => ({ constraint, kind: isStationLevelEndgameConstraint(constraint) ? "Station" : "Current" })), ...earlier.map((constraint) => ({ constraint, kind: "Earlier" }))];
  return `<div class="view-stack simple-endgame-view">
    <section class="card card-pad simple-endgame-head"><button class="button button-soft button-small" type="button" data-action="deduction-exit-endgame">${icon("undo")} Back to all stations</button><div><p class="eyebrow">Fixed hiding spot</p><h2>Endgame circle</h2><p>Every earlier answer is carried in automatically. Dark grey is ruled out now; blue hatching shows an earlier pre-endgame clue where the hider may since have moved.</p></div><div class="endgame-area-readout"><span>Approx. current area left</span><strong>${areaLabel}</strong><small>${current.length} hard · ${earlier.length} earlier</small></div></section>
    <section class="card card-pad stack"><div class="field simple-endgame-select"><label for="deduction-endgame-station">Suspected hiding station</label><select id="deduction-endgame-station" data-action="deduction-endgame-station">${endgameStationOptions(model)}</select></div><div class="map-shell deduction-map-shell simple-deduction-map"><div id="deduction-map" role="application" aria-label="Endgame hiding circle map using current and earlier answers"></div><div class="simple-map-legend"><span><i class="allowed"></i>Possible now</span><span><i class="excluded"></i>Ruled out now</span><span><i class="earlier"></i>Earlier clue</span><span><i class="unknown"></i>Needs review</span></div></div><p class="tiny muted">Earlier mobile answers remain visible without pretending the hider stayed in the same place. You do not need to ask those questions again.</p></section>
    <section class="card card-pad"><div class="section-head"><div><h2>Answers carried into Endgame</h2><p>Station facts and fixed-spot answers narrow the current area. Pre-endgame location clues remain as blue historical evidence.</p></div><span class="simple-count-pill">${linked.length}</span></div>${linked.length ? `<div class="simple-linked-list">${linked.map(({ constraint, kind }) => `<article><span class="simple-linked-state ${kind === "Earlier" ? "history" : "ready"}"></span><div><strong>${escapeHtml(constraintTitle(constraint))}</strong><small>${escapeHtml(constraint.answerFeatureName || constraint.answer || "Recorded")}</small></div><span>${kind}</span></article>`).join("")}</div>` : `<div class="callout warning">${icon("info")}<p><strong>No linked answer yet.</strong>Ask a question normally and it will appear here automatically.</p></div>`}</section>
  </div>`;
}

export function renderDeductionView(state) {
  const model = buildDeductionViewModel(state);
  if (!model.canView) return renderPrivacyLocked();
  if (model.displayMode === DEDUCTION_MAP_MODES.ENDGAME) return renderSimpleEndgame(model);
  const mapped = model.areaConstraints.filter((constraint) => model.resolutions.get(constraint.id)?.ready).length;
  const unresolved = model.constraints.filter((constraint) => {
    const resolution = model.resolutions.get(constraint.id);
    return resolution && !resolution.ready;
  }).length;
  return `<div class="view-stack simple-deduction-view">
    <section class="card card-pad simple-deduction-head"><div><p class="eyebrow">Round ${model.round} · seeker team only</p><h2>${model.summary.remaining} stations still possible</h2><p>The map always combines every usable answer. Grey areas are impossible; green areas remain possible.</p></div><div class="simple-deduction-actions"><button class="button button-soft" type="button" data-action="deduction-undo" ${model.roundState.undoStack?.length ? "" : "disabled"}>${icon("undo")} Undo last change</button><button class="button button-primary" type="button" data-action="deduction-map-display" data-mode="endgame">${icon("target")} Endgame circle</button></div></section>
    ${renderSimpleMapData(model)}
    <section class="card card-pad stack simple-live-map-card"><div class="simple-map-summary"><span><strong>${model.summary.remaining}</strong> remaining</span><span><strong>${mapped}</strong> mapped answers</span><span><strong>${unresolved}</strong> need review/data</span></div><div class="map-shell deduction-map-shell simple-deduction-map"><div id="deduction-map" role="application" aria-label="Live deduction map showing all excluded areas"></div><div class="simple-map-legend"><span><i class="allowed"></i>Possible</span><span><i class="excluded"></i>Excluded</span><span><i class="unknown"></i>Needs review</span></div></div><p class="tiny muted">This is a planning aid. Use the official game map for borderline entrances, paths and curated-layer disputes.</p></section>
    <div class="grid simple-deduction-grid"><section class="card card-pad"><div class="section-head"><div><h2>Answers used on the map</h2><p>New answers appear here automatically.</p></div></div>${renderSimpleAnswerList(model)}${renderSimpleCorrectionTools(model)}</section>${renderSimpleStationList(state, model)}</div>
    ${renderSimpleAdvanced(state, model)}
  </div>`;
}

export function deductionStationDetail(result) {
  const station = STATION_BY_ID.get(result.id);
  return { title: station?.name || result.name, nameLength: stationNameLength(station?.name || result.name), reason: reasonText(result), status: statusLabel(result) };
}
