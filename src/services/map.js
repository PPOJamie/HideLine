import { APPROXIMATE_GAME_BOUNDARY, LONDON_MAP_CENTRE } from "../data/boundary.js";
import { LEAFLET_CSS_URL, LEAFLET_JS_URL } from "../core/constants.js";
import { constraintOverlay, DEDUCTION_STATUS, THAMES_CENTRELINE } from "../core/deduction.js";

let loadPromise;
let zoneMapInstance;
let zoneLayerGroup;
let deductionMapInstance;
let deductionLayerGroups;
let deductionPick = null;

const STATUS_COLOURS = Object.freeze({
  [DEDUCTION_STATUS.POSSIBLE]: { stroke: "#167a67", fill: "#28b496" },
  [DEDUCTION_STATUS.PARTIAL]: { stroke: "#a96c00", fill: "#e4a11b" },
  [DEDUCTION_STATUS.PRIORITY]: { stroke: "#6941c6", fill: "#8b5cf6" },
  [DEDUCTION_STATUS.ELIMINATED]: { stroke: "#697586", fill: "#9aa4b2" }
});

export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const fail = (message, node) => {
      node?.remove();
      loadPromise = null;
      reject(new Error(message));
    };
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      link.crossOrigin = "anonymous";
      document.head.append(link);
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS_URL}"]`);
    const script = existing || document.createElement("script");
    if (!existing) {
      script.src = LEAFLET_JS_URL;
      script.crossOrigin = "anonymous";
      document.head.append(script);
    }
    if (window.L) {
      resolve(window.L);
      return;
    }
    const timer = window.setTimeout(() => fail("The interactive map library timed out. The deduction list and station filters still work without the map.", script), 12000);
    script.addEventListener("load", () => {
      window.clearTimeout(timer);
      if (window.L) resolve(window.L);
      else fail("The interactive map library loaded incorrectly. The deduction list and station filters still work without the map.", script);
    }, { once: true });
    script.addEventListener("error", () => {
      window.clearTimeout(timer);
      fail("The interactive map library could not be loaded. The deduction list and station filters still work without the map.", script);
    }, { once: true });
  });
  return loadPromise;
}

