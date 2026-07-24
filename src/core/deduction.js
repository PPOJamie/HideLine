import { DEFAULT_DURATIONS } from "./constants.js";
import { haversineMetres } from "./geo.js";
import {
  containingFeature,
  featureDistanceMetres,
  featuresForCategory,
  nearestFeature,
  pointInManualArea,
  resolveFeatureAnswer,
  spatialCategoryLabel
} from "./spatial.js";
import { stationNameLength } from "../data/stations.js";
import { STATION_GEO, STATION_GEO_BY_ID, RAIL_LINE_BY_ID, stationsForLine } from "../data/station-geo.js";

export const DEDUCTION_STATUS = Object.freeze({
  POSSIBLE: "possible",
  PARTIAL: "partial",
  ELIMINATED: "eliminated",
  PRIORITY: "priority"
});

export const DEDUCTION_MOVEMENT = Object.freeze({
  MOBILE: "mobile",
  LOCKED: "locked"
});

export const DEDUCTION_MAP_MODES = Object.freeze({
  OVERVIEW: "overview",
  ANSWER: "answer",
  ENDGAME: "endgame"
});

export const DEDUCTION_AREA_SELECTION_ALL = "all";

export const DEDUCTION_TOOL_TYPES = Object.freeze({
  RADAR: "radar",
  THERMOMETER: "thermometer",
  DISTANCE: "distance",
  STATION_NAME: "station-name-length",
  TRANSIT: "transit-line",
  THAMES: "thames-side",
  NEAREST_FEATURE_MATCH: "nearest-feature-match",
  REGION_MATCH: "region-match",
  NEAREST_FEATURE_DISTANCE: "nearest-feature-distance",
  NEAREST_STATION_DISTANCE: "nearest-station-distance",
  TENTACLE: "tentacle",
  MANUAL_AREA: "manual-area",
  MANUAL_REVIEW: "manual-review"
});

const STATION_LEVEL_TYPES = new Set([
  DEDUCTION_TOOL_TYPES.STATION_NAME,
  DEDUCTION_TOOL_TYPES.TRANSIT
]);

const AREA_TYPES = new Set([
  DEDUCTION_TOOL_TYPES.RADAR,
  DEDUCTION_TOOL_TYPES.THERMOMETER,
  DEDUCTION_TOOL_TYPES.DISTANCE,
  DEDUCTION_TOOL_TYPES.THAMES,
  DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_MATCH,
  DEDUCTION_TOOL_TYPES.REGION_MATCH,
  DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE,
  DEDUCTION_TOOL_TYPES.NEAREST_STATION_DISTANCE,
  DEDUCTION_TOOL_TYPES.TENTACLE,
  DEDUCTION_TOOL_TYPES.MANUAL_AREA
]);

export const THAMES_CENTRELINE = Object.freeze([
  { lat: 51.4874, lng: -0.2100 },
  { lat: 51.4887, lng: -0.1900 },
  { lat: 51.4876, lng: -0.1700 },
  { lat: 51.4849, lng: -0.1500 },
  { lat: 51.4867, lng: -0.1350 },
  { lat: 51.4927, lng: -0.1200 },
  { lat: 51.4996, lng: -0.1100 },
  { lat: 51.5042, lng: -0.1000 },
  { lat: 51.5070, lng: -0.0870 },
  { lat: 51.5076, lng: -0.0740 },
  { lat: 51.5055, lng: -0.0600 },
  { lat: 51.5016, lng: -0.0450 }
]);

export function createDeductionRoundState() {
  return {
    constraints: [],
    stationOverrides: {},
    ignoredAutoConstraintIds: [],
    showEliminated: true,
    showZones: true,
    showAreaMask: true,
    mapDisplayMode: DEDUCTION_MAP_MODES.OVERVIEW,
    areaConstraintId: DEDUCTION_AREA_SELECTION_ALL,
    endgameStationId: null,
    maskScope: "all",
    filter: "remaining",
    undoStack: []
  };
}

export function normaliseDeductionRoundState(value = {}) {
  const areaConstraintId = !value?.areaConstraintId || value.areaConstraintId === "latest"
    ? DEDUCTION_AREA_SELECTION_ALL
    : value.areaConstraintId;
  return {
    ...createDeductionRoundState(),
    ...(value || {}),
    areaConstraintId,
    constraints: Array.isArray(value?.constraints) ? value.constraints : [],
    stationOverrides: value?.stationOverrides && typeof value.stationOverrides === "object" ? value.stationOverrides : {},
    ignoredAutoConstraintIds: Array.isArray(value?.ignoredAutoConstraintIds) ? value.ignoredAutoConstraintIds : [],
    undoStack: Array.isArray(value?.undoStack) ? value.undoStack : []
  };
}

