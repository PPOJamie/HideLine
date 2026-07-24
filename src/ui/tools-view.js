import { CARD_TYPES, CHECKLISTS } from "../data/rules.js";
import { STATIONS, STATION_BY_ID, stationNameLength } from "../data/stations.js";
import { calculateScore } from "../core/score.js";
import { escapeHtml, relativeTime } from "../core/format.js";
import { formatDuration } from "../core/time.js";
import { statusTone } from "../services/tfl.js";
import { icon } from "./icons.js";

const TOOL_TABS = [
  ["score", "Score"], ["cards", "Cards"], ["traps", "Time traps"], ["stations", "Stations"], ["status", "TfL status"], ["checklist", "Checklist"]
];

function tabs(selected) {
  return `<div class="tabs" role="tablist" aria-label="Toolkit section">${TOOL_TABS.map(([id, label]) => `<button class="tab-button ${selected === id ? "active" : ""}" type="button" data-action="tool-tab" data-tool="${id}">${label}</button>`).join("")}</div>`;
}

function adjustmentRows(score) {
  const groups = [
    ["timeTraps", "Activated time trap", "seconds"],
    ["percentageBonuses", "Percentage bonus", "percent"],
    ["timeBonuses", "Time bonus", "seconds"],
    ["curseExtraTime", "Curse extra time", "seconds"],
    ["curseCures", "Curse cure", "seconds"],
    ["otherAdjustments", "Other adjustment / penalty", "seconds"]
  ];
  const rows = [];
  for (const [key, fallback, field] of groups) {
    for (const item of score[key] || []) rows.push({ ...item, group: key, label: item.label || fallback, value: item[field] || 0, field });
  }
  return rows;
}

