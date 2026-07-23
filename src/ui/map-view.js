import { DEFAULT_DURATIONS, GAME_MAP_EMBED_URL, GAME_MAP_URL, TEAM_LABELS } from "../core/constants.js";
import { escapeHtml, formatDateTime } from "../core/format.js";
import { formatDistance, haversineMetres, isWithinRadius } from "../core/geo.js";
import { STATIONS, STATION_BY_ID, stationNameLength } from "../data/stations.js";
import { icon } from "./icons.js";

function stationOptions(selectedId) {
  return STATIONS.map((station) => `<option value="${station.id}" ${station.id === selectedId ? "selected" : ""}>${escapeHtml(station.name)}${station.note ? ` - ${escapeHtml(station.note)}` : ""}</option>`).join("");
}

function renderAuthoritativeMap() {
  return `
    <section class="card card-pad stack">
      <div class="section-head">
        <div><h2>Authoritative game map</h2><p>The boundary, hiding-station pins, rail layers, administrative divisions and curated POIs come from the handbook's Google My Maps layer.</p></div>
        <a class="button button-soft button-small" href="${GAME_MAP_URL}" target="_blank" rel="noopener">${icon("external")} Open full screen</a>
      </div>
      <div class="callout warning">${icon("info")}<p><strong>Use this layer for rulings.</strong>The offline planning boundary in Zone Check is approximate; this embedded map is authoritative.</p></div>
      <iframe class="map-frame" src="${GAME_MAP_EMBED_URL}" title="London Hide and Seek authoritative game map" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </section>
  `;
}

function renderPositionList(state) {
  const positions = state.positions || [];
  if (!positions.length) return `<div class="empty-state" style="min-height:130px"><div class="empty-state-inner"><span class="empty-icon">${icon("locationOff")}</span><strong>No shared positions</strong><span>Seekers can opt in before boarding and while travelling. Hider location defaults to team-only.</span></div></div>`;
  return `<div class="member-list">${positions.map((position) => `<div class="member-row"><div class="member-meta"><span class="member-status online"></span><div><strong>${escapeHtml(position.displayName || position.display_name || position.name || "Player")}</strong><div class="tiny muted">${escapeHtml(TEAM_LABELS[position.team] || position.team)} · accuracy ${position.accuracy ? Math.round(position.accuracy) + " m" : "unknown"}</div></div></div><span class="tiny muted">${position.recordedAt || position.recorded_at ? formatDateTime(position.recordedAt || position.recorded_at, { day: undefined, month: undefined }) : ""}</span></div>`).join("")}</div>`;
}