export function renderMapFallback(containerId, message) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="map-unavailable" role="status">
      <div class="map-unavailable-icon" aria-hidden="true">!</div>
      <strong>Interactive map unavailable</strong>
      <span>${escapeMapText(message || "The map library could not be loaded.")}</span>
      <small>The station board, automatic eliminations, manual overrides and undo history remain fully usable.</small>
    </div>`;
}


function addBaseMap(L, map) {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  L.polygon(APPROXIMATE_GAME_BOUNDARY.map(([lng, lat]) => [lat, lng]), {
    color: "#e9572e",
    weight: 2,
    opacity: 0.9,
    fillColor: "#f26a3d",
    fillOpacity: 0.035,
    dashArray: "8 7",
    interactive: false
  }).bindTooltip("Approximate planning boundary — check the authoritative Google layer").addTo(map);
}

export async function renderZoneMap({ containerId = "zone-map", station, positions = [], radiusMetres = 500, onReady } = {}) {
  const L = await loadLeaflet();
  const container = document.getElementById(containerId);
  if (!container) return null;
  destroyZoneMap();
  zoneMapInstance = L.map(container, { zoomControl: true, attributionControl: true }).setView([LONDON_MAP_CENTRE.lat, LONDON_MAP_CENTRE.lng], LONDON_MAP_CENTRE.zoom);
  addBaseMap(L, zoneMapInstance);
  zoneLayerGroup = L.layerGroup().addTo(zoneMapInstance);
  updateZoneMap({ station, positions, radiusMetres });
  setTimeout(() => zoneMapInstance?.invalidateSize(), 60);
  onReady?.(zoneMapInstance);
  return zoneMapInstance;
}

export function updateZoneMap({ station, positions = [], radiusMetres = 500 } = {}) {
  if (!zoneMapInstance || !zoneLayerGroup || !window.L) return;
  const L = window.L;
  zoneLayerGroup.clearLayers();
  const bounds = [];
  if (station?.lat != null && station?.lng != null) {
    const centre = [Number(station.lat), Number(station.lng)];
    L.circle(centre, { radius: radiusMetres, color: "#1e9b80", fillColor: "#34bea1", fillOpacity: 0.12, weight: 3 }).addTo(zoneLayerGroup);
    L.circleMarker(centre, { radius: 8, color: "#0b1f33", fillColor: "#f26a3d", fillOpacity: 1, weight: 3 })
      .bindPopup(`<strong>${escapeMapText(station.name || "Hiding station")}</strong><br>${radiusMetres} m hiding zone`)
      .addTo(zoneLayerGroup);
    bounds.push(centre);
  }
  for (const position of positions) {
    if (position.lat == null || position.lng == null) continue;
    const point = [Number(position.lat), Number(position.lng)];
    const isOwn = Boolean(position.isOwn);
    L.circleMarker(point, { radius: isOwn ? 8 : 7, color: isOwn ? "#3269bb" : "#0b1f33", fillColor: position.team === "bravo" ? "#34bea1" : "#f26a3d", fillOpacity: .95, weight: 3 })
      .bindPopup(`<strong>${escapeMapText(position.name || "Player")}</strong><br>${escapeMapText(position.teamLabel || position.team || "")}`)
      .addTo(zoneLayerGroup);
    if (position.accuracy) L.circle(point, { radius: Number(position.accuracy), color: "#3269bb", weight: 1, fillOpacity: 0.03 }).addTo(zoneLayerGroup);
    bounds.push(point);
  }
  if (bounds.length === 1) zoneMapInstance.setView(bounds[0], 15);
  if (bounds.length > 1) zoneMapInstance.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
}

export function destroyZoneMap() {
  zoneMapInstance?.remove();
  zoneMapInstance = null;
  zoneLayerGroup = null;
}

function statusDescription(result) {
  if (result.status === DEDUCTION_STATUS.PRIORITY) return "Priority — still possible";
  if (result.status === DEDUCTION_STATUS.PARTIAL) return "Partly possible";
  if (result.status === DEDUCTION_STATUS.ELIMINATED) return "Eliminated";
  return "Possible";
}

function resultReason(result) {
  if (result.failures?.length) return result.failures[0];
  if (result.partials?.length) return result.partials[0];
  if (result.passes?.length) return `Passes ${result.passes.length} active deduction${result.passes.length === 1 ? "" : "s"}`;
  return "No active deduction rules";
}

function stationPopup(result) {
  const manualEliminated = Boolean(result.override?.eliminated);
  return `
    <div class="map-popup-card">
      <strong>${escapeMapText(result.name)}</strong>
      <span>${escapeMapText(statusDescription(result))}</span>
      <small>${escapeMapText(resultReason(result))}</small>
      <div class="map-popup-actions">
        <button type="button" data-action="deduction-toggle-priority" data-id="${escapeMapText(result.id)}" ${result.possible ? "" : "disabled"}>${result.priority ? "Unstar" : "Priority"}</button>
        <button type="button" data-action="deduction-toggle-eliminated" data-id="${escapeMapText(result.id)}">${manualEliminated ? "Restore manual" : "Eliminate"}</button>
      </div>
    </div>`;
}

function drawConstraintOverlays(L, group, constraints) {
  for (const constraint of constraints || []) {
    const overlay = constraintOverlay(constraint);
    if (!overlay) continue;
    const isNo = String(overlay.answer || "").toLowerCase() === "no" || String(overlay.answer || "").toLowerCase() === "colder" || String(overlay.answer || "").toLowerCase() === "further";
    const color = isNo ? "#b54708" : "#3269bb";
    if (overlay.type === "circle" && overlay.centre && Number.isFinite(overlay.radiusMetres)) {
      L.circle([overlay.centre.lat, overlay.centre.lng], { radius: overlay.radiusMetres, color, weight: 2, dashArray: "7 6", fillColor: color, fillOpacity: 0.035 })
        .bindTooltip(escapeMapText(overlay.label))
        .addTo(group);
      L.circleMarker([overlay.centre.lat, overlay.centre.lng], { radius: 5, color, fillColor: "#fff", fillOpacity: 1, weight: 2 }).addTo(group);
    }
    if (overlay.type === "line" && overlay.start && overlay.end) {
      L.polyline([[overlay.start.lat, overlay.start.lng], [overlay.end.lat, overlay.end.lng]], { color, weight: 4, dashArray: "8 6" })
        .bindTooltip(escapeMapText(overlay.label))
        .addTo(group);
      L.circleMarker([overlay.start.lat, overlay.start.lng], { radius: 6, color, fillColor: "#fff", fillOpacity: 1, weight: 3 }).bindTooltip("Thermometer start").addTo(group);
      L.circleMarker([overlay.end.lat, overlay.end.lng], { radius: 6, color, fillColor: color, fillOpacity: 1, weight: 3 }).bindTooltip("Thermometer end").addTo(group);
    }
    if (overlay.type === "distance" && overlay.seeker && overlay.target && Number.isFinite(overlay.radiusMetres)) {
      L.circle([overlay.target.lat, overlay.target.lng], { radius: overlay.radiusMetres, color, weight: 2, dashArray: "5 5", fillOpacity: 0.025 })
        .bindTooltip(escapeMapText(overlay.label))
        .addTo(group);
      L.polyline([[overlay.seeker.lat, overlay.seeker.lng], [overlay.target.lat, overlay.target.lng]], { color, weight: 3, dashArray: "6 5" }).addTo(group);
      L.circleMarker([overlay.target.lat, overlay.target.lng], { radius: 6, color, fillColor: color, fillOpacity: 1, weight: 3 }).bindTooltip("Reference point").addTo(group);
    }
    if (overlay.type === "thames" && Array.isArray(overlay.line)) {
      L.polyline(overlay.line.map((point) => [point.lat, point.lng]), { color: "#2176ae", weight: 5, opacity: 0.7, dashArray: "10 7" })
        .bindTooltip("Approximate Thames centreline")
        .addTo(group);
    }
  }
}


const VECTOR_MAP = Object.freeze({
  width: 960,
  height: 700,
  pad: 42,
  west: -0.225,
  east: -0.025,
  south: 51.45,
  north: 51.545
});

function vectorPoint(point) {
  const x = VECTOR_MAP.pad + ((Number(point.lng) - VECTOR_MAP.west) / (VECTOR_MAP.east - VECTOR_MAP.west)) * (VECTOR_MAP.width - VECTOR_MAP.pad * 2);
  const y = VECTOR_MAP.pad + ((VECTOR_MAP.north - Number(point.lat)) / (VECTOR_MAP.north - VECTOR_MAP.south)) * (VECTOR_MAP.height - VECTOR_MAP.pad * 2);
  return { x, y };
}

function vectorEllipse(point, radiusMetres) {
  const metresPerLat = 111_320;
  const metresPerLng = metresPerLat * Math.cos((Number(point.lat) * Math.PI) / 180);
  return {
    rx: ((Number(radiusMetres) / metresPerLng) / (VECTOR_MAP.east - VECTOR_MAP.west)) * (VECTOR_MAP.width - VECTOR_MAP.pad * 2),
    ry: ((Number(radiusMetres) / metresPerLat) / (VECTOR_MAP.north - VECTOR_MAP.south)) * (VECTOR_MAP.height - VECTOR_MAP.pad * 2)
  };
}

function vectorPoints(points) {
  return points.map((point) => {
    const projected = vectorPoint(point);
    return `${projected.x.toFixed(1)},${projected.y.toFixed(1)}`;
  }).join(" ");
}

function vectorConstraintSvg(constraints) {
  return (constraints || []).map((constraint) => {
    const overlay = constraintOverlay(constraint);
    if (!overlay) return "";
    const answer = String(overlay.answer || "").toLowerCase();
    const negative = ["no", "colder", "further"].includes(answer);
    const colour = negative ? "#b54708" : "#3269bb";
    if (overlay.type === "circle" && overlay.centre && Number.isFinite(overlay.radiusMetres)) {
      const centre = vectorPoint(overlay.centre);
      const radius = vectorEllipse(overlay.centre, overlay.radiusMetres);
      return `<ellipse cx="${centre.x}" cy="${centre.y}" rx="${radius.rx}" ry="${radius.ry}" fill="${colour}" fill-opacity=".035" stroke="${colour}" stroke-width="2.5" stroke-dasharray="8 7"><title>${escapeMapText(overlay.label)}</title></ellipse><circle cx="${centre.x}" cy="${centre.y}" r="5" fill="#fff" stroke="${colour}" stroke-width="2.5" />`;
    }
    if (overlay.type === "line" && overlay.start && overlay.end) {
      const start = vectorPoint(overlay.start);
      const end = vectorPoint(overlay.end);
      return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${colour}" stroke-width="4" stroke-dasharray="10 7"><title>${escapeMapText(overlay.label)}</title></line><circle cx="${start.x}" cy="${start.y}" r="6" fill="#fff" stroke="${colour}" stroke-width="3" /><circle cx="${end.x}" cy="${end.y}" r="6" fill="${colour}" stroke="#fff" stroke-width="2" />`;
    }
    if (overlay.type === "distance" && overlay.seeker && overlay.target && Number.isFinite(overlay.radiusMetres)) {
      const seeker = vectorPoint(overlay.seeker);
      const target = vectorPoint(overlay.target);
      const radius = vectorEllipse(overlay.target, overlay.radiusMetres);
      return `<ellipse cx="${target.x}" cy="${target.y}" rx="${radius.rx}" ry="${radius.ry}" fill="${colour}" fill-opacity=".025" stroke="${colour}" stroke-width="2" stroke-dasharray="7 6"><title>${escapeMapText(overlay.label)}</title></ellipse><line x1="${seeker.x}" y1="${seeker.y}" x2="${target.x}" y2="${target.y}" stroke="${colour}" stroke-width="3" stroke-dasharray="7 6" /><circle cx="${target.x}" cy="${target.y}" r="6" fill="${colour}" stroke="#fff" stroke-width="2" />`;
    }
    if (overlay.type === "thames" && Array.isArray(overlay.line)) {
      return `<polyline points="${vectorPoints(overlay.line)}" fill="none" stroke="#2176ae" stroke-width="5" stroke-opacity=".72" stroke-dasharray="12 8"><title>Approximate Thames centreline</title></polyline>`;
    }
    return "";
  }).join("");
}

