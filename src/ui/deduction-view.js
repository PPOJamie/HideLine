import { DEFAULT_DURATIONS, PHASES } from "../core/constants.js";
import { escapeHtml } from "../core/format.js";
import {
  DEDUCTION_MOVEMENT,
  DEDUCTION_STATUS,
  DEDUCTION_TOOL_TYPES,
  constraintTitle,
  createDeductionRoundState,
  deductionSummary,
  deriveAutomaticConstraints,
  evaluateStationPossibilities,
  lineName,
  normaliseDeductionRoundState
} from "../core/deduction.js";
import { RAIL_LINES, STATION_GEO_BY_ID } from "../data/station-geo.js";
import { STATIONS, STATION_BY_ID, stationNameLength } from "../data/stations.js";
import { icon } from "./icons.js";

function stationOptions(selectedId = "", includeBlank = true) {
  return `${includeBlank ? '<option value="">Choose a hiding station…</option>' : ""}${STATIONS.map((station) => `<option value="${station.id}" ${station.id === selectedId ? "selected" : ""}>${escapeHtml(station.name)}${station.note ? ` — ${escapeHtml(station.note)}` : ""}</option>`).join("")}`;
}

function lineOptions(selectedId = "") {
  const groups = new Map();
  for (const line of RAIL_LINES) {
    if (!groups.has(line.group)) groups.set(line.group, []);
    groups.get(line.group).push(line);
  }
  return `<option value="">Choose a line or operator…</option>${[...groups.entries()].map(([group, lines]) => `<optgroup label="${escapeHtml(group)}">${lines.map((line) => `<option value="${line.id}" ${selectedId === line.id ? "selected" : ""}>${escapeHtml(line.name)}</option>`).join("")}</optgroup>`).join("")}`;
}

export function buildDeductionViewModel(state) {
  const round = state.game?.round || 1;
  const roundState = normaliseDeductionRoundState(state.privateTeamState?.deductionByRound?.[round]);
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
    radiusMetres: DEFAULT_DURATIONS.hidingZoneRadiusMetres
  });
  return {
    round,
    roundState,
    allAutomatic,
    automatic,
    manual,
    constraints,
    results,
    summary: deductionSummary(results),
    isHider: Boolean(state.game && state.profile.team === state.game.hiderTeam),
    canView: state.connection.mode !== "connected" || !state.game || state.profile.team !== state.game.hiderTeam
  };
}

function metric(label, value, note, tone = "") {
  return `<div class="metric-card card deduction-metric ${tone}"><span class="metric-label">${escapeHtml(label)}</span><strong class="metric-value">${escapeHtml(value)}</strong><span class="tiny muted">${escapeHtml(note)}</span></div>`;
}

function renderPrivacyLocked(state) {
  return `
    <section class="card card-pad deduction-private-lock">
      <div class="empty-state" style="min-height:420px"><div class="empty-state-inner">
        <span class="empty-icon">${icon("lock")}</span>
        <h2>Seeker-team private map</h2>
        <p>The Deduction Map is intentionally hidden from the active hider team in Connected Mode. Question and answer records still remain shared as the handbook requires.</p>
        <p class="small muted">Switch to the seeker-team profile only on a device that belongs to that team.</p>
      </div></div>
    </section>
  `;
}

function movementField(state, id) {
  const defaultMode = state.game?.phase === PHASES.ENDGAME ? DEDUCTION_MOVEMENT.LOCKED : DEDUCTION_MOVEMENT.MOBILE;
  return `
    <div class="field"><label for="${id}-movement">Hider movement at this answer</label>
      <select id="${id}-movement" name="movementMode">
        <option value="mobile" ${defaultMode === "mobile" ? "selected" : ""}>Before endgame — hider could move within the 500 m zone</option>
        <option value="locked" ${defaultMode === "locked" ? "selected" : ""}>Endgame — same fixed hiding spot</option>
      </select>
      <span class="field-hint">Pre-endgame answers are tested independently. Endgame answers are intersected at one common point.</span>
    </div>`;
}

