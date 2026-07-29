import { haversineMetres } from "./geo.js";

export const SPATIAL_DATA_VERSION = 1;

export const SPATIAL_CATEGORIES = Object.freeze({
  street_path: "Streets / paths",
  borough: "London boroughs",
  constituency: "Parliamentary constituencies",
  ward: "Electoral wards",
  park: "Parks",
  zoo: "Zoos",
  museum: "Museums",
  cinema: "Movie theatres",
  hospital: "Hospitals",
  library: "Libraries",
  consulate: "Foreign consulates",
  aquarium: "Aquariums",
  water: "Bodies of water",
  high_speed_rail: "High-speed railway lines",
  place_of_worship: "Places of worship",
  grocery: "Grocery stores",
  restaurant: "Restaurants",
  station: "Hiding stations",
  game_boundary: "Game boundary",
  unknown: "Unclassified"
});

const CATEGORY_PATTERNS = Object.freeze([
  ["game_boundary", /game\s*(area\s*)?(map\s*)?boundar|game\s*area/i],
  ["high_speed_rail", /high[\s-]*speed|hs1|eurostar|railway\s*lines?/i],
  ["constituency", /constituen/i],
  ["borough", /london\s*borough|boroughs?/i],
  ["ward", /electoral\s*ward|wards?/i],
  ["street_path", /street|streets|path|paths|road\s*line/i],
  ["aquarium", /aquarium|sea\s*life/i],
  ["consulate", /consulat|embass/i],
  ["cinema", /cinema|movie\s*theatre|movie\s*theater|theatres?|theaters?/i],
  ["hospital", /hospital|medical\s*centre|medical\s*center/i],
  ["library", /librar/i],
  ["museum", /museum|gallery/i],
  ["zoo", /zoo|city\s*farm|children'?s\s*farm/i],
  ["park", /parks?|public\s*gardens?|green\s*spaces?/i],
  ["water", /body\s*of\s*water|water|lake|pond|reservoir|basin|dock|canal/i],
  ["place_of_worship", /place\s*of\s*worship|church|mosque|synagogue|temple/i],
  ["grocery", /grocery|supermarket/i],
  ["restaurant", /restaurant/i],
  ["station", /hiding\s*stations?|rail\s*stations?|stations?/i]
]);

export function normaliseSpatialName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\b(the|station|cinema|theatre|theater|museum|hospital|library|park)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferSpatialCategory(...values) {
  const text = values.filter(Boolean).join(" ");
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return "unknown";
}

export function spatialCategoryLabel(category) {
  return SPATIAL_CATEGORIES[category] || String(category || "Unclassified");
}

function geometryCoordinates(geometry) {
  if (!geometry || typeof geometry !== "object") return [];
  if (geometry.type === "GeometryCollection") return (geometry.geometries || []).flatMap(geometryCoordinates);
  return geometry.coordinates || [];
}

function visitCoordinatePairs(value, callback) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
    callback(Number(value[0]), Number(value[1]));
    return;
  }
  for (const child of value) visitCoordinatePairs(child, callback);
}

export function geometryBbox(geometry) {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  visitCoordinatePairs(geometryCoordinates(geometry), (lng, lat) => {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  });
  if (![west, east, south, north].every(Number.isFinite)) return null;
  return { west, east, south, north };
}

export function normaliseSpatialFeature(feature, index = 0) {
  if (!feature?.geometry?.type) return null;
  const properties = feature.properties || {};
  const name = String(properties.name || properties.Name || feature.name || `Feature ${index + 1}`).trim();
  const layer = String(properties.layer || properties.folder || properties.categoryName || "").trim();
  const category = String(properties.category || inferSpatialCategory(layer, name, properties.description || "")).trim() || "unknown";
  const id = String(feature.id || properties.id || `${category}:${normaliseSpatialName(name) || "feature"}:${index}`);
  const bbox = feature.bbox && feature.bbox.length >= 4
    ? { west: Number(feature.bbox[0]), south: Number(feature.bbox[1]), east: Number(feature.bbox[2]), north: Number(feature.bbox[3]) }
    : geometryBbox(feature.geometry);
  return {
    id,
    name,
    category,
    layer,
    geometry: feature.geometry,
    bbox,
    source: String(properties.source || feature.source || "imported"),
    properties: {
      description: String(properties.description || "").slice(0, 500),
      originalId: properties.originalId || null
    }
  };
}

