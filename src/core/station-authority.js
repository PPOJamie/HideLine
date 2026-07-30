import { haversineMetres } from "./geo.js";
import { STATION_GEO_BY_ID } from "../data/station-geo.js";

function finitePoint(value) {
  return Number.isFinite(Number(value?.lat)) && Number.isFinite(Number(value?.lng));
}

export function normaliseStationMapName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/\bst\.?\b/g, "saint")
    .replace(/\bstation\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function pointFromFeature(feature) {
  if (feature?.geometry?.type !== "Point") return null;
  const [lng, lat] = feature.geometry.coordinates || [];
  if (![lat, lng].every((value) => Number.isFinite(Number(value)))) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

function serviceTokens(station) {
  const text = `${station?.service || ""} ${station?.note || ""}`
    .toLowerCase()
    .replace(/&/g, " and ");
  return [
    "bakerloo", "circle", "district", "hammersmith", "city", "victoria", "northern",
    "jubilee", "central", "piccadilly", "metropolitan", "dlr", "overground", "windrush",
    "national rail", "rail", "underground", "elizabeth"
  ].filter((token) => text.includes(token));
}

function featureText(feature) {
  return `${feature?.name || ""} ${feature?.layer || ""} ${feature?.properties?.description || ""}`.toLowerCase();
}

function compactStationName(value) {
  return normaliseStationMapName(value).replace(/\s+/g, "");
}

function nameCompatibility(station, feature) {
  const stationName = normaliseStationMapName(station?.name);
  const featureName = normaliseStationMapName(feature?.name);
  if (!stationName || !featureName) return -Infinity;
  if (stationName === featureName) return 140;

  // The handbook contains a small number of spacing/punctuation variants (for
  // example “Pic cadilly Circus”). Compact matching makes those resolve to the
  // official game-map pin without making unrelated names look equivalent.
  const stationCompact = compactStationName(station?.name);
  const featureCompact = compactStationName(feature?.name);
  if (stationCompact && stationCompact === featureCompact) return 132;

  if (featureName.startsWith(`${stationName} `) || stationName.startsWith(`${featureName} `)) return 112;
  if (featureName.includes(stationName) || stationName.includes(featureName)) return 96;
  if (featureCompact.includes(stationCompact) || stationCompact.includes(featureCompact)) return 88;
  return -Infinity;
}

function candidateScore(station, feature) {
  const point = pointFromFeature(feature);
  const fallback = STATION_GEO_BY_ID.get(station.id);
  if (!point || !fallback) return -Infinity;
  let score = nameCompatibility(station, feature);
  if (!Number.isFinite(score)) return score;
  const text = featureText(feature);
  const sourceText = `${feature?.source || ""} ${feature?.properties?.source || ""}`.toLowerCase();
  if (/official google my map|bundled official|official game map/.test(sourceText)) score += 35;
  if (/hiding\s*stations?/.test(text)) score += 18;
  for (const token of serviceTokens(station)) if (text.includes(token)) score += 7;
  const distance = haversineMetres(fallback, point);
  if (distance > 2200) return -Infinity;
  score -= Math.min(45, distance / 45);
  return score;
}

function allPermutations(values) {
  if (values.length <= 1) return [values];
  const result = [];
  values.forEach((value, index) => {
    const rest = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const permutation of allPermutations(rest)) result.push([value, ...permutation]);
  });
  return result;
}

function assignNameGroup(stations, features) {
  if (!stations.length || !features.length) return [];
  const fallback = stations.map((station) => STATION_GEO_BY_ID.get(station.id)).filter(Boolean);
  if (stations.length === features.length && stations.length <= 6 && fallback.length === stations.length) {
    let best = null;
    for (const permutation of allPermutations(features)) {
      let total = 0;
      let valid = true;
      stations.forEach((station, index) => {
        const score = candidateScore(station, permutation[index]);
        if (!Number.isFinite(score)) valid = false;
        total += score;
      });
      if (valid && (!best || total > best.total)) best = { total, permutation };
    }
    if (best) return stations.map((station, index) => [station, best.permutation[index]]);
  }

  const pairs = [];
  stations.forEach((station) => features.forEach((feature) => {
    const score = candidateScore(station, feature);
    if (Number.isFinite(score)) pairs.push({ station, feature, score });
  }));
  pairs.sort((a, b) => b.score - a.score);
  const usedStations = new Set();
  const usedFeatures = new Set();
  const assignments = [];
  for (const pair of pairs) {
    if (usedStations.has(pair.station.id) || usedFeatures.has(pair.feature.id)) continue;
    usedStations.add(pair.station.id);
    usedFeatures.add(pair.feature.id);
    assignments.push([pair.station, pair.feature]);
  }
  return assignments;
}

/**
 * Match the handbook station list to Point placemarks from the supplied Google
 * My Map. The official pin becomes the circle centre; the embedded TfL/NR
 * coordinate is retained only as a fallback and as a duplicate-name matching
 * aid.
 */
export function resolveAuthoritativeStations(stations = [], spatialFeatures = []) {
  const officialFeatures = (spatialFeatures || []).filter((feature) =>
    feature?.category === "station" && pointFromFeature(feature)
  );
  const stationGroups = new Map();
  for (const station of stations) {
    const key = normaliseStationMapName(station.name);
    if (!stationGroups.has(key)) stationGroups.set(key, []);
    stationGroups.get(key).push(station);
  }
  const featureGroups = new Map();
  for (const feature of officialFeatures) {
    const key = normaliseStationMapName(feature.name);
    if (!featureGroups.has(key)) featureGroups.set(key, []);
    featureGroups.get(key).push(feature);
  }

  const overrides = new Map();
  const usedFeatureIds = new Set();
  for (const [key, groupStations] of stationGroups) {
    let candidates = featureGroups.get(key) || [];
    if (!candidates.length) {
      candidates = officialFeatures.filter((feature) =>
        groupStations.some((station) => Number.isFinite(nameCompatibility(station, feature)))
      );
    }
    for (const [station, feature] of assignNameGroup(groupStations, candidates)) {
      const point = pointFromFeature(feature);
      if (!point) continue;
      usedFeatureIds.add(feature.id);
      const fallback = STATION_GEO_BY_ID.get(station.id);
      overrides.set(station.id, {
        ...fallback,
        ...point,
        id: station.id,
        source: "Official Google My Map station pin",
        label: feature.name,
        officialFeatureId: feature.id,
        authoritative: true,
        fallbackOffsetMetres: fallback ? haversineMetres(fallback, point) : null
      });
    }
  }

  const resolved = stations.map((station) => {
    const official = overrides.get(station.id);
    const fallback = STATION_GEO_BY_ID.get(station.id);
    return {
      ...station,
      ...(fallback || {}),
      ...(official || {}),
      coordinateSource: official ? "official-map" : "fallback",
      coordinateSourceLabel: official ? "Official game-map pin" : "Embedded fallback"
    };
  });

  const offsets = [...overrides.values()]
    .map((value) => Number(value.fallbackOffsetMetres))
    .filter(Number.isFinite);
  return {
    stations: resolved,
    byId: new Map(resolved.map((station) => [station.id, station])),
    diagnostics: {
      officialFeatureCount: officialFeatures.length,
      matchedCount: overrides.size,
      fallbackCount: Math.max(0, stations.length - overrides.size),
      unmatchedStationIds: resolved.filter((station) => station.coordinateSource !== "official-map").map((station) => station.id),
      unusedOfficialFeatures: officialFeatures.filter((feature) => !usedFeatureIds.has(feature.id)).map((feature) => feature.name),
      maximumFallbackOffsetMetres: offsets.length ? Math.max(...offsets) : null,
      meanFallbackOffsetMetres: offsets.length ? offsets.reduce((sum, value) => sum + value, 0) / offsets.length : null
    }
  };
}

export function authoritativeStationForId(stationId, stations = [], spatialFeatures = []) {
  return resolveAuthoritativeStations(stations, spatialFeatures).byId.get(stationId) || null;
}
