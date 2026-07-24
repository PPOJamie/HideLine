import { APPROXIMATE_GAME_BOUNDARY, LONDON_MAP_CENTRE } from "../data/boundary.js";
import { LEAFLET_CSS_URL, LEAFLET_JS_URL } from "../core/constants.js";
import { STATION_GEO } from "../data/station-geo.js";
import {
  constraintOverlay,
  DEDUCTION_MAP_MODES,
  DEDUCTION_STATUS,
  evaluateZoneAreaMask,
  THAMES_CENTRELINE
} from "../core/deduction.js";

let loadPromise;
let zoneMapInstance;
let zoneLayerGroup;
let deductionMapInstance;
let deductionLayerGroups;
let deductionMaskLayer;
let deductionPick = null;
let deductionViewportCache = null;
let activeDeductionViewportKey = null;
let coordinatePickerMapInstance;
let coordinatePickerMarker;
let coordinatePickerFallback = null;

const STATUS_COLOURS = Object.freeze({
  [DEDUCTION_STATUS.POSSIBLE]: { stroke: "#167a67", fill: "#28b496" },
  [DEDUCTION_STATUS.PARTIAL]: { stroke: "#a96c00", fill: "#e4a11b" },
  [DEDUCTION_STATUS.PRIORITY]: { stroke: "#6941c6", fill: "#8b5cf6" },
  [DEDUCTION_STATUS.ELIMINATED]: { stroke: "#697586", fill: "#9aa4b2" }
});

const MASK_COLOURS = Object.freeze({
  allowed: { fill: "rgba(30, 157, 126, 0.30)", stroke: "rgba(18, 110, 89, 0.16)" },
  excluded: { fill: "rgba(78, 88, 101, 0.58)", stroke: "rgba(42, 49, 58, 0.22)" },
  unknown: { fill: "rgba(228, 161, 27, 0.30)", stroke: "rgba(151, 99, 0, 0.17)" }
});

const HISTORY_MASK = Object.freeze({
  fill: "rgba(50, 105, 187, 0.10)",
  stroke: "rgba(38, 81, 145, 0.46)",
  hatch: "rgba(38, 81, 145, 0.42)"
});

function excludedCellOpacity(cell) {
  const count = Math.max(1, Number(cell?.excludedByCount) || 1);
  return Math.min(0.84, 0.48 + Math.log2(count + 1) * 0.1);
}

function maskCellPalette(cell) {
  if (cell?.state === "excluded") {
    const opacity = excludedCellOpacity(cell);
    return {
      fill: `rgba(78, 88, 101, ${opacity.toFixed(3)})`,
      stroke: `rgba(42, 49, 58, ${Math.min(0.4, opacity * 0.48).toFixed(3)})`
    };
  }
  return MASK_COLOURS[cell?.state] || MASK_COLOURS.unknown;
}

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

function addBaseMap(L, map, { showBoundary = true } = {}) {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  if (!showBoundary) return;
  L.polygon(APPROXIMATE_GAME_BOUNDARY.map(([lng, lat]) => [lat, lng]), {
    color: "#e9572e",
    weight: 2,
    opacity: 0.9,
    fillColor: "#f26a3d",
    fillOpacity: 0.035,
    dashArray: "8 7",
    interactive: false
  }).bindTooltip("Approximate planning boundary - check the authoritative Google layer").addTo(map);
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
    L.circleMarker(point, { radius: isOwn ? 8 : 7, color: isOwn ? "#3269bb" : "#0b1f33", fillColor: position.team === "bravo" ? "#34bea1" : "#f26a3d", fillOpacity: 0.95, weight: 3 })
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


function pickerPoint(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: LONDON_MAP_CENTRE.lat, lng: LONDON_MAP_CENTRE.lng };
  return { lat, lng };
}

function setFallbackPickerPoint(point, { notify = false } = {}) {
  if (!coordinatePickerFallback) return;
  const parsed = pickerPoint(point);
  coordinatePickerFallback.point = parsed;
  const projected = vectorPoint(parsed, coordinatePickerFallback.projection);
  coordinatePickerFallback.marker?.setAttribute("cx", projected.x.toFixed(1));
  coordinatePickerFallback.marker?.setAttribute("cy", projected.y.toFixed(1));
  coordinatePickerFallback.markerHalo?.setAttribute("cx", projected.x.toFixed(1));
  coordinatePickerFallback.markerHalo?.setAttribute("cy", projected.y.toFixed(1));
  if (notify) coordinatePickerFallback.onChange?.(parsed);
}

function renderCoordinatePickerFallback(container, initialPoint, onChange, message = "") {
  const projection = VECTOR_MAP;
  const point = pickerPoint(initialPoint);
  const boundary = APPROXIMATE_GAME_BOUNDARY.map(([lng, lat]) => ({ lat, lng }));
  const stationDots = STATION_GEO.map((station) => {
    const projected = vectorPoint(station, projection);
    return `<circle cx="${projected.x.toFixed(1)}" cy="${projected.y.toFixed(1)}" r="2.2" fill="#536273" fill-opacity=".62"><title>${escapeMapText(station.name)}</title></circle>`;
  }).join("");
  const projected = vectorPoint(point, projection);
  container.innerHTML = `<div class="coordinate-picker-fallback"><svg viewBox="0 0 ${projection.width} ${projection.height}" preserveAspectRatio="xMidYMid meet" role="application" aria-label="Tap the London map to choose coordinates"><rect width="${projection.width}" height="${projection.height}" rx="18" fill="#edf4f7" /><polygon points="${vectorPoints(boundary, projection)}" fill="#f26a3d" fill-opacity=".035" stroke="#e9572e" stroke-width="2.5" stroke-dasharray="10 8" /><polyline points="${vectorPoints(THAMES_CENTRELINE, projection)}" fill="none" stroke="#8bc7e3" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".38" /><polyline points="${vectorPoints(THAMES_CENTRELINE, projection)}" fill="none" stroke="#2176ae" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".78" />${stationDots}<circle data-picker-halo cx="${projected.x.toFixed(1)}" cy="${projected.y.toFixed(1)}" r="13" fill="#fff" fill-opacity=".88" stroke="#0b1f33" stroke-width="2" /><circle data-picker-marker cx="${projected.x.toFixed(1)}" cy="${projected.y.toFixed(1)}" r="7" fill="#f26a3d" stroke="#0b1f33" stroke-width="3" /></svg><p>${escapeMapText(message || "Offline map active. Tap anywhere to place the pin.")}</p></div>`;
  const svg = container.querySelector("svg");
  coordinatePickerFallback = {
    container,
    svg,
    marker: container.querySelector("[data-picker-marker]"),
    markerHalo: container.querySelector("[data-picker-halo]"),
    projection,
    point,
    onChange
  };
  svg?.addEventListener("click", (event) => {
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / projection.width, rect.height / projection.height);
    const renderedWidth = projection.width * scale;
    const renderedHeight = projection.height * scale;
    const offsetX = (rect.width - renderedWidth) / 2;
    const offsetY = (rect.height - renderedHeight) / 2;
    const x = Math.max(projection.pad, Math.min(projection.width - projection.pad, (event.clientX - rect.left - offsetX) / scale));
    const y = Math.max(projection.pad, Math.min(projection.height - projection.pad, (event.clientY - rect.top - offsetY) / scale));
    const lng = projection.west + ((x - projection.pad) / (projection.width - projection.pad * 2)) * (projection.east - projection.west);
    const lat = projection.north - ((y - projection.pad) / (projection.height - projection.pad * 2)) * (projection.north - projection.south);
    setFallbackPickerPoint({ lat, lng }, { notify: true });
  });
  return { type: "vector", container };
}