/** 97 sample points, retained for fast station-level viability calculations. */
export function sampleZonePoints(station, radiusMetres = DEFAULT_DURATIONS.hidingZoneRadiusMetres) {
  const lat = Number(station?.lat);
  const lng = Number(station?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const points = [{ lat, lng, offsetMetres: 0 }];
  const rings = [0.25, 0.5, 0.75, 0.99];
  const bearings = 24;
  const metresPerDegreeLat = 111_320;
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((lat * Math.PI) / 180);
  for (const ring of rings) {
    const distance = radiusMetres * ring;
    for (let index = 0; index < bearings; index += 1) {
      const angle = (index / bearings) * Math.PI * 2;
      points.push({
        lat: lat + (Math.cos(angle) * distance) / metresPerDegreeLat,
        lng: lng + (Math.sin(angle) * distance) / metresPerDegreeLng,
        offsetMetres: distance
      });
    }
  }
  return points;
}

/**
 * Square cells used only for visual masks. The map renderer clips them to the
 * station's 500 m circle, so grey cells never cover the area outside the zone.
 */
export function sampleZoneCells(station, radiusMetres = DEFAULT_DURATIONS.hidingZoneRadiusMetres, cellSizeMetres = 75) {
  const lat = Number(station?.lat);
  const lng = Number(station?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const metresPerDegreeLat = 111_320;
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((lat * Math.PI) / 180);
  const half = cellSizeMetres / 2;
  const cells = [];
  const start = -radiusMetres + half;
  const end = radiusMetres - half;
  for (let north = start; north <= end + 0.001; north += cellSizeMetres) {
    for (let east = start; east <= end + 0.001; east += cellSizeMetres) {
      // Include every square that can touch the circular zone. The renderer
      // clips the cells to the exact 500 m circle, so this avoids uncovered
      // wedges around the circumference without drawing outside the zone.
      if (Math.hypot(east, north) > radiusMetres + half * Math.SQRT2) continue;
      const toPoint = (eastMetres, northMetres) => ({
        lat: lat + northMetres / metresPerDegreeLat,
        lng: lng + eastMetres / metresPerDegreeLng
      });
      cells.push({
        centre: toPoint(east, north),
        corners: [
          toPoint(east - half, north - half),
          toPoint(east + half, north - half),
          toPoint(east + half, north + half),
          toPoint(east - half, north + half)
        ]
      });
    }
  }
  return cells;
}

function finitePoint(value) {
  if (!value) return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function canonicalAnswer(answer) {
  return String(answer || "").trim().toLowerCase().replace(/farther/g, "further");
}

function stationLevelPass(constraint, station, geo) {
  const answer = canonicalAnswer(constraint.answer);
  if (constraint.type === DEDUCTION_TOOL_TYPES.STATION_NAME) {
    const seekerLength = Number(constraint.seekerLength);
    if (!Number.isFinite(seekerLength)) return null;
    const hiderLength = stationNameLength(station.name);
    if (answer === "same" || answer === "yes") return hiderLength === seekerLength;
    if (answer.includes("longer")) return hiderLength > seekerLength;
    if (answer.includes("shorter")) return hiderLength < seekerLength;
    return null;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.TRANSIT) {
    const explicitStops = Array.isArray(constraint.stationIds) ? constraint.stationIds : [];
    const stopsHere = explicitStops.length
      ? explicitStops.includes(station.id)
      : Boolean(constraint.lineId && geo?.lines?.includes(constraint.lineId));
    if (answer === "yes" || answer === "match") return stopsHere;
    if (answer === "no" || answer === "not a match") return !stopsHere;
    return null;
  }
  return null;
}

function closestPolylineSegment(point, line) {
  const latScale = 111_320;
  const lngScale = latScale * Math.cos((Number(point.lat) * Math.PI) / 180);
  let best = null;
  for (let index = 0; index < line.length - 1; index += 1) {
    const a = line[index];
    const b = line[index + 1];
    const ax = (a.lng - point.lng) * lngScale;
    const ay = (a.lat - point.lat) * latScale;
    const bx = (b.lng - point.lng) * lngScale;
    const by = (b.lat - point.lat) * latScale;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy || Number.EPSILON;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const distance = Math.hypot(cx, cy);
    if (!best || distance < best.distance) {
      const cross = dx * -ay - dy * -ax;
      best = { distance, cross };
    }
  }
  return best;
}

export function thamesSide(point, toleranceMetres = 35) {
  const parsed = finitePoint(point);
  if (!parsed) return "unknown";
  const nearest = closestPolylineSegment(parsed, THAMES_CENTRELINE);
  if (!nearest) return "unknown";
  if (nearest.distance <= toleranceMetres) return "both";
  return nearest.cross >= 0 ? "north" : "south";
}

function nearestStationDistance(point) {
  let distance = Infinity;
  for (const station of STATION_GEO) distance = Math.min(distance, haversineMetres(point, station));
  return distance;
}

function prepareConstraint(constraint, context = {}) {
  const spatialFeatures = context.spatialFeatures || [];
  const runtime = { constraint, ready: true, manual: false, reason: "", features: [] };
  const answer = canonicalAnswer(constraint.answer);

  if (constraint.type === DEDUCTION_TOOL_TYPES.MANUAL_REVIEW) {
    return { ...runtime, ready: false, manual: true, reason: constraint.reviewReason || "Seeker judgement is required before this answer can become an area mask." };
  }
  if (STATION_LEVEL_TYPES.has(constraint.type)) return runtime;
  if (constraint.type === DEDUCTION_TOOL_TYPES.RADAR) {
    if (!finitePoint(constraint.centre) || !Number.isFinite(Number(constraint.radiusMetres)) || Number(constraint.radiusMetres) <= 0) return { ...runtime, ready: false, reason: "Radar pin or radius is missing." };
    return runtime;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.THERMOMETER) {
    if (!finitePoint(constraint.start) || !finitePoint(constraint.end)) return { ...runtime, ready: false, reason: "Thermometer start or end point is missing." };
    return runtime;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.DISTANCE) {
    if (!finitePoint(constraint.seeker) || !finitePoint(constraint.target)) return { ...runtime, ready: false, reason: "Seeker or reference pin is missing." };
    return runtime;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.THAMES) {
    if (!["north", "south", "both"].includes(constraint.seekerSide)) return { ...runtime, ready: false, reason: "The seeker's Thames side is missing." };
    return runtime;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.NEAREST_STATION_DISTANCE) {
    if (!finitePoint(constraint.seeker)) return { ...runtime, ready: false, reason: "The seeker's pin is missing." };
    return runtime;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.MANUAL_AREA) {
    const polygonReady = Array.isArray(constraint.polygon) && constraint.polygon.length >= 3;
    const circleReady = constraint.shape === "circle" && finitePoint(constraint.centre) && Number(constraint.radiusMetres) > 0;
    return polygonReady || circleReady ? runtime : { ...runtime, ready: false, reason: "The manual area has no valid polygon or circle." };
  }

  if ([
    DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_MATCH,
    DEDUCTION_TOOL_TYPES.REGION_MATCH,
    DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE,
    DEDUCTION_TOOL_TYPES.TENTACLE
  ].includes(constraint.type)) {
    const features = featuresForCategory(spatialFeatures, constraint.category);
    if (!features.length) {
      return {
        ...runtime,
        ready: false,
        reason: `Import the authoritative ${spatialCategoryLabel(constraint.category).toLowerCase()} layer to calculate this answer.`
      };
    }
    runtime.features = features;
  }

  if (constraint.type === DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_MATCH) {
    const seeker = finitePoint(constraint.seeker);
    if (!seeker) return { ...runtime, ready: false, reason: "The seeker's pin is missing." };
    const reference = constraint.referenceFeatureId
      ? runtime.features.find((feature) => feature.id === constraint.referenceFeatureId)
      : nearestFeature(seeker, runtime.features)?.feature;
    if (!reference) return { ...runtime, ready: false, reason: `The seeker's nearest ${spatialCategoryLabel(constraint.category).toLowerCase()} could not be resolved.` };
    runtime.referenceFeature = reference;
    return runtime;
  }

  if (constraint.type === DEDUCTION_TOOL_TYPES.REGION_MATCH) {
    const seeker = finitePoint(constraint.seeker);
    if (!seeker) return { ...runtime, ready: false, reason: "The seeker's pin is missing." };
    const reference = constraint.referenceFeatureId
      ? runtime.features.find((feature) => feature.id === constraint.referenceFeatureId)
      : containingFeature(seeker, runtime.features);
    if (!reference) return { ...runtime, ready: false, reason: `The seeker's ${spatialCategoryLabel(constraint.category).toLowerCase()} could not be resolved from the imported polygons.` };
    runtime.referenceFeature = reference;
    return runtime;
  }

  if (constraint.type === DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE) {
    const seeker = finitePoint(constraint.seeker);
    if (!seeker) return { ...runtime, ready: false, reason: "The seeker's pin is missing." };
    const nearest = nearestFeature(seeker, runtime.features, { boundaryOnly: Boolean(constraint.boundaryOnly) });
    if (!nearest || !Number.isFinite(nearest.distanceMetres)) return { ...runtime, ready: false, reason: `The reference distance to ${spatialCategoryLabel(constraint.category).toLowerCase()} could not be calculated.` };
    runtime.seekerDistanceMetres = nearest.distanceMetres;
    runtime.referenceFeature = nearest.feature;
    return runtime;
  }

  if (constraint.type === DEDUCTION_TOOL_TYPES.TENTACLE) {
    const seeker = finitePoint(constraint.seeker);
    if (!seeker) return { ...runtime, ready: false, reason: "The seeker's pin is missing." };
    const radiusMetres = Number(constraint.radiusMetres) || 2000;
    runtime.validFeatures = runtime.features.filter((feature) => featureDistanceMetres(seeker, feature) <= radiusMetres);
    if (!runtime.validFeatures.length) return { ...runtime, ready: false, reason: `No imported ${spatialCategoryLabel(constraint.category).toLowerCase()} lie within ${Math.round(radiusMetres / 100) / 10} km of the seeker pin.` };
    runtime.answerFeature = constraint.answerFeatureId
      ? runtime.validFeatures.find((feature) => feature.id === constraint.answerFeatureId)
      : resolveFeatureAnswer(constraint.answerFeatureName || constraint.answer, runtime.validFeatures);
    if (!runtime.answerFeature) return { ...runtime, ready: false, reason: `The answer “${constraint.answerFeatureName || constraint.answer || ""}” does not match a valid imported POI within 2 km of the seeker pin.` };
    return runtime;
  }

  if (!AREA_TYPES.has(constraint.type)) return { ...runtime, ready: false, reason: "This deduction type is not supported by the area engine." };
  if (["n/a", "na"].includes(answer)) return { ...runtime, ready: false, manual: true, reason: "An N/A answer does not create a geographical elimination." };
  return runtime;
}

function pointPassRuntime(runtime, point) {
  const constraint = runtime.constraint;
  const answer = canonicalAnswer(constraint.answer);
  if (!runtime.ready) return null;

  if (constraint.type === DEDUCTION_TOOL_TYPES.RADAR) {
    const inside = haversineMetres(point, constraint.centre) <= Number(constraint.radiusMetres);
    if (answer === "yes" || answer === "inside") return inside;
    if (answer === "no" || answer === "outside") return !inside;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.THERMOMETER) {
    const startDistance = haversineMetres(point, constraint.start);
    const endDistance = haversineMetres(point, constraint.end);
    if (answer === "hotter") return endDistance < startDistance;
    if (answer === "colder") return endDistance > startDistance;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.DISTANCE) {
    const seekerDistance = haversineMetres(constraint.seeker, constraint.target);
    const hiderDistance = haversineMetres(point, constraint.target);
    if (answer === "closer") return hiderDistance < seekerDistance;
    if (answer === "further") return hiderDistance > seekerDistance;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.THAMES) {
    const hiderSide = thamesSide(point);
    const same = constraint.seekerSide === "both" || hiderSide === "both" || constraint.seekerSide === hiderSide;
    if (answer === "yes" || answer === "same") return same;
    if (answer === "no" || answer === "different") return !same;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_MATCH) {
    const candidate = nearestFeature(point, runtime.features)?.feature;
    if (!candidate) return null;
    const same = candidate.id === runtime.referenceFeature.id;
    if (answer === "yes" || answer === "same") return same;
    if (answer === "no" || answer === "different") return !same;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.REGION_MATCH) {
    const candidate = containingFeature(point, runtime.features);
    if (!candidate) return null;
    const same = candidate.id === runtime.referenceFeature.id;
    if (answer === "yes" || answer === "same") return same;
    if (answer === "no" || answer === "different") return !same;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE) {
    const candidate = nearestFeature(point, runtime.features, { boundaryOnly: Boolean(constraint.boundaryOnly) });
    if (!candidate) return null;
    if (answer === "closer") return candidate.distanceMetres < runtime.seekerDistanceMetres;
    if (answer === "further") return candidate.distanceMetres > runtime.seekerDistanceMetres;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.NEAREST_STATION_DISTANCE) {
    const seekerDistance = nearestStationDistance(constraint.seeker);
    const candidateDistance = nearestStationDistance(point);
    if (answer === "closer") return candidateDistance < seekerDistance;
    if (answer === "further") return candidateDistance > seekerDistance;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.TENTACLE) {
    const candidate = nearestFeature(point, runtime.validFeatures)?.feature;
    return candidate ? candidate.id === runtime.answerFeature.id : null;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.MANUAL_AREA) {
    const inside = pointInManualArea(point, constraint);
    return answer === "outside" || answer === "exclude" ? !inside : inside;
  }
  return null;
}

export function evaluateConstraintAtPoint(constraint, point, context = {}) {
  return pointPassRuntime(prepareConstraint(constraint, context), point);
}

export function constraintResolution(constraint, context = {}) {
  const runtime = prepareConstraint(constraint, context);
  return {
    ready: runtime.ready,
    manual: runtime.manual,
    reason: runtime.reason,
    featureCount: runtime.features?.length || 0,
    referenceFeature: runtime.referenceFeature || runtime.answerFeature || null
  };
}

export function isAreaConstraint(constraint) {
  return AREA_TYPES.has(constraint?.type);
}

export function isStationConstraint(constraint) {
  return STATION_LEVEL_TYPES.has(constraint?.type);
}

export function isMaskConstraint(constraint) {
  return isAreaConstraint(constraint) || isStationConstraint(constraint);
}

export function constraintTitle(constraint) {
  if (constraint.label) return constraint.label;
  if (constraint.type === DEDUCTION_TOOL_TYPES.RADAR) return `${formatRadius(constraint.radiusMetres)} radar · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.THERMOMETER) return `Thermometer · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.DISTANCE) return `Exact reference distance · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.STATION_NAME) return `Station name length · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.TRANSIT) return `Transit line · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.THAMES) return `Thames side · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_MATCH) return `Nearest ${spatialCategoryLabel(constraint.category).toLowerCase()} match · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.REGION_MATCH) return `${spatialCategoryLabel(constraint.category)} match · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE) return `Nearest ${spatialCategoryLabel(constraint.category).toLowerCase()} distance · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.NEAREST_STATION_DISTANCE) return `Nearest hiding-station distance · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.TENTACLE) return `${spatialCategoryLabel(constraint.category)} tentacle · ${constraint.answerFeatureName || constraint.answer || "answer"}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.MANUAL_AREA) return `Manual ${constraint.shape === "circle" ? "circle" : "polygon"} · ${titleCase(constraint.answer || "inside")}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.MANUAL_REVIEW) return constraint.questionName ? `${constraint.questionName} · guided review` : "Guided map review";
  return "Deduction constraint";
}