function coordinatePair(prefix, label, state, options = {}) {
  const current = options.useCurrent ? state.location?.current : null;
  const lat = current?.lat != null ? Number(current.lat).toFixed(6) : "";
  const lng = current?.lng != null ? Number(current.lng).toFixed(6) : "";
  return `
    <fieldset class="coordinate-pair">
      <legend>${escapeHtml(label)}</legend>
      <div class="field-row">
        <div class="field"><label for="${prefix}-lat">Latitude</label><input id="${prefix}-lat" name="${prefix}Lat" inputmode="decimal" type="number" step="any" min="-90" max="90" value="${lat}" required /></div>
        <div class="field"><label for="${prefix}-lng">Longitude</label><input id="${prefix}-lng" name="${prefix}Lng" inputmode="decimal" type="number" step="any" min="-180" max="180" value="${lng}" required /></div>
      </div>
      <div class="button-row compact">
        <button class="button button-soft button-small" type="button" data-action="deduction-fill-gps" data-prefix="${prefix}">${icon("location")} Use GPS</button>
        <button class="button button-soft button-small" type="button" data-action="deduction-pick-map" data-prefix="${prefix}">${icon("map")} Pick on map</button>
      </div>
    </fieldset>`;
}

function commonManualFields() {
  return `<div class="field"><label for="deduction-label">Optional label</label><input id="deduction-label" name="label" maxlength="100" placeholder="e.g. Radar from Borough" /></div>`;
}

function radarForm(state) {
  return `
    <form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.RADAR}">
      <div class="callout">${icon("radar")}<p><strong>Radar circle</strong>Enter the seeker pin and the answer. A station stays possible whenever some point in its 500 m zone could produce that answer.</p></div>
      ${coordinatePair("centre", "Seeker pin", state, { useCurrent: true })}
      <div class="field-row"><div class="field"><label for="radar-radius">Radius (km)</label><input id="radar-radius" name="radiusKm" type="number" inputmode="decimal" step="0.05" min="0.05" max="50" value="2" required /></div><div class="field"><label for="radar-answer">Answer</label><select id="radar-answer" name="answer"><option value="yes">Yes — inside</option><option value="no">No — outside</option></select></div></div>
      ${movementField(state, "radar")}${commonManualFields()}
      <button class="button button-primary" type="submit">${icon("plus")} Apply radar deduction</button>
    </form>`;
}

function thermometerForm(state) {
  return `
    <form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.THERMOMETER}">
      <div class="callout">${icon("thermometer")}<p><strong>Thermometer</strong>Record the seeker's position before and after travelling. “Hotter” keeps points closer to the end; “Colder” keeps points closer to the start.</p></div>
      ${coordinatePair("start", "Start position", state)}
      ${coordinatePair("end", "End position", state, { useCurrent: true })}
      <div class="field"><label for="thermometer-answer">Answer</label><select id="thermometer-answer" name="answer"><option value="hotter">Hotter</option><option value="colder">Colder</option></select></div>
      ${movementField(state, "thermometer")}${commonManualFields()}
      <button class="button button-primary" type="submit">${icon("plus")} Apply thermometer deduction</button>
    </form>`;
}

function distanceForm(state) {
  return `
    <form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.DISTANCE}">
      <div class="callout warning">${icon("alert")}<p><strong>Exact reference point only.</strong>This tool compares both teams to one exact pin. Do not use it for “nearest museum/park/hospital” unless you have separately proved which POI is nearest.</p></div>
      ${coordinatePair("seeker", "Seeker pin", state, { useCurrent: true })}
      ${coordinatePair("target", "Exact reference pin", state)}
      <div class="field"><label for="distance-answer">Answer</label><select id="distance-answer" name="answer"><option value="closer">Hider is closer</option><option value="further">Hider is farther</option></select></div>
      ${movementField(state, "distance")}${commonManualFields()}
      <button class="button button-primary" type="submit">${icon("plus")} Apply distance deduction</button>
    </form>`;
}

function stationNameForm() {
  return `
    <form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.STATION_NAME}">
      <div class="callout">${icon("station")}<p><strong>Station-name length</strong>HideLine uses the exact 100 handbook names, including spaces and punctuation.</p></div>
      <div class="field"><label for="name-seeker-station">Seeker station</label><select id="name-seeker-station" name="seekerStationId" required>${stationOptions()}</select></div>
      <div class="field"><label for="name-answer">Hider's answer</label><select id="name-answer" name="answer"><option value="same">Same length</option><option value="longer">Hider station name is longer</option><option value="shorter">Hider station name is shorter</option></select></div>
      ${commonManualFields()}
      <button class="button button-primary" type="submit">${icon("plus")} Filter by name length</button>
    </form>`;
}