/** Open a self-contained map used by question forms to choose one coordinate. */
export async function renderCoordinatePickerMap({
  containerId = "coordinate-picker-map",
  initialPoint = LONDON_MAP_CENTRE,
  onChange
} = {}) {
  destroyCoordinatePickerMap();
  const container = document.getElementById(containerId);
  if (!container) return null;
  const point = pickerPoint(initialPoint);
  let L;
  try {
    L = await loadLeaflet();
  } catch (error) {
    return renderCoordinatePickerFallback(container, point, onChange, error.message);
  }
  coordinatePickerMapInstance = L.map(container, { zoomControl: true, attributionControl: true }).setView([point.lat, point.lng], 15);
  addBaseMap(L, coordinatePickerMapInstance);
  // The OpenStreetMap basemap already contains the actual Thames banks. Do
  // not add a second approximate river line here: it can visually spill onto
  // land when zoomed in and is unnecessary for choosing a coordinate.
  coordinatePickerMarker = L.marker([point.lat, point.lng], { draggable: true, autoPan: true }).addTo(coordinatePickerMapInstance);
  coordinatePickerMarker.bindTooltip("Drag or tap the map to move this pin", { permanent: false, direction: "top" });
  const report = (latlng) => {
    const selected = { lat: Number(latlng.lat), lng: Number(latlng.lng) };
    coordinatePickerMarker?.setLatLng([selected.lat, selected.lng]);
    onChange?.(selected);
  };
  coordinatePickerMapInstance.on("click", (event) => report(event.latlng));
  coordinatePickerMarker.on("dragend", (event) => report(event.target.getLatLng()));
  window.setTimeout(() => coordinatePickerMapInstance?.invalidateSize(), 80);
  return coordinatePickerMapInstance;
}

export function updateCoordinatePickerPoint(point, { pan = true } = {}) {
  const parsed = pickerPoint(point);
  if (coordinatePickerMapInstance && coordinatePickerMarker) {
    coordinatePickerMarker.setLatLng([parsed.lat, parsed.lng]);
    if (pan) coordinatePickerMapInstance.setView([parsed.lat, parsed.lng], Math.max(15, coordinatePickerMapInstance.getZoom()), { animate: false });
  }
  setFallbackPickerPoint(parsed);
}

export function destroyCoordinatePickerMap() {
  coordinatePickerMapInstance?.remove();
  coordinatePickerMapInstance = null;
  coordinatePickerMarker = null;
  if (coordinatePickerFallback?.container) coordinatePickerFallback.container.innerHTML = "";
  coordinatePickerFallback = null;
}

