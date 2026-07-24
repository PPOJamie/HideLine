import { DEFAULT_DURATIONS, GAME_MAP_EMBED_URL, GAME_MAP_URL, PHASES, TEAM_LABELS } from "../core/constants.js";
import { escapeHtml } from "../core/format.js";
import { formatDistance, haversineMetres, isWithinRadius } from "../core/geo.js";
import { STATIONS, STATION_BY_ID, stationNameLength } from "../data/stations.js";
import { icon } from "./icons.js";
import { renderDeductionView } from "./deduction-view.js";

function stationOptions(selectedId) {
  return STATIONS.map((station) => `<option value="${station.id}" ${station.id === selectedId ? "selected" : ""}>${escapeHtml(station.name)}${station.note ? ` - ${escapeHtml(station.note)}` : ""}</option>`).join("");
}

function renderAuthoritativeMap() {
  return `<section class="card card-pad stack simple-official-map">
    <div class="section-head"><div><h2>Official game map</h2><p>Use this map for the final ruling on the game boundary, station pins and curated points of interest.</p></div><a class="button button-primary button-small" href="${GAME_MAP_URL}" target="_blank" rel="noopener">${icon("external")} Open full screen</a></div>
    <iframe class="map-frame" src="${GAME_MAP_EMBED_URL}" title="London Hide and Seek official game map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  </section>`;
}

function renderZoneCheck(state) {
  const secret = state.privateTeamState || {};
  const station = STATION_BY_ID.get(secret.stationId) || (secret.stationName ? { name: secret.stationName } : null);
  const coords = secret.stationCoords;
  const current = state.location?.current || null;
  const distance = coords && current ? haversineMetres(current, coords) : null;
  const inside = distance == null ? null : isWithinRadius(current, coords, DEFAULT_DURATIONS.hidingZoneRadiusMetres);
  return `<div class="grid simple-zone-grid">
    <section class="card card-pad stack">
      <div class="section-head"><div><h2>500 m zone check</h2><p>Choose your hiding station, then use your phone location to check whether you are inside its zone.</p></div></div>
      <div class="map-shell simple-zone-map"><div id="zone-map" role="application" aria-label="Interactive hiding zone map"></div><div class="map-overlay"><div class="map-status"><strong>${station ? escapeHtml(station.name) : "Choose a station"}</strong><br>${coords ? "500 m circle ready." : "Save a station to draw the circle."}</div></div></div>
    </section>
    <aside class="card card-pad stack simple-zone-controls">
      <form class="station-picker" data-form="station-select"><div class="field"><label for="map-station">Hiding station</label><select id="map-station" name="stationId"><option value="">Choose one of 100 stations…</option>${stationOptions(secret.stationId)}</select></div><button class="button button-primary" type="submit">${icon("station")} Save station</button></form>
      ${station ? `<div class="station-result"><div><strong>${escapeHtml(station.name)}</strong><small>${escapeHtml(station.service || "")}${station.note ? ` · ${escapeHtml(station.note)}` : ""}</small></div><span class="station-name-length" title="Station name length">${stationNameLength(station.name)}</span></div>` : ""}
      <div class="distance-panel simple-distance"><div class="distance-ring ${inside === true ? "inside" : inside === false ? "outside" : ""}">${distance == null ? "--" : distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}k`}</div><div><p class="eyebrow">Your position</p><h3>${inside === true ? "Inside the zone" : inside === false ? "Outside the zone" : "Location needed"}</h3><p class="muted small">${distance == null ? "Tap the button below after saving a station." : `${formatDistance(distance)} from the station centre.`}</p></div></div>
      <button class="button ${state.location?.sharing ? "button-warning" : "button-mint"}" type="button" data-action="${state.location?.sharing ? "stop-location" : "start-location"}">${icon(state.location?.sharing ? "locationOff" : "location")} ${state.location?.sharing ? "Stop location" : "Check my location"}</button>
      <p class="tiny muted">In Connected Mode, hider location remains team-only unless you deliberately change the sharing setting.</p>
    </aside>
  </div>`;
}

function renderTransit(state) {
  const game = state.game;
  if (!game || ![PHASES.SEEKING, PHASES.ENDGAME].includes(game.phase)) return "";
  const team = state.profile.team;
  const isSeeker = team !== game.hiderTeam || game.mode === "local";
  if (!isSeeker) return "";
  const transit = game.transit?.[team] || {};
  return `<section class="card card-pad simple-transit-bar"><div><p class="eyebrow">Train notice</p><h2>${transit.active ? "Marked as on a train" : "Tell the hiders before boarding"}</h2><p>${transit.active ? escapeHtml(transit.station || "Transit intent shared") : "The handbook requires a notice before boarding and again when you get off."}</p></div><button class="button button-primary" type="button" data-action="open-modal" data-modal="${transit.active ? "transit-end" : "transit-start"}">${icon("train")} ${transit.active ? "I am off the train" : "I am boarding"}</button></section>`;
}

export function renderMapView(state) {
  const mode = state.ui.mapMode || "deduction";
  return `<div class="view-stack simple-map-view">
    <div class="simple-map-switch" role="tablist" aria-label="Map type">
      <button type="button" class="${mode === "deduction" ? "active" : ""}" data-action="map-mode" data-mode="deduction">${icon("map")} Live map</button>
      <button type="button" class="${mode === "zone" ? "active" : ""}" data-action="map-mode" data-mode="zone">${icon("target")} 500 m zone</button>
      <button type="button" class="${mode === "authoritative" ? "active" : ""}" data-action="map-mode" data-mode="authoritative">${icon("external")} Official map</button>
    </div>
    ${mode === "zone" ? renderZoneCheck(state) : mode === "authoritative" ? renderAuthoritativeMap() : renderDeductionView(state)}
    ${renderTransit(state)}
  </div>`;
}