export function normaliseSpatialData(value = {}) {
  const features = Array.isArray(value?.features)
    ? value.features.map(normaliseSpatialFeature).filter(Boolean)
    : [];
  return {
    version: SPATIAL_DATA_VERSION,
    sourceName: String(value?.sourceName || "No map data imported"),
    importedAt: value?.importedAt || null,
    features
  };
}

/** Merge imported game-map data with built-in reference layers. Later datasets
 * take precedence when the same named feature appears more than once. */
export function mergeSpatialData(...values) {
  const merged = new Map();
  const sources = [];
  let importedAt = null;
  for (const value of values.filter(Boolean)) {
    const data = normaliseSpatialData(value);
    if (data.sourceName && data.sourceName !== "No map data imported") sources.push(data.sourceName);
    if (data.importedAt && (!importedAt || new Date(data.importedAt) > new Date(importedAt))) importedAt = data.importedAt;
    for (const feature of data.features) {
      const key = `${feature.category}:${normaliseSpatialName(feature.name) || feature.id}`;
      merged.set(key, feature);
    }
  }
  return {
    version: SPATIAL_DATA_VERSION,
    sourceName: sources.length ? [...new Set(sources)].join(" + ") : "No map data imported",
    importedAt,
    features: [...merged.values()]
  };
}

export function spatialDataStats(value = {}) {
  const data = normaliseSpatialData(value);
  const categories = {};
  for (const feature of data.features) categories[feature.category] = (categories[feature.category] || 0) + 1;
  return {
    total: data.features.length,
    categories,
    sourceName: data.sourceName,
    importedAt: data.importedAt
  };
}

export function featuresForCategory(features = [], category) {
  return (features || []).filter((feature) => feature?.category === category);
}

function bboxContainsPoint(bbox, point, toleranceDegrees = 0) {
  if (!bbox) return true;
  return Number(point.lng) >= bbox.west - toleranceDegrees
    && Number(point.lng) <= bbox.east + toleranceDegrees
    && Number(point.lat) >= bbox.south - toleranceDegrees
    && Number(point.lat) <= bbox.north + toleranceDegrees;
}

function localXY(origin, point) {
  const metresPerDegreeLat = 111_320;
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((Number(origin.lat) * Math.PI) / 180);
  return {
    x: (Number(point.lng) - Number(origin.lng)) * metresPerDegreeLng,
    y: (Number(point.lat) - Number(origin.lat)) * metresPerDegreeLat
  };
}

function pointFromLocalXY(origin, value) {
  const metresPerDegreeLat = 111_320;
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((Number(origin.lat) * Math.PI) / 180);
  return {
    lat: Number(origin.lat) + Number(value.y) / metresPerDegreeLat,
    lng: Number(origin.lng) + Number(value.x) / (metresPerDegreeLng || Number.EPSILON)
  };
}

export function nearestPointOnSegment(point, start, end) {
  const a = localXY(point, start);
  const b = localXY(point, end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return { point: { lat: Number(start.lat), lng: Number(start.lng) }, distanceMetres: Math.hypot(a.x, a.y), t: 0 };
  const t = Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared));
  const local = { x: a.x + t * dx, y: a.y + t * dy };
  return { point: pointFromLocalXY(point, local), distanceMetres: Math.hypot(local.x, local.y), t };
}

export function distancePointToSegmentMetres(point, start, end) {
  return nearestPointOnSegment(point, start, end).distanceMetres;
}

function lineCoordinatesToPoints(line = []) {
  return line
    .filter((coordinate) => Array.isArray(coordinate) && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1])))
    .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));
}

