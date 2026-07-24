import { DEFAULT_DURATIONS } from "./constants.js";
import { haversineMetres } from "./geo.js";
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

export const DEDUCTION_TOOL_TYPES = Object.freeze({
  RADAR: "radar",
  THERMOMETER: "thermometer",
  DISTANCE: "distance",
  STATION_NAME: "station-name-length",
  TRANSIT: "transit-line",
  THAMES: "thames-side"
});

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
    showZones: false,
    filter: "remaining",
    undoStack: []
  };
}

export function normaliseDeductionRoundState(value = {}) {
  return {
    ...createDeductionRoundState(),
    ...(value || {}),
    constraints: Array.isArray(value?.constraints) ? value.constraints : [],
    stationOverrides: value?.stationOverrides && typeof value.stationOverrides === "object" ? value.stationOverrides : {},
    ignoredAutoConstraintIds: Array.isArray(value?.ignoredAutoConstraintIds) ? value.ignoredAutoConstraintIds : [],
    undoStack: Array.isArray(value?.undoStack) ? value.undoStack : []
  };
}

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

function pointPass(constraint, point) {
  const answer = canonicalAnswer(constraint.answer);
  if (constraint.type === DEDUCTION_TOOL_TYPES.RADAR) {
    const centre = finitePoint(constraint.centre);
    const radius = Number(constraint.radiusMetres);
    if (!centre || !Number.isFinite(radius) || radius <= 0) return null;
    const inside = haversineMetres(point, centre) <= radius;
    if (answer === "yes" || answer === "inside") return inside;
    if (answer === "no" || answer === "outside") return !inside;
    return null;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.THERMOMETER) {
    const start = finitePoint(constraint.start);
    const end = finitePoint(constraint.end);
    if (!start || !end) return null;
    const startDistance = haversineMetres(point, start);
    const endDistance = haversineMetres(point, end);
    if (answer === "hotter") return endDistance < startDistance;
    if (answer === "colder") return endDistance > startDistance;
    return null;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.DISTANCE) {
    const seeker = finitePoint(constraint.seeker);
    const target = finitePoint(constraint.target);
    if (!seeker || !target) return null;
    const seekerDistance = haversineMetres(seeker, target);
    const hiderDistance = haversineMetres(point, target);
    if (answer === "closer") return hiderDistance < seekerDistance;
    if (answer === "further") return hiderDistance > seekerDistance;
    return null;
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.THAMES) {
    const seekerSide = constraint.seekerSide || "unknown";
    const hiderSide = thamesSide(point);
    const same = seekerSide === "both" || hiderSide === "both" || seekerSide === hiderSide;
    if (answer === "yes" || answer === "same") return same;
    if (answer === "no" || answer === "different") return !same;
    return null;
  }
  return null;
}

export function constraintTitle(constraint) {
  if (constraint.label) return constraint.label;
  if (constraint.type === DEDUCTION_TOOL_TYPES.RADAR) return `${formatRadius(constraint.radiusMetres)} radar · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.THERMOMETER) return `Thermometer · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.DISTANCE) return `Exact reference distance · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.STATION_NAME) return `Station name length · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.TRANSIT) return `Transit line · ${titleCase(constraint.answer)}`;
  if (constraint.type === DEDUCTION_TOOL_TYPES.THAMES) return `Thames side · ${titleCase(constraint.answer)}`;
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

export function evaluateStationPossibilities({ stations, constraints = [], stationOverrides = {}, radiusMetres = DEFAULT_DURATIONS.hidingZoneRadiusMetres } = {}) {
  const sourceStations = stations || [];
  return sourceStations.map((station) => {
    const geo = STATION_GEO_BY_ID.get(station.id) || station;
    const samples = sampleZonePoints(geo, radiusMetres);
    const failures = [];
    const partials = [];
    const passes = [];
    const stationConstraints = constraints.filter((constraint) => [DEDUCTION_TOOL_TYPES.STATION_NAME, DEDUCTION_TOOL_TYPES.TRANSIT].includes(constraint.type));
    const locationConstraints = constraints.filter((constraint) => !stationConstraints.includes(constraint));

    for (const constraint of stationConstraints) {
      const pass = stationLevelPass(constraint, station, geo);
      if (pass === false) failures.push(explainConstraint(constraint));
      else if (pass === true) passes.push(explainConstraint(constraint));
    }

    const mobile = locationConstraints.filter((constraint) => constraint.movementMode !== DEDUCTION_MOVEMENT.LOCKED);
    for (const constraint of mobile) {
      const mask = samples.map((point) => pointPass(constraint, point));
      const valid = mask.filter((value) => value === true).length;
      const evaluated = mask.filter((value) => value !== null).length;
      if (evaluated && valid === 0) failures.push(explainConstraint(constraint));
      else if (valid > 0 && valid < evaluated) partials.push(explainConstraint(constraint));
      else if (valid === evaluated && evaluated) passes.push(explainConstraint(constraint));
    }

    const locked = locationConstraints.filter((constraint) => constraint.movementMode === DEDUCTION_MOVEMENT.LOCKED);
    if (locked.length && samples.length) {
      const common = samples.filter((point) => locked.every((constraint) => pointPass(constraint, point) === true));
      if (!common.length) failures.push(`No sampled point satisfies all ${locked.length} endgame-locked constraints together`);
      else if (common.length < samples.length) partials.push(`${common.length} of ${samples.length} sampled points remain after endgame intersection`);
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
      passes,
      override,
      sampleCount: samples.length
    };
  });
}

function movementModeFromInput(input, question) {
  if (input?.movementMode === DEDUCTION_MOVEMENT.LOCKED) return DEDUCTION_MOVEMENT.LOCKED;
  if (question?.answeredPhase === "endgame" || question?.phase === "endgame") return DEDUCTION_MOVEMENT.LOCKED;
  return DEDUCTION_MOVEMENT.MOBILE;
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
  return null;
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

export function constraintOverlay(constraint) {
  if (constraint.type === DEDUCTION_TOOL_TYPES.RADAR) return { type: "circle", centre: finitePoint(constraint.centre), radiusMetres: Number(constraint.radiusMetres), answer: constraint.answer, label: constraintTitle(constraint) };
  if (constraint.type === DEDUCTION_TOOL_TYPES.THERMOMETER) return { type: "line", start: finitePoint(constraint.start), end: finitePoint(constraint.end), answer: constraint.answer, label: constraintTitle(constraint) };
  if (constraint.type === DEDUCTION_TOOL_TYPES.DISTANCE) {
    const seeker = finitePoint(constraint.seeker);
    const target = finitePoint(constraint.target);
    return { type: "distance", seeker, target, radiusMetres: seeker && target ? haversineMetres(seeker, target) : null, answer: constraint.answer, label: constraintTitle(constraint) };
  }
  if (constraint.type === DEDUCTION_TOOL_TYPES.THAMES) return { type: "thames", line: THAMES_CENTRELINE, answer: constraint.answer, label: constraintTitle(constraint) };
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