function renderDeductionVectorMap({
  container,
  results = [],
  constraints = [],
  showEliminated = true,
  showZones = false,
  selectedStationId = null,
  message = ""
} = {}) {
  if (!container) return null;
  const visible = results.filter((result) => showEliminated || result.status !== DEDUCTION_STATUS.ELIMINATED);
  const boundary = APPROXIMATE_GAME_BOUNDARY.map(([lng, lat]) => ({ lat, lng }));
  const zoneSvg = visible.map((result) => {
    if (!showZones && result.id !== selectedStationId) return "";
    const centre = vectorPoint(result);
    const radius = vectorEllipse(result, 500);
    const palette = STATUS_COLOURS[result.status] || STATUS_COLOURS[DEDUCTION_STATUS.POSSIBLE];
    const selected = result.id === selectedStationId;
    return `<ellipse cx="${centre.x}" cy="${centre.y}" rx="${radius.rx}" ry="${radius.ry}" fill="${palette.fill}" fill-opacity="${selected ? ".16" : result.status === DEDUCTION_STATUS.ELIMINATED ? ".015" : ".05"}" stroke="${palette.stroke}" stroke-width="${selected ? 4 : 1.4}" stroke-opacity="${result.status === DEDUCTION_STATUS.ELIMINATED ? ".45" : ".82"}" />`;
  }).join("");
  const markerSvg = visible.map((result) => {
    const centre = vectorPoint(result);
    const palette = STATUS_COLOURS[result.status] || STATUS_COLOURS[DEDUCTION_STATUS.POSSIBLE];
    const selected = result.id === selectedStationId;
    const radius = selected ? 9 : result.status === DEDUCTION_STATUS.PRIORITY ? 7.5 : 5.5;
    return `<g class="vector-station" data-station-id="${escapeMapText(result.id)}"><circle cx="${centre.x}" cy="${centre.y}" r="${radius}" fill="${palette.fill}" fill-opacity="${result.status === DEDUCTION_STATUS.ELIMINATED ? ".58" : ".98"}" stroke="${selected ? "#0b1f33" : palette.stroke}" stroke-width="${selected ? 4 : 2}"><title>${escapeMapText(result.name)} — ${escapeMapText(statusDescription(result))}</title></circle>${selected ? `<text x="${centre.x + 13}" y="${centre.y - 10}" class="vector-station-label">${escapeMapText(result.name)}</text>` : ""}</g>`;
  }).join("");
  const thames = vectorPoints(THAMES_CENTRELINE);
  container.innerHTML = `
    <div class="deduction-vector-wrap">
      <svg class="deduction-vector-map" viewBox="0 0 ${VECTOR_MAP.width} ${VECTOR_MAP.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Offline vector deduction map of central London stations">
        <defs>
          <pattern id="vector-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M 44 0 L 0 0 0 44" fill="none" stroke="#9fb4c1" stroke-width="1" stroke-opacity=".18" /></pattern>
        </defs>
        <rect width="${VECTOR_MAP.width}" height="${VECTOR_MAP.height}" rx="22" fill="#edf4f7" />
        <rect x="18" y="18" width="${VECTOR_MAP.width - 36}" height="${VECTOR_MAP.height - 36}" rx="18" fill="url(#vector-grid)" />
        <polygon points="${vectorPoints(boundary)}" fill="#f26a3d" fill-opacity=".035" stroke="#e9572e" stroke-width="2.5" stroke-dasharray="10 8"><title>Approximate planning boundary</title></polygon>
        <polyline points="${thames}" fill="none" stroke="#70b7db" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" opacity=".55"><title>River Thames planning guide</title></polyline>
        <polyline points="${thames}" fill="none" stroke="#2176ae" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".72" />
        ${zoneSvg}
        ${vectorConstraintSvg(constraints)}
        ${markerSvg}
        <g class="vector-north" transform="translate(${VECTOR_MAP.width - 72} 62)"><path d="M0 23 L12 -8 L24 23 L12 16 Z" fill="#0b1f33" /><text x="12" y="39" text-anchor="middle">N</text></g>
      </svg>
      <div class="vector-map-badge" title="${escapeMapText(message || "Interactive basemap unavailable")}"><strong>Built-in vector map</strong><span>Station status and deduction overlays remain available without map tiles.</span></div>
    </div>`;
  const svg = container.querySelector("svg");
  svg?.addEventListener("click", (event) => {
    if (!deductionPick?.callback) return;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / VECTOR_MAP.width, rect.height / VECTOR_MAP.height);
    const renderedWidth = VECTOR_MAP.width * scale;
    const renderedHeight = VECTOR_MAP.height * scale;
    const offsetX = (rect.width - renderedWidth) / 2;
    const offsetY = (rect.height - renderedHeight) / 2;
    const x = Math.max(VECTOR_MAP.pad, Math.min(VECTOR_MAP.width - VECTOR_MAP.pad, (event.clientX - rect.left - offsetX) / scale));
    const y = Math.max(VECTOR_MAP.pad, Math.min(VECTOR_MAP.height - VECTOR_MAP.pad, (event.clientY - rect.top - offsetY) / scale));
    const lng = VECTOR_MAP.west + ((x - VECTOR_MAP.pad) / (VECTOR_MAP.width - VECTOR_MAP.pad * 2)) * (VECTOR_MAP.east - VECTOR_MAP.west);
    const lat = VECTOR_MAP.north - ((y - VECTOR_MAP.pad) / (VECTOR_MAP.height - VECTOR_MAP.pad * 2)) * (VECTOR_MAP.north - VECTOR_MAP.south);
    const callback = deductionPick.callback;
    const prefix = deductionPick.prefix;
    deductionPick = null;
    container.classList.remove("map-pick-active");
    callback({ lat, lng, prefix });
  });
  if (deductionPick) container.classList.add("map-pick-active");
  return { type: "vector", container };
}

