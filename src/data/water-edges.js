import { THAMES_CENTRELINE } from "./thames-centreline.js";

/**
 * Built-in Central London water-edge atlas for the Body of Water question.
 *
 * The handbook measures to the nearest edge of a named blue water area. This
 * atlas provides planning-grade bank/shore geometry for the named rivers,
 * canals, basins, docks and park lakes most likely to be nearest inside the
 * HideLine game boundary. It is bundled with the app so the deduction map does
 * not depend on a live map-data request during play.
 *
 * River Thames banks are generated from HideLine's dense, bridge-anchored
 * centreline and variable half-width model. The remaining geometries are a
 * deliberately simplified game-day snapshot aligned to OpenStreetMap's
 * standard basemap. Players can still review or override the selected edge on
 * the map when a ruling is close.
 *
 * Data reference: © OpenStreetMap contributors, ODbL. River Thames reference
 * also checked against Greater London Authority open mapping.
 */

const SOURCE_NAME = "HideLine built-in Central London water-edge atlas";
const SOURCE_LABEL = "Built-in water-edge atlas (OpenStreetMap planning snapshot)";
const METRES_PER_DEGREE_LAT = 111_320;

function point(lat, lng, halfWidthMetres = null) {
  return { lat: Number(lat), lng: Number(lng), halfWidthMetres };
}

function coordinate(value) {
  return [Number(value.lng), Number(value.lat)];
}

function metresPerDegreeLng(lat) {
  return METRES_PER_DEGREE_LAT * Math.cos((Number(lat) * Math.PI) / 180);
}

function offsetPoint(value, eastMetres, northMetres) {
  return {
    lat: Number(value.lat) + northMetres / METRES_PER_DEGREE_LAT,
    lng: Number(value.lng) + eastMetres / (metresPerDegreeLng(value.lat) || Number.EPSILON)
  };
}

function tangentAt(points, index) {
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const meanLat = (Number(previous.lat) + Number(next.lat)) / 2;
  const east = (Number(next.lng) - Number(previous.lng)) * metresPerDegreeLng(meanLat);
  const north = (Number(next.lat) - Number(previous.lat)) * METRES_PER_DEGREE_LAT;
  const length = Math.hypot(east, north) || 1;
  return { east: east / length, north: north / length };
}

function bankLines(points, defaultHalfWidthMetres = 7) {
  const left = [];
  const right = [];
  points.forEach((value, index) => {
    const tangent = tangentAt(points, index);
    const width = Number(value.halfWidthMetres) || defaultHalfWidthMetres;
    const normalEast = -tangent.north;
    const normalNorth = tangent.east;
    left.push(coordinate(offsetPoint(value, normalEast * width, normalNorth * width)));
    right.push(coordinate(offsetPoint(value, -normalEast * width, -normalNorth * width)));
  });
  return [left, right];
}

function corridorRing(points, defaultHalfWidthMetres = 7) {
  const [left, right] = bankLines(points, defaultHalfWidthMetres);
  const ring = [...left, ...right.reverse()];
  if (ring.length && (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])) ring.push([...ring[0]]);
  return ring;
}

function ellipseRing(lat, lng, eastRadiusMetres, northRadiusMetres, rotationDegrees = 0, vertices = 32) {
  const centre = point(lat, lng);
  const rotation = (rotationDegrees * Math.PI) / 180;
  const ring = [];
  for (let index = 0; index <= vertices; index += 1) {
    const angle = (index / vertices) * Math.PI * 2;
    const x = Math.cos(angle) * eastRadiusMetres;
    const y = Math.sin(angle) * northRadiusMetres;
    const east = x * Math.cos(rotation) - y * Math.sin(rotation);
    const north = x * Math.sin(rotation) + y * Math.cos(rotation);
    ring.push(coordinate(offsetPoint(centre, east, north)));
  }
  return ring;
}

function lineFeature(id, name, points, halfWidthMetres = 7, description = "") {
  return {
    id: `built-in-water:${id}`,
    name,
    category: "water",
    layer: "Built-in named water edges",
    source: SOURCE_LABEL,
    geometry: { type: "MultiLineString", coordinates: bankLines(points, halfWidthMetres) },
    properties: { description: description || `${name}: simplified left and right bank edges.` }
  };
}

function corridorFeature(id, name, points, halfWidthMetres = 7, description = "") {
  return {
    id: `built-in-water:${id}`,
    name,
    category: "water",
    layer: "Built-in named water edges",
    source: SOURCE_LABEL,
    geometry: { type: "Polygon", coordinates: [corridorRing(points, halfWidthMetres)] },
    properties: { description: description || `${name}: simplified water polygon.` }
  };
}