function renderScore(state) {
  const round = state.game?.round || 1;
  const score = state.game?.scoreByRound?.[round] || { hidingSeconds: 0, hidingPeriodSeconds: 2700, timeTraps: [], percentageBonuses: [], timeBonuses: [], curseExtraTime: [], curseCures: [], otherAdjustments: [] };
  const calculated = calculateScore(score);
  const rows = adjustmentRows(score);
  const hidingHours = Math.floor((score.hidingSeconds || 0) / 3600);
  const hidingMinutes = Math.floor(((score.hidingSeconds || 0) % 3600) / 60);
  const hidingSeconds = Math.floor((score.hidingSeconds || 0) % 60);
  return `
    <div class="grid grid-main">
      <section class="card card-pad stack">
        <div class="section-head"><div><h2>Round ${round} score calculator</h2><p>Implements the handbook formula in the same order: hiding time + traps, then percentage bonuses, then fixed adjustments.</p></div><button class="button button-soft button-small" type="button" data-action="use-live-time">${icon("clock")} Use live timer</button></div>
        <form class="stack" data-form="base-score">
          <div class="field-row">
            <div class="field"><label for="score-hours">Hiding hours</label><input id="score-hours" name="hours" type="number" min="0" max="12" value="${hidingHours}" inputmode="numeric" /></div>
            <div class="field"><label for="score-minutes">Minutes</label><input id="score-minutes" name="minutes" type="number" min="0" max="59" value="${hidingMinutes}" inputmode="numeric" /></div>
          </div>
          <div class="field-row">
            <div class="field"><label for="score-seconds">Seconds</label><input id="score-seconds" name="seconds" type="number" min="0" max="59" value="${hidingSeconds}" inputmode="numeric" /></div>
            <div class="field"><label for="hiding-period">Hiding period (minutes)</label><input id="hiding-period" name="hidingPeriodMinutes" type="number" min="0" value="${Math.round((score.hidingPeriodSeconds || 2700) / 60)}" inputmode="numeric" /></div>
          </div>
          <button class="button button-secondary" type="submit">${icon("check")} Save base time</button>
        </form>
        <div class="divider"></div>
        <div class="row-between wrap"><div><h3>Adjustments</h3><p class="muted small">Use negative values for score reductions, including the −30 minute invalid-zone penalty.</p></div><button class="button button-primary button-small" type="button" data-action="open-modal" data-modal="score-adjustment">${icon("plus")} Add</button></div>
        ${rows.length ? `<div class="adjustment-list">${rows.map((item) => `<div class="adjustment-item"><div><strong class="small">${escapeHtml(item.label)}</strong><div class="tiny muted">${escapeHtml(item.group.replaceAll(/([A-Z])/g, " $1"))}</div></div><span class="mono small">${item.field === "percent" ? `${Number(item.value) > 0 ? "+" : ""}${item.value}%` : formatDuration(item.value, { signed: true, compact: true })}</span><button class="button button-soft button-icon button-small" type="button" aria-label="Remove adjustment" data-action="remove-adjustment" data-group="${item.group}" data-id="${item.id}">${icon("trash")}</button></div>`).join("")}</div>` : `<div class="empty-state" style="min-height:120px"><div class="empty-state-inner"><span class="empty-icon">${icon("plus")}</span><strong>No adjustments</strong><span>Add traps, card bonuses, curse effects or penalties.</span></div></div>`}
      </section>
      <aside class="stack">
        <section class="score-total"><span class="eyebrow">Total round time</span><strong>${formatDuration(calculated.totalRoundSeconds)}</strong><span class="small">Total hiding time ${formatDuration(calculated.totalHidingSeconds)} + hiding period ${formatDuration(calculated.hidingPeriodSeconds)}</span></section>
        <section class="card card-pad"><div class="section-head"><div><h2>Formula breakdown</h2></div></div><div class="score-breakdown">
          <div class="score-row"><span>Base hiding time</span><span>${formatDuration(calculated.hidingSeconds)}</span></div>
          <div class="score-row"><span>Activated traps</span><span>${formatDuration(calculated.trapSeconds, { signed: true })}</span></div>
          <div class="score-row"><span>Percentage multiplier</span><span>×${calculated.percentageMultiplier.toFixed(2)}</span></div>
          <div class="score-row"><span>After percentage</span><span>${formatDuration(calculated.afterPercentage)}</span></div>
          <div class="score-row"><span>Fixed bonuses</span><span>${formatDuration(calculated.timeBonusSeconds + calculated.curseExtraSeconds + calculated.curseCureSeconds, { signed: true })}</span></div>
          <div class="score-row"><span>Other adjustments</span><span>${formatDuration(calculated.otherAdjustmentSeconds, { signed: true })}</span></div>
        </div></section>
        <div class="callout warning">${icon("alert")}<p><strong>Invalid hiding zone:</strong> add an Other adjustment of −30 minutes when hiders are not in a valid zone at the end of the hiding period.</p></div>
      </aside>
    </div>
  `;
}

function renderCards(state) {
  const cards = state.privateTeamState.cards || [];
  const limit = state.privateTeamState.handLimit || 6;
  return `
    <section class="card card-pad stack">
      <div class="section-head"><div><h2>Private hider hand</h2><p>Visible only to this device in Local Mode and to your team in Connected Mode.</p></div><div class="row"><span class="badge ${cards.length > limit ? "badge-red" : "badge-mint"}">${cards.length} / ${limit}</span><button class="button button-primary button-small" type="button" data-action="open-modal" data-modal="add-card">${icon("plus")} Add card</button></div></div>
      ${cards.length ? `<div class="card-hand">${cards.map((card) => `<article class="game-card ${escapeHtml(card.type)}"><div><div class="tiny">${escapeHtml(CARD_TYPES.find((type) => type.id === card.type)?.name || card.type)}</div><h3>${escapeHtml(card.name)}</h3></div><div><p class="small">${escapeHtml(card.note || "No note")}</p><button class="button button-ghost button-small" type="button" data-action="remove-card" data-id="${card.id}">${icon("trash")} Remove</button></div></article>`).join("")}</div>` : `<div class="empty-state"><div class="empty-state-inner"><span class="empty-icon">${icon("card")}</span><strong>No cards recorded</strong><span>Add the cards you keep after answering questions. The default hand limit is six.</span></div></div>`}
      ${cards.length > limit ? `<div class="callout danger">${icon("alert")}<p><strong>Hand limit exceeded.</strong>Resolve discards unless a power-up or curse has expanded the limit.</p></div>` : ""}
    </section>
  `;
}