function renderZoneCheck(state) {
  const secret = state.privateTeamState || {};
  const station = STATION_BY_ID.get(secret.stationId) || (secret.stationName ? { name: secret.stationName } : null);
  const coords = secret.stationCoords;
  const current = state.location?.current || null;
  const distance = coords && current ? haversineMetres(current, coords) : null;
  const inside = distance == null ? null : isWithinRadius(current, coords, DEFAULT_DURATIONS.hidingZoneRadiusMetres);
  const isHider = state.game && state.profile.team === state.game.hiderTeam;
  return `
    <div class="grid grid-main">
      <section class="card card-pad stack">
        <div class="section-head"><div><h2>500 m zone check</h2><p>${isHider ? "Your selected station and coordinates remain private to your team in Connected Mode." : "Use this as a private planning anchor. It does not reveal the opponent's station."}</p></div></div>
        <div class="map-shell">
          <div id="zone-map" role="application" aria-label="Interactive hiding zone map"></div>
          <div class="map-overlay"><div class="map-status"><strong>${station ? escapeHtml(station.name) : "No station selected"}</strong><br>${coords ? `Coordinates resolved via ${escapeHtml(coords.source || "map data")}.` : "Resolve the station to draw its 500 m zone."}</div></div>
        </div>
      </section>
      <aside class="stack">
        <section class="card card-pad stack">
          <div><p class="eyebrow">Private station anchor</p><h2>${station ? escapeHtml(station.name) : "Choose a station"}</h2></div>
          <form class="station-picker" data-form="station-select">
            <div class="field"><label for="map-station">Hiding station</label><select id="map-station" name="stationId"><option value="">Select one of 100 stations...</option>${stationOptions(secret.stationId)}</select></div>
            <button class="button button-primary" type="submit">${icon("station")} Save and resolve coordinates</button>
          </form>
          ${station ? `<div class="station-result"><div><strong>${escapeHtml(station.name)}</strong><small>${escapeHtml(station.service || "")}${station.note ? ` · ${escapeHtml(station.note)}` : ""}</small></div><span class="station-name-length" title="Station name length">${stationNameLength(station.name)}</span></div>` : ""}
          ${coords ? `<div class="tiny muted mono">${Number(coords.lat).toFixed(6)}, ${Number(coords.lng).toFixed(6)}</div>` : `<button class="button button-soft" type="button" data-action="resolve-station" ${station ? "" : "disabled"}>${icon("refresh")} Resolve coordinates</button>`}
        </section>
        <section class="card card-pad stack">
          <div class="distance-panel">
            <div class="distance-ring ${inside === true ? "inside" : inside === false ? "outside" : ""}">${distance == null ? "--" : distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}k`}</div>
            <div><p class="eyebrow">Your GPS to station</p><h3>${inside === true ? "Inside the hiding zone" : inside === false ? "Outside the hiding zone" : "Location needed"}</h3><p class="muted small">${distance == null ? "Take a location reading after the station is resolved." : `${formatDistance(distance)} from the station centre.`}</p></div>
          </div>
          <button class="button ${state.location?.sharing ? "button-warning" : "button-mint"}" type="button" data-action="${state.location?.sharing ? "stop-location" : "start-location"}">${icon(state.location?.sharing ? "locationOff" : "location")} ${state.location?.sharing ? "Stop sharing" : "Get location / share"}</button>
          <div class="field"><label for="share-with">Who can see updates?</label><select id="share-with" data-action="location-visibility"><option value="team" ${state.location?.shareWith !== "all" ? "selected" : ""}>My team only</option><option value="all" ${state.location?.shareWith === "all" ? "selected" : ""}>Everyone in the game</option></select><span class="field-hint">Seekers should normally share with everyone; hiders default to team-only.</span></div>
        </section>
        <section class="card card-pad stack"><div class="section-head"><div><h2>Shared locations</h2><p>Only foreground, opt-in updates are shown.</p></div></div>${renderPositionList(state)}</section>
      </aside>
    </div>
  `;
}

function renderTransit(state) {
  const game = state.game;
  const team = state.profile.team;
  const transit = game?.transit?.[team] || {};
  return `
    <section class="card card-pad">
      <div class="grid grid-main">
        <div>
          <p class="eyebrow">Required movement notice</p>
          <h2>${transit.active ? "Your team is marked as on a train" : "Tell the other team before boarding"}</h2>
          <p class="lead">The handbook requires seekers to tell hiders before getting on and as they get off a train. Share the starting station while signal is reliable.</p>
        </div>
        <div class="stack">
          ${transit.active ? `
            <div class="callout">${icon("train")}<p><strong>${escapeHtml(transit.station || "On transit")}</strong>${transit.note ? escapeHtml(transit.note) : "Movement intent is visible to game members."}</p></div>
            <button class="button button-primary" type="button" data-action="open-modal" data-modal="transit-end">${icon("stop")} I am off the train</button>
          ` : `<button class="button button-primary" type="button" data-action="open-modal" data-modal="transit-start">${icon("train")} I am boarding a train</button>`}
          <button class="button button-soft" type="button" data-action="send-safety-check">${icon("safety")} Send safety check-in</button>
        </div>
      </div>
    </section>
  `;
}

export function renderMapView(state) {
  const mode = state.ui.mapMode || "authoritative";
  return `
    <div class="view-stack">
      <div class="row-between wrap">
        <div class="segmented" role="tablist" aria-label="Map mode">
          <button type="button" class="${mode === "authoritative" ? "active" : ""}" data-action="map-mode" data-mode="authoritative">Game map</button>
          <button type="button" class="${mode === "zone" ? "active" : ""}" data-action="map-mode" data-mode="zone">Zone check</button>
        </div>
        <a class="button button-soft button-small" href="https://www.google.com/maps" target="_blank" rel="noopener">${icon("external")} Google Maps</a>
      </div>
      ${mode === "authoritative" ? renderAuthoritativeMap() : renderZoneCheck(state)}
      ${renderTransit(state)}
      <section class="callout warning">${icon("alert")}<p><strong>Do not navigate while walking.</strong>Stop in a safe place before using the app, especially near roads, platforms and stairs.</p></section>
    </div>
  `;
}