export function distancePointToLineMetres(point, line = []) {
  const points = lineCoordinatesToPoints(line);
  if (!points.length) return Infinity;
  if (points.length === 1) return haversineMetres(point, points[0]);
  let best = Infinity;
  for (let index = 0; index < points.length - 1; index += 1) {
    best = Math.min(best, distancePointToSegmentMetres(point, points[index], points[index + 1]));
  }
  return best;
}

export function nearestPointOnLine(point, line = []) {
  const points = lineCoordinatesToPoints(line);
  if (!points.length) return null;
  if (points.length === 1) return { point: points[0], distanceMetres: haversineMetres(point, points[0]) };
  let best = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const candidate = nearestPointOnSegment(point, points[index], points[index + 1]);
    if (!best || candidate.distanceMetres < best.distanceMetres) best = candidate;
  }
  return best;
}

function pointInRing(point, ring = []) {
  const x = Number(point.lng);
  const y = Number(point.lat);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = Number(ring[i]?.[0]);
    const yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]);
    const yj = Number(ring[j]?.[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInPolygonCoordinates(point, polygon = []) {
  if (!polygon.length || !pointInRing(point, polygon[0])) return false;
  for (let index = 1; index < polygon.length; index += 1) {
    if (pointInRing(point, polygon[index])) return false;
  }
  return true;
}

export function geometryContainsPoint(geometry, point) {
  if (!geometry || !point) return false;
  if (geometry.type === "Polygon") return pointInPolygonCoordinates(point, geometry.coordinates || []);
  if (geometry.type === "MultiPolygon") return (geometry.coordinates || []).some((polygon) => pointInPolygonCoordinates(point, polygon));
  if (geometry.type === "GeometryCollection") return (geometry.geometries || []).some((child) => geometryContainsPoint(child, point));
  return false;
}

function polygonBoundaryDistance(point, polygon = []) {
  let best = Infinity;
  for (const ring of polygon) best = Math.min(best, distancePointToLineMetres(point, ring));
  return best;
}

export function geometryRepresentativePoint(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates || [];
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : null;
  }
  if (geometry.type === "MultiPoint") {
    const first = geometry.coordinates?.[0];
    return first ? { lat: Number(first[1]), lng: Number(first[0]) } : null;
  }
  const bbox = geometryBbox(geometry);
  if (!bbox) return null;
  const centre = { lat: (bbox.south + bbox.north) / 2, lng: (bbox.west + bbox.east) / 2 };
  if (["Polygon", "MultiPolygon"].includes(geometry.type) && geometryContainsPoint(geometry, centre)) return centre;
  let totalLat = 0;
  let totalLng = 0;
  let count = 0;
  visitCoordinatePairs(geometryCoordinates(geometry), (lng, lat) => { totalLng += lng; totalLat += lat; count += 1; });
  return count ? { lat: totalLat / count, lng: totalLng / count } : centre;
}

export function geometryNearestPoint(point, geometry, { boundaryOnly = false, anchorOnly = false } = {}) {
  if (!geometry || !point) return null;
  if (anchorOnly) {
    const anchor = geometryRepresentativePoint(geometry);
    return anchor ? { point: anchor, distanceMetres: haversineMetres(point, anchor) } : null;
  }
  if (geometry.type === "Point") {
    const anchor = geometryRepresentativePoint(geometry);
    return anchor ? { point: anchor, distanceMetres: haversineMetres(point, anchor) } : null;
  }
  if (geometry.type === "MultiPoint") {
    let best = null;
    for (const coordinates of geometry.coordinates || []) {
      const candidatePoint = { lat: Number(coordinates?.[1]), lng: Number(coordinates?.[0]) };
      if (![candidatePoint.lat, candidatePoint.lng].every(Number.isFinite)) continue;
      const candidate = { point: candidatePoint, distanceMetres: haversineMetres(point, candidatePoint) };
      if (!best || candidate.distanceMetres < best.distanceMetres) best = candidate;
    }
    return best;
  }
  if (geometry.type === "LineString") return nearestPointOnLine(point, geometry.coordinates || []);
  if (geometry.type === "MultiLineString") {
    let best = null;
    for (const line of geometry.coordinates || []) {
      const candidate = nearestPointOnLine(point, line);
      if (candidate && (!best || candidate.distanceMetres < best.distanceMetres)) best = candidate;
    }
    return best;
  }
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    if (!boundaryOnly && geometryContainsPoint(geometry, point)) return { point: { lat: Number(point.lat), lng: Number(point.lng) }, distanceMetres: 0 };
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates || []] : geometry.coordinates || [];
    let best = null;
    for (const polygon of polygons) {
      for (const ring of polygon || []) {
        const candidate = nearestPointOnLine(point, ring);
        if (candidate && (!best || candidate.distanceMetres < best.distanceMetres)) best = candidate;
      }
    }
    return best;
  }
  if (geometry.type === "GeometryCollection") {
    let best = null;
    for (const child of geometry.geometries || []) {
      const candidate = geometryNearestPoint(point, child, { boundaryOnly, anchorOnly });
      if (candidate && (!best || candidate.distanceMetres < best.distanceMetres)) best = candidate;
    }
    return best;
  }
  return null;
}

