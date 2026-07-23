import { APPROXIMATE_GAME_BOUNDARY, LONDON_MAP_CENTRE } from "../data/boundary.js";
import { LEAFLET_CSS_URL, LEAFLET_JS_URL } from "../core/constants.js";

let loadPromise;
let mapInstance;
let layerGroup;

export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      link.crossOrigin = "anonymous";
      document.head.append(link);
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS_URL;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("The interactive map library could not be loaded. Use the authoritative Google map instead."));
    document.head.append(script);
  });
  return loadPromise;
}

export async function renderZoneMap({ containerId = "zone-map", station, positions = [], radiusMetres = 500, onReady } = {}) {
  const L = await loadLeaflet();
  const container = document.getElementById(containerId);
  if (!container) return null;
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  mapInstance = L.map(container, { zoomControl: true, attributionControl: true }).setView([LONDON_MAP_CENTRE.lat, LONDON_MAP_CENTRE.lng], LONDON_MAP_CENTRE.zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapInstance);
  L.polygon(APPROXIMATE_GAME_BOUNDARY.map(([lng, lat]) => [lat, lng]), {
    color: "#e9572e",
    weight: 2,
    opacity: 0.9,
    fillColor: "#f26a3d",
    fillOpacity: 0.06,
    dashArray: "8 7"
  }).bindTooltip("Approximate planning boundary - check the authoritative Google layer").addTo(mapInstance);
  layerGroup = L.layerGroup().addTo(mapInstance);
  updateZoneMap({ station, positions, radiusMetres });
  setTimeout(() => mapInstance?.invalidateSize(), 60);
  onReady?.(mapInstance);
  return mapInstance;
}

export function updateZoneMap({ station, positions = [], radiusMetres = 500 } = {}) {
  if (!mapInstance || !layerGroup || !window.L) return;
  const L = window.L;
  layerGroup.clearLayers();
  const bounds = [];
  if (station?.lat != null && station?.lng != null) {
    const centre = [Number(station.lat), Number(station.lng)];
    L.circle(centre, { radius: radiusMetres, color: "#1e9b80", fillColor: "#34bea1", fillOpacity: 0.12, weight: 3 }).addTo(layerGroup);
    L.circleMarker(centre, { radius: 8, color: "#0b1f33", fillColor: "#f26a3d", fillOpacity: 1, weight: 3 })
      .bindPopup(`<strong>${escapeMapText(station.name || "Hiding station")}</strong><br>${radiusMetres} m hiding zone`)
      .addTo(layerGroup);
    bounds.push(centre);
  }
  for (const position of positions) {
    if (position.lat == null || position.lng == null) continue;
    const point = [Number(position.lat), Number(position.lng)];
    const isOwn = Boolean(position.isOwn);
    L.circleMarker(point, { radius: isOwn ? 8 : 7, color: isOwn ? "#3269bb" : "#0b1f33", fillColor: position.team === "bravo" ? "#34bea1" : "#f26a3d", fillOpacity: .95, weight: 3 })
      .bindPopup(`<strong>${escapeMapText(position.name || "Player")}</strong><br>${escapeMapText(position.teamLabel || position.team || "")}`)
      .addTo(layerGroup);
    if (position.accuracy) L.circle(point, { radius: Number(position.accuracy), color: "#3269bb", weight: 1, fillOpacity: 0.03 }).addTo(layerGroup);
    bounds.push(point);
  }
  if (bounds.length === 1) mapInstance.setView(bounds[0], 15);
  if (bounds.length > 1) mapInstance.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
}

export function destroyZoneMap() {
  mapInstance?.remove();
  mapInstance = null;
  layerGroup = null;
}

function escapeMapText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}