function transitForm() {
  return `
    <form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.TRANSIT}">
      <div class="callout warning">${icon("train")}<p><strong>Branches and stopping patterns matter.</strong>Select a preset for a quick filter, or select the exact handbook stations served by the particular train. Exact stops take priority.</p></div>
      <div class="field"><label for="transit-line">Line / operator preset</label><select id="transit-line" name="lineId">${lineOptions()}</select></div>
      <div class="field"><label for="transit-stops">Exact stops in the game area (optional)</label><select id="transit-stops" name="stationIds" multiple size="8">${stationOptions("", false)}</select><span class="field-hint">Desktop: Ctrl/Cmd-click. Mobile: tap each stop. Leave empty to use the preset.</span></div>
      <div class="field"><label for="transit-answer">Answer</label><select id="transit-answer" name="answer"><option value="yes">Yes — that train stops at the hiding station</option><option value="no">No — it does not stop there</option></select></div>
      ${commonManualFields()}
      <button class="button button-primary" type="submit">${icon("plus")} Apply transit deduction</button>
    </form>`;
}

function thamesForm(state) {
  return `
    <form class="stack deduction-tool-form" data-form="deduction-constraint" data-constraint-type="${DEDUCTION_TOOL_TYPES.THAMES}">
      <div class="callout warning">${icon("info")}<p><strong>Planning approximation.</strong>The river centreline is simplified. Bridges and tunnels count as matching both sides, so manually restore borderline cases after checking the authoritative map.</p></div>
      <div class="field-row"><div class="field"><label for="thames-side">Seeker side</label><select id="thames-side" name="seekerSide"><option value="north">North of the Thames</option><option value="south">South of the Thames</option><option value="both">On a bridge / in a tunnel</option></select></div><div class="field"><label for="thames-answer">Answer</label><select id="thames-answer" name="answer"><option value="yes">Yes — same landmass</option><option value="no">No — different landmass</option></select></div></div>
      ${movementField(state, "thames")}${commonManualFields()}
      <button class="button button-primary" type="submit">${icon("plus")} Apply Thames-side deduction</button>
    </form>`;
}

function renderTool(state) {
  const selected = state.ui.deductionTool || DEDUCTION_TOOL_TYPES.RADAR;
  const forms = {
    [DEDUCTION_TOOL_TYPES.RADAR]: radarForm,
    [DEDUCTION_TOOL_TYPES.THERMOMETER]: thermometerForm,
    [DEDUCTION_TOOL_TYPES.DISTANCE]: distanceForm,
    [DEDUCTION_TOOL_TYPES.STATION_NAME]: stationNameForm,
    [DEDUCTION_TOOL_TYPES.TRANSIT]: transitForm,
    [DEDUCTION_TOOL_TYPES.THAMES]: thamesForm
  };
  const render = forms[selected] || radarForm;
  return `
    <section class="card card-pad stack deduction-builder">
      <div class="section-head"><div><p class="eyebrow">Add a deduction</p><h2>Question tool</h2></div></div>
      <div class="field"><label for="deduction-tool">Question type</label><select id="deduction-tool" data-action="deduction-tool">
        <option value="radar" ${selected === "radar" ? "selected" : ""}>Radar</option>
        <option value="thermometer" ${selected === "thermometer" ? "selected" : ""}>Thermometer</option>
        <option value="distance" ${selected === "distance" ? "selected" : ""}>Measuring — exact reference point</option>
        <option value="station-name-length" ${selected === "station-name-length" ? "selected" : ""}>Matching — station-name length</option>
        <option value="transit-line" ${selected === "transit-line" ? "selected" : ""}>Matching — transit line</option>
        <option value="thames-side" ${selected === "thames-side" ? "selected" : ""}>Matching — Thames side</option>
      </select></div>
      ${render(state)}
    </section>`;
}