export function measurementOptionsForCategory(category, { boundaryOnly = false } = {}) {
  if (boundaryOnly || ["water", "borough", "constituency", "ward"].includes(category)) return { boundaryOnly: true, anchorOnly: false, method: "nearest boundary or edge" };
  if (["high_speed_rail", "street_path"].includes(category)) return { boundaryOnly: false, anchorOnly: false, method: "nearest point on the mapped line" };
  return { boundaryOnly: false, anchorOnly: true, method: "curated map pin" };
}

export function featureAnchorPoint(feature) {
  return geometryRepresentativePoint(feature?.geometry);
}

export function featureNearestPoint(point, feature, options = {}) {
  return feature?.geometry ? geometryNearestPoint(point, feature.geometry, options) : null;
}

export function geometryDistanceMetres(point, geometry, { boundaryOnly = false, anchorOnly = false } = {}) {
  if (!geometry || !point) return Infinity;
  if (anchorOnly) return geometryNearestPoint(point, geometry, { anchorOnly: true })?.distanceMetres ?? Infinity;
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates || [];
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? haversineMetres(point, { lat: Number(lat), lng: Number(lng) }) : Infinity;
  }
  if (geometry.type === "MultiPoint") {
    return Math.min(...(geometry.coordinates || []).map(([lng, lat]) => haversineMetres(point, { lat: Number(lat), lng: Number(lng) })), Infinity);
  }
  if (geometry.type === "LineString") return distancePointToLineMetres(point, geometry.coordinates || []);
  if (geometry.type === "MultiLineString") return Math.min(...(geometry.coordinates || []).map((line) => distancePointToLineMetres(point, line)), Infinity);
  if (geometry.type === "Polygon") {
    if (!boundaryOnly && pointInPolygonCoordinates(point, geometry.coordinates || [])) return 0;
    return polygonBoundaryDistance(point, geometry.coordinates || []);
  }
  if (geometry.type === "MultiPolygon") {
    if (!boundaryOnly && (geometry.coordinates || []).some((polygon) => pointInPolygonCoordinates(point, polygon))) return 0;
    return Math.min(...(geometry.coordinates || []).map((polygon) => polygonBoundaryDistance(point, polygon)), Infinity);
  }
  if (geometry.type === "GeometryCollection") {
    return Math.min(...(geometry.geometries || []).map((child) => geometryDistanceMetres(point, child, { boundaryOnly })), Infinity);
  }
  return Infinity;
}

export function featureContainsPoint(feature, point) {
  if (!feature || !point || !bboxContainsPoint(feature.bbox, point)) return false;
  return geometryContainsPoint(feature.geometry, point);
}