function ellipseFeature(id, name, lat, lng, eastRadiusMetres, northRadiusMetres, rotationDegrees = 0, description = "") {
  return {
    id: `built-in-water:${id}`,
    name,
    category: "water",
    layer: "Built-in named water edges",
    source: SOURCE_LABEL,
    geometry: { type: "Polygon", coordinates: [ellipseRing(lat, lng, eastRadiusMetres, northRadiusMetres, rotationDegrees)] },
    properties: { description: description || `${name}: simplified shoreline polygon.` }
  };
}

function multipolygonFeature(id, name, rings, description = "") {
  return {
    id: `built-in-water:${id}`,
    name,
    category: "water",
    layer: "Built-in named water edges",
    source: SOURCE_LABEL,
    geometry: { type: "MultiPolygon", coordinates: rings.map((ring) => [ring]) },
    properties: { description: description || `${name}: simplified connected dock basins.` }
  };
}

const REGENTS_CANAL = [
  point(51.52165, -0.18375), point(51.52400, -0.18115), point(51.52680, -0.17685),
  point(51.52940, -0.17010), point(51.53120, -0.16230), point(51.53315, -0.15515),
  point(51.53445, -0.14775), point(51.53520, -0.14015), point(51.53535, -0.13300),
  point(51.53445, -0.12665), point(51.53335, -0.12115), point(51.53210, -0.11620),
  point(51.53215, -0.11025), point(51.53230, -0.10455), point(51.53165, -0.09940),
  point(51.53155, -0.09330), point(51.53205, -0.08715), point(51.53320, -0.08035),
  point(51.53470, -0.07355), point(51.53565, -0.06655), point(51.53610, -0.05940),
  point(51.53620, -0.05270), point(51.53525, -0.04670), point(51.53255, -0.04235),
  point(51.52890, -0.04025), point(51.52450, -0.03915), point(51.51985, -0.03890),
  point(51.51575, -0.03920), point(51.51255, -0.03895)
];

const GRAND_UNION_PADDINGTON_ARM = [
  point(51.52215, -0.21850), point(51.52245, -0.21100), point(51.52275, -0.20330),
  point(51.52295, -0.19600), point(51.52270, -0.19000), point(51.52165, -0.18375)
];

const PADDINGTON_BASIN = [
  point(51.52165, -0.18375, 17), point(51.52065, -0.18125, 20), point(51.51955, -0.17835, 24),
  point(51.51880, -0.17510, 28), point(51.51835, -0.17115, 34)
];

const LONG_WATER = [
  point(51.51010, -0.17780, 42), point(51.50875, -0.17670, 46), point(51.50720, -0.17480, 48),
  point(51.50565, -0.17155, 46)
];

const SERPENTINE = [
  point(51.50565, -0.17155, 48), point(51.50545, -0.16780, 50), point(51.50520, -0.16360, 48),
  point(51.50485, -0.15940, 46), point(51.50435, -0.15445, 42)
];

const ST_JAMES_LAKE = [
  point(51.50305, -0.13655, 30), point(51.50275, -0.13375, 34), point(51.50220, -0.13110, 34),
  point(51.50165, -0.12880, 28)
];

const REGENTS_PARK_LAKE = [
  point(51.53160, -0.15875, 42), point(51.53110, -0.15640, 48), point(51.53035, -0.15375, 45),
  point(51.52955, -0.15140, 38)
];

const BATTERSEA_PARK_LAKE = [
  point(51.47890, -0.16205, 38), point(51.47915, -0.16025, 45), point(51.47955, -0.15830, 42),
  point(51.48000, -0.15655, 30)
];

const CHELSEA_CREEK = [
  point(51.47610, -0.18325), point(51.47775, -0.18455), point(51.47950, -0.18535),
  point(51.48120, -0.18605), point(51.48255, -0.18660)
];

const RIVER_WANDLE = [
  point(51.44920, -0.19300), point(51.45200, -0.19260), point(51.45520, -0.19200),
  point(51.45800, -0.19120), point(51.46065, -0.19035), point(51.46230, -0.18945)
];

const HERTFORD_UNION_CANAL = [
  point(51.53605, -0.04530), point(51.53500, -0.04150), point(51.53400, -0.03760)
];

const LIMEHOUSE_CUT = [
  point(51.51245, -0.03830), point(51.51565, -0.03380), point(51.51900, -0.02980)
];

const ORNAMENTAL_CANAL = [
  point(51.50785, -0.07020), point(51.50745, -0.06650), point(51.50745, -0.06240),
  point(51.50785, -0.05840)
];

const THAMES_BANKS = lineFeature(
  "river-thames",
  "River Thames",
  THAMES_CENTRELINE,
  120,
  "Variable-width north and south bank guides generated from the bridge-anchored HideLine Thames model."
);