function trapEarnedSeconds(trap) {
  if (!trap.placedAt) return 0;
  const end = trap.removedAt || Date.now();
  return Math.max(0, Math.floor((new Date(end) - new Date(trap.placedAt)) / 1000));
}

function renderTraps(state) {
  const traps = state.game?.traps || [];
  return `
    <div class="grid grid-main">
      <section class="card card-pad stack"><div class="section-head"><div><h2>Time traps</h2><p>Record both placement and removal/activation timestamps so earned time can be calculated accurately.</p></div><button class="button button-primary button-small" type="button" data-action="open-modal" data-modal="add-trap">${icon("plus")} Place trap</button></div>
        ${traps.length ? `<div class="trap-list">${traps.map((trap) => { const seconds = trapEarnedSeconds(trap); const progress = Math.min(100, seconds / 3600 * 100); return `<article class="trap-item"><div class="row-between"><div><strong>${escapeHtml(trap.station)}</strong><div class="tiny muted">Placed ${relativeTime(trap.placedAt)}${trap.removedAt ? ` · removed ${relativeTime(trap.removedAt)}` : " · active"}</div></div><span class="badge ${trap.removedAt ? "badge-mint" : "badge-orange"}">${formatDuration(seconds, { compact: true })}</span></div><div class="trap-line"><span style="width:${progress}%"></span></div><div class="row wrap">${!trap.removedAt ? `<button class="button button-soft button-small" type="button" data-action="remove-trap" data-id="${trap.id}">${icon("check")} Mark passed / removed</button>` : `<button class="button button-soft button-small" type="button" data-action="add-trap-to-score" data-id="${trap.id}">${icon("trophy")} Add to score</button>`}<button class="button button-soft button-icon button-small" type="button" data-action="delete-trap" data-id="${trap.id}" aria-label="Delete trap">${icon("trash")}</button></div></article>`; }).join("")}</div>` : `<div class="empty-state"><div class="empty-state-inner"><span class="empty-icon">${icon("trap")}</span><strong>No time traps</strong><span>Place a trap when the card is played, then mark the exact removal time.</span></div></div>`}
      </section>
      <aside class="stack"><div class="callout">${icon("clock")}<p><strong>Shared timestamp rule</strong>Hiders record placement; seekers record removal when they pass through or visit the station.</p></div><div class="callout warning">${icon("info")}<p>The app calculates raw elapsed time. Apply the specific trap card's cap or conversion before adding it to the score.</p></div></aside>
    </div>
  `;
}

function renderStations(state) {
  const selected = STATION_BY_ID.get(state.ui.randomStationId) || null;
  const usedIds = new Set(state.game?.usedStations || []);
  return `
    <div class="grid grid-main">
      <section class="card card-pad stack">
        <div class="section-head"><div><h2>Hiding-station explorer</h2><p>All 100 handbook entries, including separate service variants where listed.</p></div><button class="button button-primary" type="button" data-action="random-station">${icon("dice")} Random valid station</button></div>
        ${selected ? `<div class="card card-dark card-pad"><p class="eyebrow">Random selection</p><h2>${escapeHtml(selected.name)}</h2><p>${escapeHtml(selected.service)}${selected.note ? ` · ${escapeHtml(selected.note)}` : ""}</p><div class="row wrap"><span class="badge badge-dark">Name length ${stationNameLength(selected.name)}</span>${usedIds.has(selected.id) ? `<span class="badge badge-orange">Previously used</span>` : ""}<button class="button button-ghost button-small" type="button" data-action="choose-random-station" data-id="${selected.id}">${icon("check")} Use as private anchor</button></div></div>` : ""}
        <div class="field"><label for="station-filter">Search stations</label><input id="station-filter" type="search" data-action="station-filter" value="${escapeHtml(state.ui.stationSearch || "")}" placeholder="Name, service or note..." /></div>
        <div class="question-list">${STATIONS.filter((station) => { const needle = String(state.ui.stationSearch || "").toLowerCase(); return !needle || `${station.name} ${station.service} ${station.note}`.toLowerCase().includes(needle); }).map((station) => `<article class="station-result"><div><strong>${escapeHtml(station.name)}</strong><small>${escapeHtml(station.service)}${station.note ? ` · ${escapeHtml(station.note)}` : ""}</small></div><div class="row"><span class="station-name-length">${stationNameLength(station.name)}</span><button class="button button-soft button-icon button-small" type="button" data-action="toggle-used-station" data-id="${station.id}" aria-label="${usedIds.has(station.id) ? "Mark unused" : "Mark used"}">${icon(usedIds.has(station.id) ? "check" : "plus")}</button></div></article>`).join("")}</div>
      </section>
      <aside class="stack"><div class="callout warning">${icon("alert")}<p><strong>Check live access.</strong>A valid station must be open and reasonably accessible on game day. A difficult route is acceptable; a closed station is not.</p></div><div class="callout">${icon("station")}<p><strong>Name-length questions</strong>count every space and punctuation mark as one character, using the handbook spelling.</p></div></aside>
    </div>
  `;
}