function roughBboxDistanceMetres(point, bbox) {
  if (!bbox || bboxContainsPoint(bbox, point)) return 0;
  const clamped = {
    lng: Math.max(bbox.west, Math.min(bbox.east, Number(point.lng))),
    lat: Math.max(bbox.south, Math.min(bbox.north, Number(point.lat)))
  };
  return haversineMetres(point, clamped);
}

export function featureDistanceMetres(point, feature, options = {}) {
  if (!feature?.geometry) return Infinity;
  return geometryDistanceMetres(point, feature.geometry, options);
}

export function nearestFeature(point, features = [], options = {}) {
  let best = null;
  let bestDistance = Infinity;
  for (const feature of features) {
    const lowerBound = roughBboxDistanceMetres(point, feature.bbox);
    if (lowerBound > bestDistance) continue;
    const distance = featureDistanceMetres(point, feature, options);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = feature;
    }
  }
  return best ? { feature: best, distanceMetres: bestDistance } : null;
}

export function containingFeature(point, features = []) {
  const candidates = features.filter((feature) => bboxContainsPoint(feature.bbox, point) && featureContainsPoint(feature, point));
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const aArea = a.bbox ? (a.bbox.east - a.bbox.west) * (a.bbox.north - a.bbox.south) : Infinity;
    const bArea = b.bbox ? (b.bbox.east - b.bbox.west) * (b.bbox.north - b.bbox.south) : Infinity;
    return aArea - bArea;
  });
  return candidates[0];
}

function editDistance(a, b) {
  const rows = a.length + 1;
  const columns = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(columns).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < columns; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[a.length][b.length];
}

export function resolveFeatureAnswer(answer, features = []) {
  const needle = normaliseSpatialName(answer);
  if (!needle) return null;
  const exact = features.find((feature) => normaliseSpatialName(feature.name) === needle);
  if (exact) return exact;
  const containing = features.filter((feature) => {
    const name = normaliseSpatialName(feature.name);
    return name.includes(needle) || needle.includes(name);
  });
  if (containing.length === 1) return containing[0];
  let best = null;
  let bestScore = Infinity;
  for (const feature of features) {
    const name = normaliseSpatialName(feature.name);
    if (!name) continue;
    const score = editDistance(needle, name) / Math.max(needle.length, name.length, 1);
    if (score < bestScore) {
      bestScore = score;
      best = feature;
    }
  }
  return bestScore <= 0.34 ? best : null;
}

function decimateCoordinates(value, limit = 240) {
  if (!Array.isArray(value)) return value;
  if (value.length && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) return [Number(value[0]), Number(value[1])];
  if (value.length > limit && value.every((item) => Array.isArray(item) && Number.isFinite(Number(item[0])) && Number.isFinite(Number(item[1])))) {
    const step = Math.ceil(value.length / limit);
    const output = value.filter((_, index) => index % step === 0);
    if (value.length && output.at(-1) !== value.at(-1)) output.push(value.at(-1));
    return output.map((item) => decimateCoordinates(item, limit));
  }
  return value.map((item) => decimateCoordinates(item, limit));
}

export function compactGeometry(geometry, limit = 240) {
  if (!geometry?.type) return null;
  if (geometry.type === "GeometryCollection") return { type: geometry.type, geometries: (geometry.geometries || []).slice(0, 12).map((item) => compactGeometry(item, limit)).filter(Boolean) };
  return { type: geometry.type, coordinates: decimateCoordinates(geometry.coordinates, limit) };
}

export function pointInManualArea(point, constraint) {
  if (constraint?.shape === "circle") {
    const centre = constraint.centre;
    const radiusMetres = Number(constraint.radiusMetres);
    return centre && Number.isFinite(radiusMetres) && haversineMetres(point, centre) <= radiusMetres;
  }
  const polygon = constraint?.polygon;
  if (Array.isArray(polygon) && polygon.length >= 3) {
    const ring = polygon.map((item) => [Number(item.lng), Number(item.lat)]);
    const first = ring[0];
    const last = ring.at(-1);
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push(first);
    return pointInPolygonCoordinates(point, [ring]);
  }
  return false;
}