const WATER_FEATURES = [
  THAMES_BANKS,
  lineFeature("regents-canal", "Regent's Canal", REGENTS_CANAL, 8),
  lineFeature("grand-union-paddington-arm", "Grand Union Canal (Paddington Arm)", GRAND_UNION_PADDINGTON_ARM, 9),
  corridorFeature("paddington-basin", "Paddington Basin", PADDINGTON_BASIN, 24),
  ellipseFeature("little-venice", "Little Venice", 51.52172, -0.18365, 72, 50, -20),
  ellipseFeature("battlebridge-basin", "Battlebridge Basin", 51.53520, -0.12205, 72, 36, 8),
  ellipseFeature("city-road-basin", "City Road Basin", 51.53160, -0.09760, 145, 42, 8),
  ellipseFeature("wenlock-basin", "Wenlock Basin", 51.53145, -0.09075, 118, 32, 0),
  ellipseFeature("kingsland-basin", "Kingsland Basin", 51.53670, -0.07615, 92, 32, 4),
  ellipseFeature("limehouse-basin", "Limehouse Basin", 51.51245, -0.03875, 185, 105, -8),
  lineFeature("hertford-union-canal", "Hertford Union Canal", HERTFORD_UNION_CANAL, 7),
  lineFeature("limehouse-cut", "Limehouse Cut", LIMEHOUSE_CUT, 8),
  lineFeature("chelsea-creek", "Chelsea Creek", CHELSEA_CREEK, 13),
  lineFeature("river-wandle", "River Wandle", RIVER_WANDLE, 7),
  lineFeature("ornamental-canal", "Ornamental Canal", ORNAMENTAL_CANAL, 7),
  multipolygonFeature("st-katharine-docks", "St Katharine Docks", [
    ellipseRing(51.50685, -0.07140, 105, 62, 4),
    ellipseRing(51.50745, -0.07305, 78, 52, -8),
    ellipseRing(51.50815, -0.07130, 78, 48, 5)
  ]),
  ellipseFeature("hermitage-basin", "Hermitage Basin", 51.50810, -0.05985, 78, 38, 8),
  ellipseFeature("shadwell-basin", "Shadwell Basin", 51.50825, -0.05620, 205, 105, -5),
  ellipseFeature("greenland-dock", "Greenland Dock", 51.49530, -0.04170, 100, 315, -1),
  ellipseFeature("south-dock", "South Dock", 51.49845, -0.04015, 72, 205, -2),
  ellipseFeature("canada-water", "Canada Water", 51.49765, -0.04955, 86, 70, 6),
  corridorFeature("long-water", "Long Water", LONG_WATER, 45),
  corridorFeature("the-serpentine", "The Serpentine", SERPENTINE, 47),
  ellipseFeature("round-pond", "Round Pond", 51.50395, -0.18055, 98, 83, 0),
  corridorFeature("st-jamess-park-lake", "St James's Park Lake", ST_JAMES_LAKE, 32),
  corridorFeature("regents-park-boating-lake", "Regent's Park Boating Lake", REGENTS_PARK_LAKE, 44),
  ellipseFeature("regents-park-model-boating-pond", "Regent's Park Model Boating Pond", 51.53265, -0.15775, 75, 42, -5),
  corridorFeature("battersea-park-boating-lake", "Battersea Park Boating Lake", BATTERSEA_PARK_LAKE, 40),
  ellipseFeature("burgess-park-lake", "Burgess Park Lake", 51.48310, -0.07845, 105, 54, 4),
  ellipseFeature("southwark-park-lake", "Southwark Park Lake", 51.49420, -0.05820, 96, 48, 0),
  ellipseFeature("long-pond-clapham-common", "Long Pond (Clapham Common)", 51.45770, -0.15110, 112, 34, -8),
  ellipseFeature("eagle-pond-clapham-common", "Eagle Pond (Clapham Common)", 51.46110, -0.14170, 76, 46, -6),
  ellipseFeature("mount-pond-clapham-common", "Mount Pond (Clapham Common)", 51.45880, -0.13765, 66, 42, 8),
  ellipseFeature("peckham-rye-park-lake", "Peckham Rye Park Lake", 51.46065, -0.06710, 82, 42, -8),
  ellipseFeature("buckingham-palace-garden-lake", "Buckingham Palace Garden Lake", 51.50010, -0.14355, 118, 55, 6),
  ellipseFeature("victoria-park-west-lake", "West Lake (Victoria Park)", 51.53740, -0.04345, 116, 58, -6)
];

export const BUILT_IN_WATER_DATA = Object.freeze({
  version: 1,
  sourceName: SOURCE_NAME,
  importedAt: "2026-07-30T00:00:00.000Z",
  features: Object.freeze(WATER_FEATURES)
});

export const BUILT_IN_WATER_FEATURE_COUNT = WATER_FEATURES.length;
export const BUILT_IN_WATER_ATTRIBUTION =
  "Built-in Central London water-edge planning atlas. © OpenStreetMap contributors, ODbL; River Thames reference also checked against Greater London Authority open mapping.";