function statusDescription(result) {
  if (result.status === DEDUCTION_STATUS.PRIORITY) return "Priority - still possible";
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

function featureStyle(colour) {
  return { color: colour, weight: 4, opacity: 0.88, fillColor: colour, fillOpacity: 0.12, dashArray: "6 5" };
}

function drawReferenceFeature(L, group, feature, colour, label) {
  if (!feature?.geometry) return;
  try {
    const layer = L.geoJSON({ type: "Feature", geometry: feature.geometry, properties: {} }, {
      style: () => featureStyle(colour),
      pointToLayer: (_geoFeature, latlng) => L.circleMarker(latlng, { radius: 7, color: colour, fillColor: "#fff", fillOpacity: 1, weight: 3 })
    });
    layer.bindTooltip(escapeMapText(label || feature.name || "Reference feature"));
    layer.addTo(group);
  } catch (error) {
    console.warn("Reference geometry could not be drawn", error);
  }
}

function drawConstraintOverlays(L, group, constraints, spatialFeatures = [], displayMode = DEDUCTION_MAP_MODES.OVERVIEW) {
  const endgameMode = displayMode === DEDUCTION_MAP_MODES.ENDGAME;
  for (const constraint of constraints || []) {
    const overlay = constraintOverlay(constraint, { spatialFeatures });
    if (!overlay) continue;
    const answer = String(overlay.answer || "").toLowerCase();
    const isNo = ["no", "colder", "further", "outside", "exclude"].includes(answer);
    const contextOnly = endgameMode && constraint.movementMode !== "locked";
    const color = contextOnly ? "#718096" : isNo ? "#b54708" : "#3269bb";
    const opacity = contextOnly ? 0.42 : 0.88;
    const fillOpacity = contextOnly ? 0.012 : 0.035;
    const weight = contextOnly ? 1.5 : 2;
    const tooltip = contextOnly ? `Earlier clue: ${overlay.label || "map answer"}` : overlay.label;
    if (overlay.type === "circle" && overlay.centre && Number.isFinite(overlay.radiusMetres)) {
      L.circle([overlay.centre.lat, overlay.centre.lng], { radius: overlay.radiusMetres, color, weight, opacity, dashArray: contextOnly ? "4 7" : "7 6", fillColor: color, fillOpacity, interactive: false })
        .bindTooltip(escapeMapText(tooltip))
        .addTo(group);
      L.circleMarker([overlay.centre.lat, overlay.centre.lng], { radius: contextOnly ? 4 : 5, color, opacity, fillColor: "#fff", fillOpacity: contextOnly ? 0.7 : 1, weight, interactive: false }).addTo(group);
    }
    if (overlay.type === "line" && overlay.start && overlay.end) {
      L.polyline([[overlay.start.lat, overlay.start.lng], [overlay.end.lat, overlay.end.lng]], { color, weight: contextOnly ? 2 : 4, opacity, dashArray: contextOnly ? "4 7" : "8 6", interactive: false })
        .bindTooltip(escapeMapText(tooltip))
        .addTo(group);
      L.circleMarker([overlay.start.lat, overlay.start.lng], { radius: contextOnly ? 4 : 6, color, opacity, fillColor: "#fff", fillOpacity: contextOnly ? 0.7 : 1, weight, interactive: false }).bindTooltip(contextOnly ? "Earlier thermometer start" : "Thermometer start").addTo(group);
      L.circleMarker([overlay.end.lat, overlay.end.lng], { radius: contextOnly ? 4 : 6, color, opacity, fillColor: color, fillOpacity: contextOnly ? 0.5 : 1, weight, interactive: false }).bindTooltip(contextOnly ? "Earlier thermometer end" : "Thermometer end").addTo(group);
    }
    if (overlay.type === "distance" && overlay.seeker && overlay.target && Number.isFinite(overlay.radiusMetres)) {
      L.circle([overlay.target.lat, overlay.target.lng], { radius: overlay.radiusMetres, color, weight, opacity, dashArray: contextOnly ? "4 7" : "5 5", fillOpacity: contextOnly ? 0.008 : 0.025, interactive: false })
        .bindTooltip(escapeMapText(tooltip))
        .addTo(group);
      L.polyline([[overlay.seeker.lat, overlay.seeker.lng], [overlay.target.lat, overlay.target.lng]], { color, weight: contextOnly ? 1.5 : 3, opacity, dashArray: contextOnly ? "4 7" : "6 5", interactive: false }).addTo(group);
      L.circleMarker([overlay.target.lat, overlay.target.lng], { radius: contextOnly ? 4 : 6, color, opacity, fillColor: color, fillOpacity: contextOnly ? 0.5 : 1, weight, interactive: false }).bindTooltip(contextOnly ? "Earlier reference point" : "Reference point").addTo(group);
    }
    if (overlay.type === "thames" && Array.isArray(overlay.line)) {
      // The interactive basemap contains the real water polygon. The remapped
      // centreline is used for deduction calculations only; drawing it on top
      // would make the river appear to cross land at high zoom levels.
      continue;
    }
    if (overlay.type === "polygon" && Array.isArray(overlay.points)) {
      L.polygon(overlay.points.map((point) => [point.lat, point.lng]), { color, weight: contextOnly ? 1.5 : 3, opacity, fillColor: color, fillOpacity: contextOnly ? 0.02 : 0.08, dashArray: contextOnly ? "4 7" : "7 5", interactive: false })
        .bindTooltip(escapeMapText(tooltip))
        .addTo(group);
    }
    if (overlay.type === "reference") {
      if (overlay.seeker) {
        L.circleMarker([overlay.seeker.lat, overlay.seeker.lng], { radius: contextOnly ? 4 : 7, color, opacity, fillColor: "#fff", fillOpacity: contextOnly ? 0.7 : 1, weight, interactive: false })
          .bindTooltip(contextOnly ? "Earlier seeker reference pin" : "Seeker reference pin")
          .addTo(group);
      }
      if (constraint.type === "tentacle" && overlay.seeker) {
        L.circle([overlay.seeker.lat, overlay.seeker.lng], { radius: Number(constraint.radiusMetres) || 2000, color, weight, opacity, dashArray: contextOnly ? "4 7" : "8 7", fillOpacity: contextOnly ? 0.008 : 0.02, interactive: false })
          .bindTooltip(contextOnly ? "Earlier Tentacle search area" : "Valid Tentacle POIs: within 2 km of the seeker pin")
          .addTo(group);
      }
      drawReferenceFeature(L, group, overlay.referenceFeature, color, contextOnly ? `Earlier clue: ${overlay.referenceFeature?.name || overlay.label}` : overlay.referenceFeature?.name || overlay.label);
    }
  }
}

function constraintSetForMode({ displayMode, constraints, activeConstraint, answerConstraints = [] }) {
  if (displayMode === DEDUCTION_MAP_MODES.ANSWER) return answerConstraints.length ? answerConstraints : activeConstraint ? [activeConstraint] : [];
  // The Endgame map carries every earlier clue forward. Mobile snapshots are
  // styled as historical evidence while station-level and locked answers form
  // the current hard mask.
  if (displayMode === DEDUCTION_MAP_MODES.ENDGAME) return constraints || [];
  return constraints || [];
}

function maskTargets({ displayMode, results, showEliminated, maskScope, selectedStationId, endgameStation }) {
  if (displayMode === DEDUCTION_MAP_MODES.ENDGAME) return endgameStation ? [endgameStation] : [];
  const visible = (results || []).filter((result) => showEliminated || result.status !== DEDUCTION_STATUS.ELIMINATED);
  if (maskScope !== "selected") return visible;
  const selected = visible.find((result) => result.id === selectedStationId)
    || visible.find((result) => result.status === DEDUCTION_STATUS.PARTIAL)
    || visible.find((result) => result.possible)
    || visible[0];
  return selected ? [selected] : [];
}

function buildAreaMaskPlans({
  displayMode,
  results,
  constraints,
  activeConstraint,
  answerConstraints = [],
  answerSelectionAll = false,
  endgameStation,
  showEliminated,
  showAreaMask,
  maskScope,
  selectedStationId,
  spatialFeatures
}) {
  if (!showAreaMask || displayMode === DEDUCTION_MAP_MODES.OVERVIEW) return [];
  const displayedAnswerConstraints = answerConstraints.length
    ? answerConstraints
    : activeConstraint
      ? [activeConstraint]
      : [];
  if (displayMode === DEDUCTION_MAP_MODES.ANSWER && !displayedAnswerConstraints.length) return [];
  const targets = maskTargets({ displayMode, results, showEliminated, maskScope, selectedStationId, endgameStation });

  if (displayMode === DEDUCTION_MAP_MODES.ENDGAME) {
    const station = targets[0];
    if (!station) return [];
    const currentMask = evaluateZoneAreaMask({
      station,
      constraints,
      mode: "endgame",
      spatialFeatures,
      radiusMetres: 500,
      cellSizeMetres: 22
    });
    const historyMask = evaluateZoneAreaMask({
      station,
      constraints,
      mode: "history",
      spatialFeatures,
      radiusMetres: 500,
      cellSizeMetres: 22
    });
    const plans = [];
    if (historyMask.constraintCount) {
      plans.push({
        station,
        mask: historyMask,
        radiusMetres: 500,
        selected: false,
        cellSizeMetres: 22,
        layerKind: "history",
        drawOutline: false,
        hardMask: currentMask
      });
    }
    plans.push({
      station,
      mask: currentMask,
      radiusMetres: 500,
      selected: true,
      cellSizeMetres: 22,
      layerKind: "current",
      drawOutline: true
    });
    return plans;
  }

  return targets.map((station) => {
    const selected = station.id === selectedStationId;
    const cellSizeMetres = maskScope === "selected" || selected
      ? 38
      : answerSelectionAll
        ? 100
        : 92;
    const maskMode = answerSelectionAll || displayedAnswerConstraints.length > 1
      ? "overlay"
      : "constraint";
    const mask = evaluateZoneAreaMask({
      station,
      constraints: displayedAnswerConstraints,
      mode: maskMode,
      activeConstraintId: activeConstraint?.id || null,
      spatialFeatures,
      radiusMetres: 500,
      cellSizeMetres
    });
    return { station, mask, radiusMetres: 500, selected, cellSizeMetres, layerKind: "current", drawOutline: true };
  });
}

function attachAreaMaskCanvas(map, plans) {
  if (!plans?.length) return null;
  const container = map.getContainer();
  const canvas = document.createElement("canvas");
  canvas.className = "leaflet-area-mask-canvas";
  canvas.setAttribute("aria-hidden", "true");
  container.append(canvas);
  const context = canvas.getContext("2d");
  let frame = 0;

  const traceCell = (points) => {
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.closePath();
  };

  const drawCell = (cell, plan, cellIndex) => {
    if (plan.layerKind === "history" && (cell.state !== "excluded" || plan.hardMask?.cells?.[cellIndex]?.state === "excluded")) return;
    const points = cell.corners.map((corner) => map.latLngToContainerPoint([corner.lat, corner.lng]));
    if (plan.layerKind === "history") {
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      context.save();
      traceCell(points);
      context.clip();
      context.fillStyle = HISTORY_MASK.fill;
      context.fillRect(minX, minY, maxX - minX, maxY - minY);
      context.strokeStyle = HISTORY_MASK.hatch;
      context.lineWidth = 1.15;
      for (let x = minX - (maxY - minY); x <= maxX + (maxY - minY); x += 7) {
        context.beginPath();
        context.moveTo(x, maxY);
        context.lineTo(x + (maxY - minY), minY);
        context.stroke();
      }
      context.restore();
      traceCell(points);
      context.strokeStyle = HISTORY_MASK.stroke;
      context.lineWidth = 0.55;
      context.stroke();
      return;
    }
    const palette = maskCellPalette(cell);
    traceCell(points);
    context.fillStyle = palette.fill;
    context.fill();
    context.strokeStyle = palette.stroke;
    context.lineWidth = 0.7;
    context.stroke();
  };

  const redraw = () => {
    frame = 0;
    if (!map._loaded || !canvas.isConnected) return;
    const size = map.getSize();
    const ratio = Math.max(1, Math.min(1.5, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(size.x * ratio));
    canvas.height = Math.max(1, Math.round(size.y * ratio));
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.x, size.y);

    for (const plan of plans) {
      const station = plan.station;
      const centre = map.latLngToContainerPoint([Number(station.lat), Number(station.lng)]);
      const north = map.latLngToContainerPoint([Number(station.lat) + plan.radiusMetres / 111320, Number(station.lng)]);
      const radius = Math.abs(centre.y - north.y);
      if (centre.x + radius < 0 || centre.y + radius < 0 || centre.x - radius > size.x || centre.y - radius > size.y) continue;
      context.save();
      context.beginPath();
      context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
      context.clip();
      plan.mask.cells.forEach((cell, cellIndex) => drawCell(cell, plan, cellIndex));
      context.restore();
      if (plan.drawOutline !== false) {
        context.beginPath();
        context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
        context.strokeStyle = plan.selected ? "rgba(11,31,51,.92)" : "rgba(53,67,82,.52)";
        context.lineWidth = plan.selected ? 3.5 : 1.2;
        context.stroke();
      }
    }
  };

  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(() => {
      redraw();
      canvas.classList.remove("is-map-moving");
    });
  };
  const hideDuringMotion = () => {
    canvas.classList.add("is-map-moving");
  };
  const finishMotion = () => schedule();
  // Drawing thousands of mask cells on every pan frame made touch dragging
  // sluggish. Hide the custom mask while the map is moving and redraw once at
  // the final viewport instead. Leaflet's native markers and tiles remain fluid.
  map.on("movestart zoomstart", hideDuringMotion);
  map.on("moveend zoomend resize", finishMotion);
  redraw();
  return {
    canvas,
    redraw: schedule,
    remove() {
      if (frame) window.cancelAnimationFrame(frame);
      map.off("movestart zoomstart", hideDuringMotion);
      map.off("moveend zoomend resize", finishMotion);
      canvas.remove();
    }
  };
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

function vectorProjectionForMode({ displayMode, maskScope, selectedStation, endgameStation } = {}) {
  const target = displayMode === DEDUCTION_MAP_MODES.ENDGAME
    ? endgameStation
    : displayMode === DEDUCTION_MAP_MODES.ANSWER && maskScope === "selected"
      ? selectedStation
      : null;
  const lat = Number(target?.lat);
  const lng = Number(target?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return VECTOR_MAP;
  const verticalHalfMetres = displayMode === DEDUCTION_MAP_MODES.ENDGAME ? 720 : 900;
  const drawableAspect = (VECTOR_MAP.width - VECTOR_MAP.pad * 2) / (VECTOR_MAP.height - VECTOR_MAP.pad * 2);
  const horizontalHalfMetres = verticalHalfMetres * drawableAspect;
  const metresPerDegreeLat = 111_320;
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((lat * Math.PI) / 180);
  return {
    ...VECTOR_MAP,
    west: lng - horizontalHalfMetres / metresPerDegreeLng,
    east: lng + horizontalHalfMetres / metresPerDegreeLng,
    south: lat - verticalHalfMetres / metresPerDegreeLat,
    north: lat + verticalHalfMetres / metresPerDegreeLat
  };
}

function vectorPoint(point, projection = VECTOR_MAP) {
  const x = projection.pad + ((Number(point.lng) - projection.west) / (projection.east - projection.west)) * (projection.width - projection.pad * 2);
  const y = projection.pad + ((projection.north - Number(point.lat)) / (projection.north - projection.south)) * (projection.height - projection.pad * 2);
  return { x, y };
}

function vectorEllipse(point, radiusMetres, projection = VECTOR_MAP) {
  const metresPerLat = 111320;
  const metresPerLng = metresPerLat * Math.cos((Number(point.lat) * Math.PI) / 180);
  return {
    rx: ((Number(radiusMetres) / metresPerLng) / (projection.east - projection.west)) * (projection.width - projection.pad * 2),
    ry: ((Number(radiusMetres) / metresPerLat) / (projection.north - projection.south)) * (projection.height - projection.pad * 2)
  };
}

function vectorPoints(points, projection = VECTOR_MAP) {
  return points.map((point) => {
    const projected = vectorPoint(point, projection);
    return `${projected.x.toFixed(1)},${projected.y.toFixed(1)}`;
  }).join(" ");
}

function geoCoordinatesToPoints(coordinates = []) {
  return coordinates.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));
}