function renderStatus(state) {
  const tfl = state.tfl;
  return `
    <div class="grid grid-main">
      <section class="card card-pad stack"><div class="section-head"><div><h2>Live TfL line status</h2><p>Useful before choosing a hiding station or committing to a route.</p></div><button class="button button-primary button-small" type="button" data-action="refresh-tfl" ${tfl.status === "loading" ? "disabled" : ""}>${icon("refresh")} ${tfl.status === "loading" ? "Loading..." : "Refresh"}</button></div>
        ${tfl.error ? `<div class="callout danger">${icon("alert")}<p>${escapeHtml(tfl.error)}</p></div>` : ""}
        ${tfl.lines.length ? `<div class="status-list">${tfl.lines.map((line) => { const tone = statusTone(line.severity); return `<article class="status-item"><span class="status-bar ${tone === "good" ? "" : tone}"></span><div><strong>${escapeHtml(line.name)}</strong><p>${escapeHtml(line.reason || line.label)}</p></div><span class="badge ${tone === "good" ? "badge-mint" : tone === "severe" ? "badge-red" : "badge-orange"}">${escapeHtml(line.label)}</span></article>`; }).join("")}</div>` : `<div class="empty-state"><div class="empty-state-inner"><span class="empty-icon">${icon("train")}</span><strong>No status loaded</strong><span>Refresh while online. National Rail services should also be checked separately.</span></div></div>`}
        ${tfl.updatedAt ? `<div class="tiny muted">Last refreshed ${relativeTime(tfl.updatedAt)}.</div>` : ""}
      </section>
      <aside class="stack"><a class="button button-soft" href="https://tfl.gov.uk/tube-dlr-overground/status/" target="_blank" rel="noopener">${icon("external")} TfL status page</a><a class="button button-soft" href="https://www.nationalrail.co.uk/status-and-disruptions/" target="_blank" rel="noopener">${icon("external")} National Rail disruptions</a><div class="callout warning">${icon("info")}<p>Check planned closures before the game as well as live status. The hider's chosen station must not be closed.</p></div></aside>
    </div>
  `;
}

function renderChecklist(state) {
  return `<div class="grid grid-3">${Object.entries(CHECKLISTS).map(([key, items]) => `<section class="card card-pad"><div class="section-head"><div><h2>${key === "pregame" ? "Pre-game" : key === "hider" ? "Hider" : "Seeker"}</h2><p>${items.filter((_, index) => state.checklist[`${key}:${index}`]).length} / ${items.length} complete</p></div></div><div class="checklist">${items.map((item, index) => { const id = `${key}:${index}`; const done = Boolean(state.checklist[id]); return `<div class="check-item ${done ? "done" : ""}"><input id="check-${key}-${index}" type="checkbox" data-action="toggle-checklist" data-id="${id}" ${done ? "checked" : ""}/><label for="check-${key}-${index}">${escapeHtml(item)}</label></div>`; }).join("")}</div></section>`).join("")}</div>`;
}

export function renderToolsView(state) {
  const selected = state.ui.selectedTool || "score";
  const content = selected === "cards" ? renderCards(state)
    : selected === "traps" ? renderTraps(state)
    : selected === "stations" ? renderStations(state)
    : selected === "status" ? renderStatus(state)
    : selected === "checklist" ? renderChecklist(state)
    : renderScore(state);
  return `<div class="view-stack">${tabs(selected)}${content}</div>`;
}