function titleCase(value) {
  return String(value || "").replace(/(^|[-\s])\w/g, (match) => match.toUpperCase());
}

function formatRadius(metres) {
  const value = Number(metres);
  if (!Number.isFinite(value)) return "Custom";
  return value < 1000 ? `${Math.round(value)} m` : `${Number((value / 1000).toFixed(2))} km`;
}

function explainConstraint(constraint) {
  const mode = constraint.movementMode === DEDUCTION_MOVEMENT.LOCKED ? "endgame-locked" : "mobile-hider snapshot";
  return `${constraintTitle(constraint)} (${mode})`;
}

export function evaluateStationPossibilities({
  stations,
  constraints = [],
  stationOverrides = {},
  radiusMetres = DEFAULT_DURATIONS.hidingZoneRadiusMetres,
  spatialFeatures = []
} = {}) {
  const sourceStations = stations || [];
  const context = { spatialFeatures };
  const runtimes = constraints.map((constraint) => prepareConstraint(constraint, context));
  const stationRuntimes = runtimes.filter((runtime) => STATION_LEVEL_TYPES.has(runtime.constraint.type));
  const mobileRuntimes = runtimes.filter((runtime) => !STATION_LEVEL_TYPES.has(runtime.constraint.type) && runtime.constraint.movementMode !== DEDUCTION_MOVEMENT.LOCKED);
  const lockedRuntimes = runtimes.filter((runtime) => !STATION_LEVEL_TYPES.has(runtime.constraint.type) && runtime.constraint.movementMode === DEDUCTION_MOVEMENT.LOCKED);

  return sourceStations.map((station) => {
    const geo = STATION_GEO_BY_ID.get(station.id) || station;
    const samples = sampleZonePoints(geo, radiusMetres);
    const failures = [];
    const partials = [];
    const partialConstraintIds = [];
    const passes = [];
    const unresolved = [];

    for (const runtime of stationRuntimes) {
      const pass = stationLevelPass(runtime.constraint, station, geo);
      if (pass === false) failures.push(explainConstraint(runtime.constraint));
      else if (pass === true) passes.push(explainConstraint(runtime.constraint));
      else unresolved.push(`${constraintTitle(runtime.constraint)} could not be evaluated`);
    }

    for (const runtime of mobileRuntimes) {
      if (!runtime.ready) {
        unresolved.push(`${constraintTitle(runtime.constraint)}: ${runtime.reason}`);
        continue;
      }
      const mask = samples.map((point) => pointPassRuntime(runtime, point));
      const valid = mask.filter((value) => value === true).length;
      const evaluated = mask.filter((value) => value !== null).length;
      if (evaluated && valid === 0) failures.push(explainConstraint(runtime.constraint));
      else if (valid > 0 && valid < evaluated) {
        partials.push(explainConstraint(runtime.constraint));
        partialConstraintIds.push(runtime.constraint.id);
      }
      else if (valid === evaluated && evaluated) passes.push(explainConstraint(runtime.constraint));
      else unresolved.push(`${constraintTitle(runtime.constraint)} produced no evaluable points`);
    }

    const readyLocked = lockedRuntimes.filter((runtime) => runtime.ready);
    for (const runtime of lockedRuntimes.filter((item) => !item.ready)) unresolved.push(`${constraintTitle(runtime.constraint)}: ${runtime.reason}`);
    if (readyLocked.length && samples.length) {
      const common = samples.filter((point) => readyLocked.every((runtime) => pointPassRuntime(runtime, point) === true));
      if (!common.length) failures.push(`No sampled point satisfies all ${readyLocked.length} endgame-locked constraints together`);
      else if (common.length < samples.length) {
        partials.push(`${common.length} of ${samples.length} sampled points remain after endgame intersection`);
        partialConstraintIds.push(...readyLocked.map((runtime) => runtime.constraint.id));
      }
      else passes.push("All sampled points satisfy the endgame-locked constraints");
    }

    const override = stationOverrides?.[station.id] || {};
    if (override.eliminated) failures.unshift(override.note ? `Manually eliminated: ${override.note}` : "Manually eliminated by the seeker team");
    const baseStatus = failures.length ? DEDUCTION_STATUS.ELIMINATED : partials.length ? DEDUCTION_STATUS.PARTIAL : DEDUCTION_STATUS.POSSIBLE;
    const status = override.priority && baseStatus !== DEDUCTION_STATUS.ELIMINATED ? DEDUCTION_STATUS.PRIORITY : baseStatus;
    return {
      ...station,
      ...geo,
      status,
      baseStatus,
      possible: baseStatus !== DEDUCTION_STATUS.ELIMINATED,
      priority: Boolean(override.priority),
      failures,
      partials,
      partialConstraintIds: [...new Set(partialConstraintIds)],
      passes,
      unresolved,
      override,
      sampleCount: samples.length
    };
  });
}