function vectorFeatureSvg(feature, colour, projection = VECTOR_MAP) {
  const geometry = feature?.geometry;
  if (!geometry) return "";
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates || [];
    const point = vectorPoint({ lat, lng }, projection);
    return `<circle cx="${point.x}" cy="${point.y}" r="8" fill="#fff" stroke="${colour}" stroke-width="3"><title>${escapeMapText(feature.name)}</title></circle>`;
  }
  if (geometry.type === "LineString") return `<polyline points="${vectorPoints(geoCoordinatesToPoints(geometry.coordinates), projection)}" fill="none" stroke="${colour}" stroke-width="4" stroke-dasharray="7 5"><title>${escapeMapText(feature.name)}</title></polyline>`;
  if (geometry.type === "MultiLineString") return (geometry.coordinates || []).map((line) => `<polyline points="${vectorPoints(geoCoordinatesToPoints(line), projection)}" fill="none" stroke="${colour}" stroke-width="4" stroke-dasharray="7 5"><title>${escapeMapText(feature.name)}</title></polyline>`).join("");
  if (geometry.type === "Polygon") return `<polygon points="${vectorPoints(geoCoordinatesToPoints(geometry.coordinates?.[0] || []), projection)}" fill="${colour}" fill-opacity=".10" stroke="${colour}" stroke-width="3" stroke-dasharray="7 5"><title>${escapeMapText(feature.name)}</title></polygon>`;
  if (geometry.type === "MultiPolygon") return (geometry.coordinates || []).map((polygon) => `<polygon points="${vectorPoints(geoCoordinatesToPoints(polygon?.[0] || []), projection)}" fill="${colour}" fill-opacity=".10" stroke="${colour}" stroke-width="3" stroke-dasharray="7 5"><title>${escapeMapText(feature.name)}</title></polygon>`).join("");
  return "";
}