function constraintDetails(constraint) {
  if (constraint.type === DEDUCTION_TOOL_TYPES.RADAR) return `${Number(constraint.radiusMetres) < 1000 ? `${Math.round(Number(constraint.radiusMetres))} m` : `${Number((Number(constraint.radiusMetres) / 1000).toFixed(2))} km`} · ${escapeHtml(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.TRANSIT) return `${constraint.stationIds?.length ? `${constraint.stationIds.length} exact stops` : escapeHtml(lineName(constraint.lineId))} · ${escapeHtml(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.STATION_NAME) return `${constraint.seekerLength} characters · ${escapeHtml(constraint.answer)}`;
  return escapeHtml(constraint.answer || "");
}

function renderConstraintList(model) {
  const ignored = new Set(model.roundState.ignoredAutoConstraintIds || []);
  const items = [
    ...model.allAutomatic.map((constraint) => ({ ...constraint, auto: true, ignored: ignored.has(constraint.id) })),
    ...model.roundState.constraints.map((constraint) => ({ ...constraint, auto: false, ignored: constraint.enabled === false }))
  ];
  return `
    <section class="card card-pad stack">
      <div class="section-head"><div><p class="eyebrow">Audit trail</p><h2>Active deductions</h2><p>Automatic entries come from structured question records. You can ignore any disputed answer without deleting the shared game history.</p></div><button class="button button-soft button-small" type="button" data-action="deduction-undo" ${model.roundState.undoStack?.length ? "" : "disabled"}>${icon("undo")} Undo</button></div>
      ${items.length ? `<div class="deduction-constraint-list">${items.map((constraint) => `
        <article class="deduction-constraint ${constraint.ignored ? "ignored" : ""}">
          <div class="deduction-constraint-main"><div class="row gap-sm wrap"><span class="badge ${constraint.auto ? "badge-blue" : "badge-neutral"}">${constraint.auto ? "Question" : "Manual"}</span><span class="badge ${constraint.movementMode === "locked" ? "badge-purple" : "badge-mint"}">${constraint.movementMode === "locked" ? "Endgame locked" : "Mobile snapshot"}</span>${constraint.ignored ? '<span class="badge badge-warning">Ignored</span>' : ""}</div><strong>${escapeHtml(constraintTitle(constraint))}</strong><span class="tiny muted">${constraintDetails(constraint)}</span></div>
          <button class="button button-soft button-small" type="button" data-action="${constraint.auto ? "deduction-toggle-auto" : "deduction-remove-constraint"}" data-id="${escapeHtml(constraint.id)}">${icon(constraint.auto && constraint.ignored ? "eye" : constraint.auto ? "eyeOff" : "trash")} ${constraint.auto ? (constraint.ignored ? "Use" : "Ignore") : "Remove"}</button>
        </article>`).join("")}</div>` : `<div class="empty-state" style="min-height:150px"><div class="empty-state-inner"><span class="empty-icon">${icon("filter")}</span><strong>No deductions yet</strong><span>Ask a map-ready question or add a tool above.</span></div></div>`}
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
  return `
    <section class="card card-pad stack deduction-stations-card">
      <div class="section-head"><div><p class="eyebrow">Station board</p><h2>${filtered.length} shown</h2><p>Tap a row to centre the map. Manual notes and status changes remain private to the seeker team.</p></div></div>
      <div class="deduction-list-controls">
        <div class="field"><label for="deduction-search">Search stations</label><input id="deduction-search" data-action="deduction-search" type="search" value="${escapeHtml(state.ui.deductionSearch || "")}" placeholder="Station, service or note" /></div>
        <div class="field"><label for="deduction-filter">Show</label><select id="deduction-filter" data-action="deduction-filter"><option value="remaining" ${filter === "remaining" ? "selected" : ""}>Remaining</option><option value="priority" ${filter === "priority" ? "selected" : ""}>Priority</option><option value="eliminated" ${filter === "eliminated" ? "selected" : ""}>Eliminated</option><option value="all" ${filter === "all" ? "selected" : ""}>All 100</option></select></div>
      </div>
      <div class="deduction-station-list">${filtered.map((result) => {
        const manualEliminated = Boolean(result.override?.eliminated);
        return `<article class="deduction-station-row status-${result.status}" data-station-id="${result.id}">
          <button class="deduction-station-focus" type="button" data-action="deduction-focus-station" data-id="${result.id}"><span class="station-status-dot" aria-hidden="true"></span><span><strong>${escapeHtml(result.name)}</strong><small>${escapeHtml(reasonText(result))}</small></span></button>
          <span class="badge status-badge">${statusLabel(result)}</span>
          <div class="deduction-station-actions">
            <button class="icon-button ${result.priority ? "active" : ""}" type="button" data-action="deduction-toggle-priority" data-id="${result.id}" title="${result.priority ? "Remove priority" : "Mark priority"}" ${result.possible ? "" : "disabled"}>${icon("star")}</button>
            <button class="button button-soft button-small" type="button" data-action="deduction-toggle-eliminated" data-id="${result.id}">${manualEliminated ? "Restore manual" : "Eliminate"}</button>
          </div>
        </article>`;
      }).join("") || `<div class="empty-state" style="min-height:180px"><div class="empty-state-inner"><span class="empty-icon">${icon("search")}</span><strong>No stations match</strong><span>Clear the search or change the status filter.</span></div></div>`}</div>
    </section>`;
}

export function renderDeductionView(state) {
  const model = buildDeductionViewModel(state);
  if (!model.canView) return renderPrivacyLocked(state);
  const { summary, roundState } = model;
  return `
    <div class="view-stack deduction-view">
      <section class="card card-pad deduction-hero">
        <div class="section-head"><div><p class="eyebrow">Round ${model.round} · seeker private</p><h2>Live Deduction Map</h2><p>Every answer narrows the 100 station-centred hiding zones without assuming the hiders stayed in one place before endgame.</p></div><div class="button-row"><button class="button button-soft button-small" type="button" data-action="deduction-undo" ${roundState.undoStack?.length ? "" : "disabled"}>${icon("undo")} Undo</button></div></div>
        <div class="grid grid-4 deduction-metrics">
          ${metric("Remaining", `${summary.remaining} / ${summary.total}`, "possible or partly possible", "mint")}
          ${metric("Possible", String(summary.possible), "whole sampled zone survives")}
          ${metric("Partial", String(summary.partial), "only part of zone survives", "warning")}
          ${metric("Eliminated", String(summary.eliminated), "ruled out or manual", "neutral")}
        </div>
        <div class="callout">${icon("info")}<p><strong>Rules-aware movement.</strong>Before endgame, each answer is treated as a separate snapshot because hiders may move inside their zone. Endgame-locked answers must all fit one common point. Green/amber calculations sample each 500 m circle and are a planning aid; use the authoritative map for close rulings.</p></div>
      </section>

      <div class="grid deduction-map-grid">
        <section class="card card-pad stack deduction-map-card">
          <div class="section-head"><div><h2>Possibility map</h2><p>Green remains possible, amber is partly possible, grey is eliminated, and purple is seeker priority.</p></div></div>
          <div class="deduction-map-controls">
            <label class="toggle-row"><input type="checkbox" data-action="deduction-show-zones" ${roundState.showZones ? "checked" : ""} /><span>Show all 500 m circles</span></label>
            <label class="toggle-row"><input type="checkbox" data-action="deduction-show-eliminated" ${roundState.showEliminated ? "checked" : ""} /><span>Show eliminated stations</span></label>
          </div>
          <div class="map-shell deduction-map-shell">
            <div id="deduction-map" role="application" aria-label="Live station deduction map"></div>
            <div class="deduction-legend" aria-label="Map legend"><span class="legend-possible">Possible</span><span class="legend-partial">Partial</span><span class="legend-priority">Priority</span><span class="legend-eliminated">Eliminated</span></div>
          </div>
          <p class="tiny muted">Map-pick mode: choose “Pick on map” in a question tool, then tap the required location.</p>
        </section>
        <aside class="stack deduction-side">${renderTool(state)}${renderConstraintList(model)}</aside>
      </div>
      ${renderStationList(state, model)}
    </div>`;
}

export function deductionStationDetail(result) {
  const station = STATION_BY_ID.get(result.id);
  return {
    title: station?.name || result.name,
    nameLength: stationNameLength(station?.name || result.name),
    reason: reasonText(result),
    status: statusLabel(result)
  };
}
