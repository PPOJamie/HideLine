import { STATION_GEO_BY_ID } from "../data/station-geo.js";

const CACHE_KEY = "hideline:station-coordinates:v1";

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}
function writeCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

export function cachedStationCoordinates(stationId) {
  const cached = readCache()[stationId];
  if (cached) return cached;
  const embedded = STATION_GEO_BY_ID.get(stationId);
  return embedded ? { lat: embedded.lat, lng: embedded.lng, source: "embedded station data", label: stationId } : null;
}

export async function resolveStationCoordinates(station, { signal } = {}) {
  if (!station?.id || !station?.name) throw new Error("Choose a hiding station first.");
  const cached = cachedStationCoordinates(station.id);
  if (cached) return cached;
  const query = encodeURIComponent(station.name.replace("Bank Station", "Bank"));
  try {
    const url = `https://api.tfl.gov.uk/StopPoint/Search/${query}?modes=tube,overground,dlr,national-rail,elizabeth-line&maxResults=12`;
    const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (response.ok) {
      const payload = await response.json();
      const matches = (payload.matches || []).filter((match) => Number.isFinite(match.lat) && Number.isFinite(match.lon));
      const ranked = matches.sort((a, b) => rankMatch(b, station) - rankMatch(a, station));
      if (ranked[0]) return cache(station.id, { lat: ranked[0].lat, lng: ranked[0].lon, source: "TfL", label: ranked[0].name || station.name });
    }
  } catch (error) {
    if (error.name === "AbortError") throw error;
  }
  const fallback = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=4&countrycodes=gb&q=${encodeURIComponent(`${station.name} station, London`)}`, {
    signal,
    headers: { Accept: "application/json" }
  });
  if (!fallback.ok) throw new Error("The station could not be resolved from TfL or OpenStreetMap. Try again with a data connection.");
  const results = await fallback.json();
  if (!results[0]) throw new Error("No coordinates were found for this station.");
  return cache(station.id, { lat: Number(results[0].lat), lng: Number(results[0].lon), source: "OpenStreetMap", label: results[0].display_name || station.name });
}

function rankMatch(match, station) {
  const name = String(match.name || "").toLowerCase();
  const modes = (match.modes || []).join(" ").toLowerCase();
  let score = 0;
  if (name.includes(station.name.toLowerCase().replace(" station", ""))) score += 10;
  for (const term of String(station.service).toLowerCase().split(/\W+/).filter((part) => part.length > 3)) if (modes.includes(term) || name.includes(term)) score += 1;
  for (const term of String(station.note).toLowerCase().split(/\W+/).filter((part) => part.length > 4)) if (modes.includes(term) || name.includes(term)) score += 1;
  return score;
}

function cache(id, coordinates) {
  const all = readCache();
  all[id] = { ...coordinates, resolvedAt: new Date().toISOString() };
  writeCache(all);
  return all[id];
}
