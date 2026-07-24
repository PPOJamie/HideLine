import { DEFAULT_DURATIONS, GAME_MAP_EMBED_URL, GAME_MAP_URL } from "../core/constants.js";
import { escapeHtml } from "../core/format.js";
import { formatDistance, haversineMetres, isWithinRadius } from "../core/geo.js";
import { STATIONS, STATION_BY_ID } from "../data/stations.js";
import { icon } from "./icons.js";
import { renderDeductionView } from "./deduction-view.js";

function stationOptions(selectedId) {
  return STATIONS.map((station) => `<option value="${station.id}" ${station.id === selectedId ? "selected" : ""}>${escapeHtml(station.name)}${station.note ? ` — ${escapeHtml(station.note)}` : ""}</option>`).join("");
}

function renderAuthoritativeMap() {
  return `<section class="card card-pad stack simple-official-map">
    <div class="section-head"><div><h2>Official game map</h2><p>Use this for the final ruling on boundaries, station pins and curated points of interest.</p></div><a class="button button-soft button-small" href="${GAME_MAP_URL}" target="_blank" rel="noopener">${icon("external")} Open in Google Maps</a></div>
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
      <div class="section-head"><div><h2>My 500 m zone</h2><p>Your selected station stays private to your team.</p></div></div>
      <div class="map-shell"><div id="zone-map" role="application" aria-label="Interactive hiding zone map"></div><div class="map-overlay"><div class="map-status"><strong>${station ? escapeHtml(station.name) : "Choose a station"}</strong><br>${coords ? "500 m circle ready" : "Save a station to draw its zone"}</div></div></div>
    </section>
    <aside class="card card-pad stack simple-zone-controls">
      <div class="distance-panel"><div class="distance-ring ${inside === true ? "inside" : inside === false ? "outside" : ""}">${distance == null ? "--" : distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}k`}</div><div><p class="eyebrow">Current position</p><h3>${inside === true ? "Inside the zone" : inside === false ? "Outside the zone" : "Location not checked"}</h3><p class="muted small">${distance == null ? "Select a station, then get your location." : `${formatDistance(distance)} from the station centre.`}</p></div></div>
      <form class="station-picker" data-form="station-select"><div class="field"><label for="map-station">Hiding station</label><select id="map-station" name="stationId"><option value="">Choose one of 100 stations…</option>${stationOptions(secret.stationId)}</select></div><button class="button button-primary" type="submit">${icon("check")} Save station</button></form>
      <button class="button ${state.location?.sharing ? "button-warning" : "button-mint"}" type="button" data-action="${state.location?.sharing ? "stop-location" : "start-location"}">${icon(state.location?.sharing ? "locationOff" : "location")} ${state.location?.sharing ? "Stop location" : "Get my location"}</button>
      <p class="tiny muted">In Connected Mode, location sharing remains opt-in. Hider locations default to team-only.</p>
    </aside>
  </div>`;
}

export function renderMapView(state) {
  const connectedHider = state.connection.mode === "connected" && state.game && state.profile.team === state.game.hiderTeam;
  const requestedMode = state.ui.mapMode || "deduction";
  const mode = connectedHider && requestedMode === "deduction" ? "zone" : requestedMode;
  return `<div class="view-stack simple-map-view">
    <div class="simple-map-switch" role="tablist" aria-label="Map view">
      <button type="button" class="${mode === "deduction" ? "active" : ""}" data-action="map-mode" data-mode="deduction" ${connectedHider ? "disabled" : ""}>${icon("target")} Find hiders</button>
      <button type="button" class="${mode === "zone" ? "active" : ""}" data-action="map-mode" data-mode="zone">${icon("location")} My zone</button>
      <button type="button" class="${mode === "authoritative" ? "active" : ""}" data-action="map-mode" data-mode="authoritative">${icon("map")} Official map</button>
    </div>
    ${connectedHider && requestedMode === "deduction" ? `<div class="callout">${icon("lock")}<p><strong>The seeker deduction map is private.</strong>Your device has opened My Zone instead.</p></div>` : ""}
    ${mode === "authoritative" ? renderAuthoritativeMap() : mode === "deduction" ? renderDeductionView(state) : renderZoneCheck(state)}
    <section class="callout warning simple-map-safety">${icon("alert")}<p>Stop in a safe place before checking the map, especially near roads, stairs and platforms.</p></section>
  </div>`;
}