function vectorConstraintSvg(constraints, spatialFeatures = [], projection = VECTOR_MAP, displayMode = DEDUCTION_MAP_MODES.OVERVIEW) {
  return (constraints || []).map((constraint) => {
    const overlay = constraintOverlay(constraint, { spatialFeatures });
    if (!overlay) return "";
    const historical = displayMode === DEDUCTION_MAP_MODES.ENDGAME && constraint.movementMode !== "locked";
    const answer = String(overlay.answer || "").toLowerCase();
    const negative = ["no", "colder", "further", "outside", "exclude"].includes(answer);
    const colour = historical ? "#6688b8" : negative ? "#b54708" : "#3269bb";
    const opacity = historical ? ".38" : "1";
    const wrap = (body) => `<g opacity="${opacity}">${body}</g>`;
    if (overlay.type === "circle" && overlay.centre && Number.isFinite(overlay.radiusMetres)) {
      const centre = vectorPoint(overlay.centre, projection);
      const radius = vectorEllipse(overlay.centre, overlay.radiusMetres, projection);
      return wrap(`<ellipse cx="${centre.x}" cy="${centre.y}" rx="${radius.rx}" ry="${radius.ry}" fill="${colour}" fill-opacity=".035" stroke="${colour}" stroke-width="${historical ? 1.5 : 2.5}" stroke-dasharray="${historical ? "4 8" : "8 7"}"><title>${escapeMapText(historical ? `Earlier clue: ${overlay.label}` : overlay.label)}</title></ellipse><circle cx="${centre.x}" cy="${centre.y}" r="${historical ? 4 : 5}" fill="#fff" stroke="${colour}" stroke-width="2.5" />`);
    }
    if (overlay.type === "line" && overlay.start && overlay.end) {
      const start = vectorPoint(overlay.start, projection);
      const end = vectorPoint(overlay.end, projection);
      return wrap(`<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${colour}" stroke-width="${historical ? 2.5 : 4}" stroke-dasharray="${historical ? "5 8" : "10 7"}"><title>${escapeMapText(historical ? `Earlier clue: ${overlay.label}` : overlay.label)}</title></line><circle cx="${start.x}" cy="${start.y}" r="${historical ? 4 : 6}" fill="#fff" stroke="${colour}" stroke-width="3" /><circle cx="${end.x}" cy="${end.y}" r="${historical ? 4 : 6}" fill="${colour}" stroke="#fff" stroke-width="2" />`);
    }
    if (overlay.type === "distance" && overlay.seeker && overlay.target && Number.isFinite(overlay.radiusMetres)) {
      const seeker = vectorPoint(overlay.seeker, projection);
      const target = vectorPoint(overlay.target, projection);
      const radius = vectorEllipse(overlay.target, overlay.radiusMetres, projection);
      return wrap(`<ellipse cx="${target.x}" cy="${target.y}" rx="${radius.rx}" ry="${radius.ry}" fill="${colour}" fill-opacity=".025" stroke="${colour}" stroke-width="${historical ? 1.5 : 2}" stroke-dasharray="${historical ? "4 8" : "7 6"}"><title>${escapeMapText(historical ? `Earlier clue: ${overlay.label}` : overlay.label)}</title></ellipse><line x1="${seeker.x}" y1="${seeker.y}" x2="${target.x}" y2="${target.y}" stroke="${colour}" stroke-width="${historical ? 2 : 3}" stroke-dasharray="${historical ? "4 8" : "7 6"}" /><circle cx="${target.x}" cy="${target.y}" r="${historical ? 4 : 6}" fill="${colour}" stroke="#fff" stroke-width="2" />`);
    }
    if (overlay.type === "thames" && Array.isArray(overlay.line)) return wrap(`<polyline points="${vectorPoints(overlay.line, projection)}" fill="none" stroke="#2176ae" stroke-width="3.2" stroke-opacity=".78"><title>Detailed River Thames planning guide</title></polyline>`);
    if (overlay.type === "polygon" && Array.isArray(overlay.points)) return wrap(`<polygon points="${vectorPoints(overlay.points, projection)}" fill="${colour}" fill-opacity=".08" stroke="${colour}" stroke-width="${historical ? 2 : 3}" stroke-dasharray="${historical ? "4 8" : "7 5"}"><title>${escapeMapText(historical ? `Earlier clue: ${overlay.label}` : overlay.label)}</title></polygon>`);
    if (overlay.type === "reference") {
      const seeker = overlay.seeker ? vectorPoint(overlay.seeker, projection) : null;
      const tentacleRadius = constraint.type === "tentacle" && overlay.seeker ? vectorEllipse(overlay.seeker, Number(constraint.radiusMetres) || 2000, projection) : null;
      return wrap(`${tentacleRadius ? `<ellipse cx="${seeker.x}" cy="${seeker.y}" rx="${tentacleRadius.rx}" ry="${tentacleRadius.ry}" fill="${colour}" fill-opacity=".02" stroke="${colour}" stroke-width="${historical ? 1.5 : 2}" stroke-dasharray="${historical ? "4 8" : "8 7"}" />` : ""}${seeker ? `<circle cx="${seeker.x}" cy="${seeker.y}" r="${historical ? 5 : 7}" fill="#fff" stroke="${colour}" stroke-width="3" />` : ""}${vectorFeatureSvg(overlay.referenceFeature, colour, projection)}`);
    }
    return "";
  }).join("");
}