/**
 * Build a cell-by-cell mask for one station. In `constraint` mode only the
 * selected answer is shown. In `overlay` mode every supplied maskable answer
 * is displayed together: a cell is grey when one or more ready answers exclude
 * it, green only when every ready answer allows it, and amber when unresolved
 * data prevents a definite result. This is a visual evidence overlay rather
 * than a claim that a mobile hider stayed at one fixed point. In `endgame`
 * mode all locked answers are intersected because the hiding spot is fixed.
 */
export function evaluateZoneAreaMask({
  station,
  constraints = [],
  mode = "constraint",
  activeConstraintId = null,
  spatialFeatures = [],
  radiusMetres = DEFAULT_DURATIONS.hidingZoneRadiusMetres,
  cellSizeMetres = 70
} = {}) {
  const cells = sampleZoneCells(station, radiusMetres, cellSizeMetres);
  const context = { spatialFeatures };
  let selectedConstraints;
  if (mode === "endgame") {
    selectedConstraints = constraints.filter((constraint) => constraint.movementMode === DEDUCTION_MOVEMENT.LOCKED && (AREA_TYPES.has(constraint.type) || STATION_LEVEL_TYPES.has(constraint.type)));
  } else if (mode === "overlay") {
    selectedConstraints = constraints.filter((constraint) => AREA_TYPES.has(constraint.type) || STATION_LEVEL_TYPES.has(constraint.type));
  } else {
    selectedConstraints = constraints.filter((constraint) => constraint.id === activeConstraintId);
  }
  const runtimes = selectedConstraints.map((constraint) => prepareConstraint(constraint, context));
  const stationRuntimes = runtimes.filter((runtime) => STATION_LEVEL_TYPES.has(runtime.constraint.type));
  const areaRuntimes = runtimes.filter((runtime) => !STATION_LEVEL_TYPES.has(runtime.constraint.type));
  const stationGeo = STATION_GEO_BY_ID.get(station?.id) || station;
  const stationResults = stationRuntimes.map((runtime) => stationLevelPass(runtime.constraint, station, stationGeo));
  const stationFailureCount = stationResults.filter((value) => value === false).length;
  const stationUnknownCount = stationResults.filter((value) => value === null).length;
  const stationFailed = stationFailureCount > 0;
  const unresolved = runtimes.filter((runtime) => !runtime.ready).map((runtime) => `${constraintTitle(runtime.constraint)}: ${runtime.reason}`);
  const evaluatedCells = cells.map((cell) => {
    if (stationFailed) {
      return {
        ...cell,
        state: "excluded",
        excludedByCount: stationFailureCount,
        allowedByCount: stationResults.filter((value) => value === true).length,
        unknownByCount: stationUnknownCount + unresolved.length,
        evaluatedCount: stationResults.filter((value) => value !== null).length
      };
    }
    if (!areaRuntimes.length) {
      const unknownByCount = stationUnknownCount + unresolved.length;
      return {
        ...cell,
        state: unknownByCount ? "unknown" : "allowed",
        excludedByCount: 0,
        allowedByCount: stationResults.filter((value) => value === true).length,
        unknownByCount,
        evaluatedCount: stationResults.filter((value) => value !== null).length
      };
    }
    const values = areaRuntimes.map((runtime) => pointPassRuntime(runtime, cell.centre));
    const excludedByCount = values.filter((value) => value === false).length;
    const allowedByCount = values.filter((value) => value === true).length + stationResults.filter((value) => value === true).length;
    const unknownByCount = values.filter((value) => value === null).length + stationUnknownCount + unresolved.length;
    const evaluatedCount = values.filter((value) => value !== null).length + stationResults.filter((value) => value !== null).length;
    if (excludedByCount) return { ...cell, state: "excluded", excludedByCount, allowedByCount, unknownByCount, evaluatedCount };
    if (!unknownByCount && values.every((value) => value === true)) return { ...cell, state: "allowed", excludedByCount, allowedByCount, unknownByCount, evaluatedCount };
    return { ...cell, state: "unknown", excludedByCount, allowedByCount, unknownByCount, evaluatedCount };
  });
  const allowed = evaluatedCells.filter((cell) => cell.state === "allowed").length;
  const excluded = evaluatedCells.filter((cell) => cell.state === "excluded").length;
  const unknown = evaluatedCells.length - allowed - excluded;
  const known = allowed + excluded;
  return {
    stationId: station?.id,
    cells: evaluatedCells,
    allowed,
    excluded,
    unknown,
    total: evaluatedCells.length,
    allowedFraction: known ? allowed / known : null,
    unresolved,
    constraintCount: selectedConstraints.length
  };
}