export async function renderDeductionMap({
  containerId = "deduction-map",
  results = [],
  constraints = [],
  showEliminated = true,
  showZones = false,
  selectedStationId = null,
  onStationAction,
  onReady
} = {}) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  destroyDeductionMap();
  let L;
  try {
    L = await loadLeaflet();
  } catch (error) {
    return renderDeductionVectorMap({ container, results, constraints, showEliminated, showZones, selectedStationId, message: error.message });
  }
  deductionMapInstance = L.map(container, { zoomControl: true, attributionControl: true, preferCanvas: true }).setView([LONDON_MAP_CENTRE.lat, LONDON_MAP_CENTRE.lng], LONDON_MAP_CENTRE.zoom);
  addBaseMap(L, deductionMapInstance);
  deductionLayerGroups = {
    overlays: L.layerGroup().addTo(deductionMapInstance),
    zones: L.layerGroup().addTo(deductionMapInstance),
    markers: L.layerGroup().addTo(deductionMapInstance)
  };
  drawConstraintOverlays(L, deductionLayerGroups.overlays, constraints);
  const visible = results.filter((result) => showEliminated || result.status !== DEDUCTION_STATUS.ELIMINATED);
  const bounds = [];
  for (const result of visible) {
    if (!Number.isFinite(Number(result.lat)) || !Number.isFinite(Number(result.lng))) continue;
    const centre = [Number(result.lat), Number(result.lng)];
    const palette = STATUS_COLOURS[result.status] || STATUS_COLOURS[DEDUCTION_STATUS.POSSIBLE];
    const selected = result.id === selectedStationId;
    if (showZones || selected) {
      L.circle(centre, {
        radius: 500,
        color: palette.stroke,
        fillColor: palette.fill,
        fillOpacity: result.status === DEDUCTION_STATUS.ELIMINATED ? 0.015 : selected ? 0.14 : 0.045,
        opacity: result.status === DEDUCTION_STATUS.ELIMINATED ? 0.45 : 0.85,
        weight: selected ? 4 : 1.5,
        interactive: false
      }).addTo(deductionLayerGroups.zones);
    }
    const marker = L.circleMarker(centre, {
      radius: selected ? 10 : result.status === DEDUCTION_STATUS.PRIORITY ? 8 : 6,
      color: selected ? "#0b1f33" : palette.stroke,
      fillColor: palette.fill,
      fillOpacity: result.status === DEDUCTION_STATUS.ELIMINATED ? 0.62 : 0.98,
      weight: selected ? 4 : 2,
      opacity: result.status === DEDUCTION_STATUS.ELIMINATED ? 0.62 : 1
    }).bindTooltip(escapeMapText(result.name), { direction: "top", offset: [0, -6] })
      .bindPopup(stationPopup(result), { minWidth: 230 })
      .addTo(deductionLayerGroups.markers);
    marker.on("popupopen", () => {
      const popup = marker.getPopup()?.getElement();
      popup?.querySelectorAll("[data-action]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          onStationAction?.(button.dataset.action, button.dataset.id);
        }, { once: true });
      });
    });
    bounds.push(centre);
  }
  deductionMapInstance.on("click", (event) => {
    if (!deductionPick?.callback) return;
    const callback = deductionPick.callback;
    const prefix = deductionPick.prefix;
    deductionPick = null;
    container.classList.remove("map-pick-active");
    callback({ lat: event.latlng.lat, lng: event.latlng.lng, prefix });
  });
  if (deductionPick) container.classList.add("map-pick-active");
  const selected = results.find((result) => result.id === selectedStationId);
  if (selected) deductionMapInstance.setView([Number(selected.lat), Number(selected.lng)], 15, { animate: false });
  else if (bounds.length) deductionMapInstance.fitBounds(bounds, { padding: [28, 28], maxZoom: 13, animate: false });
  setTimeout(() => deductionMapInstance?.invalidateSize(), 80);
  onReady?.(deductionMapInstance);
  return deductionMapInstance;
}

export function beginDeductionMapPick(prefix, callback) {
  deductionPick = { prefix, callback };
  const container = document.getElementById("deduction-map");
  container?.classList.add("map-pick-active");
}

export function cancelDeductionMapPick() {
  deductionPick = null;
  document.getElementById("deduction-map")?.classList.remove("map-pick-active");
}

export function focusDeductionStation(station) {
  if (!deductionMapInstance || !station) return;
  deductionMapInstance.setView([Number(station.lat), Number(station.lng)], 15, { animate: true });
}

export function destroyDeductionMap() {
  deductionMapInstance?.remove();
  deductionMapInstance = null;
  deductionLayerGroups = null;
}

function escapeMapText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}