function vectorAreaMaskSvg(plans, projection = VECTOR_MAP) {
  if (!plans.length) return { defs: "", body: "" };
  const historyPattern = `<pattern id="history-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(0)"><rect width="8" height="8" fill="#3269bb" fill-opacity=".10" /><path d="M-2 8 L8 -2 M2 10 L10 2" stroke="#265191" stroke-opacity=".48" stroke-width="1.2" /></pattern>`;
  const clips = plans.map((plan, index) => {
    const centre = vectorPoint(plan.station, projection);
    const radius = vectorEllipse(plan.station, plan.radiusMetres, projection);
    return `<clipPath id="zone-mask-${index}"><ellipse cx="${centre.x}" cy="${centre.y}" rx="${radius.rx}" ry="${radius.ry}" /></clipPath>`;
  }).join("");
  const body = plans.map((plan, index) => {
    const cells = plan.mask.cells.map((cell, cellIndex) => {
      if (plan.layerKind === "history") {
        if (cell.state !== "excluded" || plan.hardMask?.cells?.[cellIndex]?.state === "excluded") return "";
        return `<polygon class="mask-cell-history" points="${vectorPoints(cell.corners, projection)}" fill="url(#history-hatch)" stroke="#265191" stroke-opacity=".34" stroke-width=".6" />`;
      }
      const fill = cell.state === "excluded" ? "#4e5865" : cell.state === "allowed" ? "#1e9d7e" : "#e4a11b";
      const opacity = cell.state === "excluded" ? excludedCellOpacity(cell).toFixed(3) : ".30";
      return `<polygon class="mask-cell-${cell.state}" points="${vectorPoints(cell.corners, projection)}" fill="${fill}" fill-opacity="${opacity}" stroke="${fill}" stroke-opacity=".17" stroke-width=".7" />`;
    }).join("");
    const centre = vectorPoint(plan.station, projection);
    const radius = vectorEllipse(plan.station, plan.radiusMetres, projection);
    const outline = plan.drawOutline === false
      ? ""
      : `<ellipse cx="${centre.x}" cy="${centre.y}" rx="${radius.rx}" ry="${radius.ry}" fill="none" stroke="${plan.selected ? "#0b1f33" : "#536273"}" stroke-width="${plan.selected ? 4 : 1.5}" stroke-opacity=".85" />`;
    return `<g clip-path="url(#zone-mask-${index})">${cells}</g>${outline}`;
  }).join("");
  return { defs: `${historyPattern}${clips}`, body };
}