function movementModeFromInput(input, question) {
  if (input?.movementMode === DEDUCTION_MOVEMENT.LOCKED) return DEDUCTION_MOVEMENT.LOCKED;
  if (question?.answeredPhase === "endgame" || question?.phase === "endgame") return DEDUCTION_MOVEMENT.LOCKED;
  return DEDUCTION_MOVEMENT.MOBILE;
}

function manualReviewConstraint(base, input, question, answer, reason = "") {
  return {
    ...base,
    type: DEDUCTION_TOOL_TYPES.MANUAL_REVIEW,
    answer,
    questionName: question.questionName,
    reviewReason: reason || input.reviewReason || "This answer is linked, but needs a seeker-drawn area or manual station decisions."
  };
}

function automaticConstraint(question) {
  const input = question?.deductionInput;
  if (!input || input.enabled === false || question.status !== "answered") return null;
  const base = {
    id: `auto:${question.id}`,
    source: "auto",
    questionInstanceId: question.id,
    questionId: question.questionId,
    createdAt: question.answeredAt || question.askedAt,
    movementMode: movementModeFromInput(input, question),
    label: `${question.questionName}: ${question.answer}`
  };
  const answer = canonicalAnswer(question.answer);
  if (["n/a", "na"].includes(answer)) return manualReviewConstraint(base, input, question, answer, "The N/A answer is retained in the audit trail but does not eliminate an area.");
  if (input.type === DEDUCTION_TOOL_TYPES.MANUAL_REVIEW) return manualReviewConstraint(base, input, question, answer);

  if (input.type === DEDUCTION_TOOL_TYPES.RADAR && ["yes", "no"].includes(answer)) {
    const centre = finitePoint(input.centre);
    const radiusMetres = Number(input.radiusMetres);
    if (!centre || !Number.isFinite(radiusMetres) || radiusMetres <= 0) return null;
    return { ...base, type: input.type, centre, radiusMetres, answer };
  }
  if (input.type === DEDUCTION_TOOL_TYPES.THERMOMETER && ["hotter", "colder"].includes(answer)) {
    const start = finitePoint(input.start);
    const end = finitePoint(input.end);
    if (!start || !end) return null;
    return { ...base, type: input.type, start, end, answer };
  }
  if (input.type === DEDUCTION_TOOL_TYPES.STATION_NAME) {
    const seekerLength = Number(input.seekerLength);
    if (!Number.isFinite(seekerLength)) return null;
    const parsed = answer === "yes" ? "same" : answer.includes("longer") ? "longer" : answer.includes("shorter") ? "shorter" : null;
    return parsed ? { ...base, type: input.type, seekerLength, seekerStationId: input.seekerStationId || null, answer: parsed } : null;
  }
  if (input.type === DEDUCTION_TOOL_TYPES.TRANSIT && ["yes", "no"].includes(answer)) {
    const stationIds = Array.isArray(input.stationIds) ? input.stationIds.filter(Boolean) : [];
    if (!input.lineId && !stationIds.length) return null;
    return { ...base, type: input.type, lineId: input.lineId || null, stationIds, answer };
  }
  if (input.type === DEDUCTION_TOOL_TYPES.THAMES && ["yes", "no"].includes(answer)) {
    if (!["north", "south", "both"].includes(input.seekerSide)) return null;
    return { ...base, type: input.type, seekerSide: input.seekerSide, answer };
  }
  if ([DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_MATCH, DEDUCTION_TOOL_TYPES.REGION_MATCH].includes(input.type) && ["yes", "no"].includes(answer)) {
    const seeker = finitePoint(input.seeker);
    if (!seeker || !input.category) return null;
    return { ...base, type: input.type, seeker, category: input.category, referenceFeatureId: input.referenceFeatureId || null, answer };
  }
  if (input.type === DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE && ["closer", "further"].includes(answer)) {
    const seeker = finitePoint(input.seeker);
    if (!seeker || !input.category) return null;
    return { ...base, type: input.type, seeker, category: input.category, boundaryOnly: Boolean(input.boundaryOnly), answer };
  }
  if (input.type === DEDUCTION_TOOL_TYPES.NEAREST_STATION_DISTANCE && ["closer", "further"].includes(answer)) {
    const seeker = finitePoint(input.seeker);
    return seeker ? { ...base, type: input.type, seeker, answer } : null;
  }
  if (input.type === DEDUCTION_TOOL_TYPES.TENTACLE) {
    const seeker = finitePoint(input.seeker);
    if (!seeker || !input.category || !String(question.answer || "").trim()) return null;
    return {
      ...base,
      type: input.type,
      seeker,
      category: input.category,
      radiusMetres: Number(input.radiusMetres) || 2000,
      answerFeatureName: String(question.answer).trim(),
      answer
    };
  }
  return manualReviewConstraint(base, input, question, answer, "The structured answer could not be converted automatically. Use a linked manual area if it supports a fair elimination.");
}

export function deriveAutomaticConstraints({ questions = [], team, round = 1, ignoredIds = [] } = {}) {
  const ignored = new Set(ignoredIds || []);
  return questions
    .filter((question) => (question.round || 1) === round && (!team || question.askedByTeam === team))
    .map(automaticConstraint)
    .filter((constraint) => constraint && !ignored.has(constraint.id));
}

export function deductionSummary(results = []) {
  const counts = { possible: 0, partial: 0, priority: 0, eliminated: 0, remaining: 0, total: results.length };
  for (const result of results) {
    if (result.baseStatus === DEDUCTION_STATUS.ELIMINATED) counts.eliminated += 1;
    else {
      counts.remaining += 1;
      if (result.baseStatus === DEDUCTION_STATUS.PARTIAL) counts.partial += 1;
      else counts.possible += 1;
      if (result.priority) counts.priority += 1;
    }
  }
  return counts;
}

export function constraintOverlay(constraint, context = {}) {
  if (constraint.type === DEDUCTION_TOOL_TYPES.RADAR) return { type: "circle", centre: finitePoint(constraint.centre), radiusMetres: Number(constraint.radiusMetres), answer: constraint.answer, label: constraintTitle(constraint) };
  if (constraint.type === DEDUCTION_TOOL_TYPES.THERMOMETER) return { type: "line", start: finitePoint(constraint.start), end: finitePoint(constraint.end), answer: constraint.answer, label: constraintTitle(constraint) };
  if (constraint.type === DEDUCTION_TOOL_TYPES.DISTANCE) {
    const seeker = finitePoint(constraint.seeker);
    const target = finitePoint(constraint.target);
    return { type: "distance", seeker, target, radiusMetres: seeker && target ? haversineMetres(seeker, target) : null, answer: constraint.answer, label: constraintTitle(constraint) };
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.THAMES) return { type: "thames", line: THAMES_CENTRELINE, answer: constraint.answer, label: constraintTitle(constraint) };
  if (constraint.type === DEDUCTION_TOOL_TYPES.MANUAL_AREA) {
    if (constraint.shape === "circle") return { type: "circle", centre: finitePoint(constraint.centre), radiusMetres: Number(constraint.radiusMetres), answer: constraint.answer, label: constraintTitle(constraint) };
    if (Array.isArray(constraint.polygon)) return { type: "polygon", points: constraint.polygon, answer: constraint.answer, label: constraintTitle(constraint) };
  }
  if ([
    DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_MATCH,
    DEDUCTION_TOOL_TYPES.REGION_MATCH,
    DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE,
    DEDUCTION_TOOL_TYPES.NEAREST_STATION_DISTANCE,
    DEDUCTION_TOOL_TYPES.TENTACLE
  ].includes(constraint.type)) {
    const runtime = prepareConstraint(constraint, context);
    return {
      type: "reference",
      seeker: finitePoint(constraint.seeker),
      referenceFeature: runtime.referenceFeature || runtime.answerFeature || null,
      answer: constraint.answer,
      label: constraintTitle(constraint),
      ready: runtime.ready
    };
  }
  return null;
}

export function lineStopIds(lineId) {
  return stationsForLine(lineId);
}

export function lineName(lineId) {
  return RAIL_LINE_BY_ID.get(lineId)?.name || lineId || "Unknown line";
}

export function stationGeo() {
  return STATION_GEO;
}