function renderDeductionVectorMap({
  container,
  results = [],
  constraints = [],
  showEliminated = true,
  showZones = false,
  showAreaMask = true,
  displayMode = DEDUCTION_MAP_MODES.OVERVIEW,
  maskScope = "all",
  activeConstraint = null,
  answerConstraints = [],
  answerSelectionAll = false,
  endgameStation = null,
  spatialFeatures = [],
  selectedStationId = null,
  message = ""
} = {}) {
  if (!container) return null;
  const sourceResults = displayMode === DEDUCTION_MAP_MODES.ENDGAME
    ? (endgameStation ? [endgameStation] : [])
    : results;
  const visible = sourceResults.filter((result) => showEliminated || result.status !== DEDUCTION_STATUS.ELIMINATED);
  const boundary = APPROXIMATE_GAME_BOUNDARY.map(([lng, lat]) => ({ lat, lng }));
  const selectedStation = results.find((result) => result.id === selectedStationId)
    || (displayMode === DEDUCTION_MAP_MODES.ENDGAME ? endgameStation : null);
  const projection = vectorProjectionForMode({ displayMode, maskScope, selectedStation, endgameStation });
  const plans = buildAreaMaskPlans({ displayMode, results, constraints, activeConstraint, answerConstraints, answerSelectionAll, endgameStation, showEliminated, showAreaMask, maskScope, selectedStationId, spatialFeatures });
  const maskSvg = vectorAreaMaskSvg(plans, projection);
  const zoneSvg = visible.map((result) => {
    const selected = result.id === selectedStationId || (displayMode === DEDUCTION_MAP_MODES.ENDGAME && result.id === endgameStation?.id);
    if (displayMode === DEDUCTION_MAP_MODES.OVERVIEW && !showZones && !selected) return "";
    if (displayMode === DEDUCTION_MAP_MODES.ANSWER && maskScope === "selected" && !selected) return "";
    const centre = vectorPoint(result, projection);
    const radius = vectorEllipse(result, 500, projection);
    const palette = STATUS_COLOURS[result.status] || STATUS_COLOURS[DEDUCTION_STATUS.POSSIBLE];
    const fillOpacity = displayMode === DEDUCTION_MAP_MODES.OVERVIEW ? (selected ? ".16" : result.status === DEDUCTION_STATUS.ELIMINATED ? ".015" : ".05") : ".015";
    return `<ellipse cx="${centre.x}" cy="${centre.y}" rx="${radius.rx}" ry="${radius.ry}" fill="${palette.fill}" fill-opacity="${fillOpacity}" stroke="${palette.stroke}" stroke-width="${selected ? 4 : 1.4}" stroke-opacity="${result.status === DEDUCTION_STATUS.ELIMINATED ? ".45" : ".82"}" />`;
  }).join("");
  const markerSvg = visible.map((result) => {
    const centre = vectorPoint(result, projection);
    const palette = STATUS_COLOURS[result.status] || STATUS_COLOURS[DEDUCTION_STATUS.POSSIBLE];
    const selected = result.id === selectedStationId || (displayMode === DEDUCTION_MAP_MODES.ENDGAME && result.id === endgameStation?.id);
    const radius = selected ? 9 : result.status === DEDUCTION_STATUS.PRIORITY ? 7.5 : 5.5;
    return `<g class="vector-station" data-station-id="${escapeMapText(result.id)}"><circle cx="${centre.x}" cy="${centre.y}" r="${radius}" fill="${palette.fill}" fill-opacity="${result.status === DEDUCTION_STATUS.ELIMINATED ? ".58" : ".98"}" stroke="${selected ? "#0b1f33" : palette.stroke}" stroke-width="${selected ? 4 : 2}"><title>${escapeMapText(result.name)} - ${escapeMapText(statusDescription(result))}</title></circle>${selected ? `<text x="${centre.x + 13}" y="${centre.y - 10}" class="vector-station-label">${escapeMapText(result.name)}</text>` : ""}</g>`;
  }).join("");
  const modeConstraints = constraintSetForMode({ displayMode, constraints, activeConstraint, answerConstraints });
  const thames = vectorPoints(THAMES_CENTRELINE, projection);
  const showPlanningContext = displayMode !== DEDUCTION_MAP_MODES.ENDGAME;
  container.innerHTML = `
    <div class="deduction-vector-wrap">
      <svg class="deduction-vector-map" viewBox="0 0 ${VECTOR_MAP.width} ${VECTOR_MAP.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Offline vector deduction map of central London stations">
        <defs>
          <pattern id="vector-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M 44 0 L 0 0 0 44" fill="none" stroke="#9fb4c1" stroke-width="1" stroke-opacity=".18" /></pattern>
          ${maskSvg.defs}
        </defs>
        <rect width="${VECTOR_MAP.width}" height="${VECTOR_MAP.height}" rx="22" fill="#edf4f7" />
        <rect x="18" y="18" width="${VECTOR_MAP.width - 36}" height="${VECTOR_MAP.height - 36}" rx="18" fill="url(#vector-grid)" />
        ${showPlanningContext ? `<polygon points="${vectorPoints(boundary, projection)}" fill="#f26a3d" fill-opacity=".035" stroke="#e9572e" stroke-width="2.5" stroke-dasharray="10 8"><title>Approximate planning boundary</title></polygon>` : ""}
        ${showPlanningContext ? `<polyline points="${thames}" fill="none" stroke="#8bc7e3" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".38"><title>River Thames planning guide</title></polyline><polyline points="${thames}" fill="none" stroke="#2176ae" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".78" />` : ""}
        ${zoneSvg}
        ${vectorConstraintSvg(modeConstraints, spatialFeatures, projection, displayMode)}
        ${maskSvg.body}
        ${markerSvg}
        <g class="vector-north" transform="translate(${VECTOR_MAP.width - 72} 62)"><path d="M0 23 L12 -8 L24 23 L12 16 Z" fill="#0b1f33" /><text x="12" y="39" text-anchor="middle">N</text></g>
      </svg>
      <div class="vector-map-badge" title="${escapeMapText(message || "Interactive basemap unavailable")}"><strong>Built-in vector map</strong><span>Detailed allowed and excluded cells remain available without map tiles.</span></div>
    </div>`;
  const svg = container.querySelector("svg");
  svg?.addEventListener("click", (event) => {
    if (!deductionPick?.callback) return;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / projection.width, rect.height / projection.height);
    const renderedWidth = projection.width * scale;
    const renderedHeight = projection.height * scale;
    const offsetX = (rect.width - renderedWidth) / 2;
    const offsetY = (rect.height - renderedHeight) / 2;
    const x = Math.max(projection.pad, Math.min(projection.width - projection.pad, (event.clientX - rect.left - offsetX) / scale));
    const y = Math.max(projection.pad, Math.min(projection.height - projection.pad, (event.clientY - rect.top - offsetY) / scale));
    const lng = projection.west + ((x - projection.pad) / (projection.width - projection.pad * 2)) * (projection.east - projection.west);
    const lat = projection.north - ((y - projection.pad) / (projection.height - projection.pad * 2)) * (projection.north - projection.south);
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
  showAreaMask = true,
  displayMode = DEDUCTION_MAP_MODES.OVERVIEW,
  maskScope = "all",
  activeConstraint = null,
  answerConstraints = [],
  answerSelectionAll = false,
  endgameStation = null,
  spatialFeatures = [],
  selectedStationId = null,
  onStationAction,
  onReady
} = {}) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const viewportKey = [displayMode, endgameStation?.id || "all", maskScope, selectedStationId || "none"].join(":");
  destroyDeductionMap();
  const preservedViewport = deductionViewportCache?.key === viewportKey ? deductionViewportCache : null;
  let L;
  try {
    L = await loadLeaflet();
  } catch (error) {
    return renderDeductionVectorMap({ container, results, constraints, showEliminated, showZones, showAreaMask, displayMode, maskScope, activeConstraint, answerConstraints, answerSelectionAll, endgameStation, spatialFeatures, selectedStationId, message: error.message });
  }

  const endgameMode = displayMode === DEDUCTION_MAP_MODES.ENDGAME;
  deductionMapInstance = L.map(container, { zoomControl: true, attributionControl: true, preferCanvas: true }).setView([LONDON_MAP_CENTRE.lat, LONDON_MAP_CENTRE.lng], LONDON_MAP_CENTRE.zoom);
  addBaseMap(L, deductionMapInstance, { showBoundary: !endgameMode });
  deductionLayerGroups = {
    overlays: L.layerGroup().addTo(deductionMapInstance),
    zones: L.layerGroup().addTo(deductionMapInstance),
    markers: L.layerGroup().addTo(deductionMapInstance)
  };

  const modeConstraints = constraintSetForMode({ displayMode, constraints, activeConstraint, answerConstraints });
  drawConstraintOverlays(L, deductionLayerGroups.overlays, modeConstraints, spatialFeatures, displayMode);

  const sourceResults = endgameMode ? (endgameStation ? [endgameStation] : []) : results;
  const visible = sourceResults.filter((result) => showEliminated || result.status !== DEDUCTION_STATUS.ELIMINATED);
  const bounds = [];
  for (const result of visible) {
    if (!Number.isFinite(Number(result.lat)) || !Number.isFinite(Number(result.lng))) continue;
    const centre = [Number(result.lat), Number(result.lng)];
    const palette = STATUS_COLOURS[result.status] || STATUS_COLOURS[DEDUCTION_STATUS.POSSIBLE];
    const selected = result.id === selectedStationId || (endgameMode && result.id === endgameStation?.id);
    const showCircle = endgameMode
      || (displayMode === DEDUCTION_MAP_MODES.ANSWER ? maskScope !== "selected" || selected : showZones || selected);
    if (showCircle) {
      L.circle(centre, {
        radius: 500,
        color: selected ? "#0b1f33" : palette.stroke,
        fillColor: palette.fill,
        fillOpacity: displayMode === DEDUCTION_MAP_MODES.OVERVIEW ? (result.status === DEDUCTION_STATUS.ELIMINATED ? 0.015 : selected ? 0.14 : 0.045) : 0.018,
        opacity: result.status === DEDUCTION_STATUS.ELIMINATED ? 0.45 : 0.86,
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

  const plans = buildAreaMaskPlans({ displayMode, results, constraints, activeConstraint, answerConstraints, answerSelectionAll, endgameStation, showEliminated, showAreaMask, maskScope, selectedStationId, spatialFeatures });
  deductionMaskLayer = attachAreaMaskCanvas(deductionMapInstance, plans);

  deductionMapInstance.on("click", (event) => {
    if (!deductionPick?.callback) return;
    const callback = deductionPick.callback;
    const prefix = deductionPick.prefix;
    deductionPick = null;
    container.classList.remove("map-pick-active");
    callback({ lat: event.latlng.lat, lng: event.latlng.lng, prefix });
  });
  if (deductionPick) container.classList.add("map-pick-active");

  const selected = endgameMode
    ? endgameStation
    : results.find((result) => result.id === selectedStationId);
  if (preservedViewport?.centre && Number.isFinite(preservedViewport.zoom)) {
    deductionMapInstance.setView(preservedViewport.centre, preservedViewport.zoom, { animate: false });
  } else if (selected) deductionMapInstance.setView([Number(selected.lat), Number(selected.lng)], endgameMode ? 16 : maskScope === "selected" && displayMode === DEDUCTION_MAP_MODES.ANSWER ? 16 : 15, { animate: false });
  else if (bounds.length) deductionMapInstance.fitBounds(bounds, { padding: [28, 28], maxZoom: endgameMode ? 16 : 13, animate: false });
  activeDeductionViewportKey = viewportKey;
  setTimeout(() => {
    deductionMapInstance?.invalidateSize();
    deductionMaskLayer?.redraw?.();
  }, 80);
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
  deductionMapInstance.setView([Number(station.lat), Number(station.lng)], 16, { animate: true });
  deductionMaskLayer?.redraw?.();
}

export function destroyDeductionMap() {
  if (deductionMapInstance && activeDeductionViewportKey) {
    try {
      const centre = deductionMapInstance.getCenter();
      deductionViewportCache = { key: activeDeductionViewportKey, centre: [centre.lat, centre.lng], zoom: deductionMapInstance.getZoom() };
    } catch {
      // The map container may already have been replaced during an app render.
    }
  }
  deductionMaskLayer?.remove?.();
  deductionMaskLayer = null;
  deductionMapInstance?.remove();
  deductionMapInstance = null;
  deductionLayerGroups = null;
  activeDeductionViewportKey = null;
}

function escapeMapText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}
