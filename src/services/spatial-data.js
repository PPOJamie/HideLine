import { GAME_MAP_KML_URL } from "../core/constants.js";
import { inferSpatialCategory, normaliseSpatialData, normaliseSpatialFeature, spatialDataStats } from "../core/spatial.js";

const MAX_FEATURES = 12_000;
const MAX_POINTS_PER_PATH = 750;

function textDecoder() {
  return new TextDecoder("utf-8");
}

function decodeBytes(bytes) {
  return textDecoder().decode(bytes);
}

function readUint16(view, offset) {
  return view.getUint16(offset, true);
}

function readUint32(view, offset) {
  return view.getUint32(offset, true);
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") throw new Error("This browser cannot unpack KMZ files. Export the Google map as plain KML instead.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Extract the first .kml entry from a KMZ/ZIP file without a third-party library. */
export async function extractKmlFromKmz(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  let eocd = -1;
  for (let offset = Math.max(0, bytes.length - 65_557); offset <= bytes.length - 22; offset += 1) {
    if (readUint32(view, offset) === 0x06054b50) eocd = offset;
  }
  if (eocd < 0) throw new Error("The KMZ file does not contain a valid ZIP directory.");
  const entryCount = readUint16(view, eocd + 10);
  let cursor = readUint32(view, eocd + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(view, cursor) !== 0x02014b50) throw new Error("The KMZ directory is malformed.");
    const method = readUint16(view, cursor + 10);
    const compressedSize = readUint32(view, cursor + 20);
    const nameLength = readUint16(view, cursor + 28);
    const extraLength = readUint16(view, cursor + 30);
    const commentLength = readUint16(view, cursor + 32);
    const localOffset = readUint32(view, cursor + 42);
    const name = decodeBytes(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    if (/\.kml$/i.test(name)) {
      if (readUint32(view, localOffset) !== 0x04034b50) throw new Error("The KMZ KML entry is malformed.");
      const localNameLength = readUint16(view, localOffset + 26);
      const localExtraLength = readUint16(view, localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
      if (method === 0) return decodeBytes(compressed);
      if (method === 8) return decodeBytes(await inflateRaw(compressed));
      throw new Error(`The KMZ uses unsupported compression method ${method}. Export as plain KML instead.`);
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("No KML document was found inside the KMZ file.");
}

function elementChildren(node, localName = null) {
  return [...(node?.children || [])].filter((child) => !localName || child.localName === localName);
}

function firstDescendant(node, localName) {
  return [...(node?.getElementsByTagNameNS?.("*", localName) || [])][0] || null;
}

function nodeText(node, localName) {
  return firstDescendant(node, localName)?.textContent?.trim() || "";
}

function folderPath(node) {
  const names = [];
  let cursor = node?.parentElement;
  while (cursor) {
    if (cursor.localName === "Folder" || cursor.localName === "Document") {
      const directName = elementChildren(cursor, "name")[0]?.textContent?.trim();
      if (directName) names.unshift(directName);
    }
    cursor = cursor.parentElement;
  }
  return names.join(" / ");
}

function parseCoordinateText(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .map((token) => token.split(",").slice(0, 2).map(Number))
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
}

function decimatePath(path = [], limit = MAX_POINTS_PER_PATH) {
  if (path.length <= limit) return path;
  const step = Math.ceil(path.length / limit);
  const result = path.filter((_, index) => index % step === 0);
  if (path.length && result.at(-1) !== path.at(-1)) result.push(path.at(-1));
  return result;
}

function parsePointNode(node) {
  const coordinate = parseCoordinateText(nodeText(node, "coordinates"))[0];
  return coordinate ? { type: "Point", coordinates: coordinate } : null;
}

function parseLineNode(node) {
  const coordinates = decimatePath(parseCoordinateText(nodeText(node, "coordinates")));
  return coordinates.length >= 2 ? { type: "LineString", coordinates } : null;
}

function parsePolygonNode(node) {
  const outer = firstDescendant(firstDescendant(node, "outerBoundaryIs"), "LinearRing");
  const outerCoordinates = decimatePath(parseCoordinateText(nodeText(outer, "coordinates")));
  if (outerCoordinates.length < 3) return null;
  const rings = [outerCoordinates];
  const innerNodes = [...(node.getElementsByTagNameNS?.("*", "innerBoundaryIs") || [])];
  for (const innerNode of innerNodes) {
    const ringNode = firstDescendant(innerNode, "LinearRing");
    const coordinates = decimatePath(parseCoordinateText(nodeText(ringNode, "coordinates")));
    if (coordinates.length >= 3) rings.push(coordinates);
  }
  return { type: "Polygon", coordinates: rings };
}

function placemarkGeometries(placemark) {
  const geometries = [];
  const points = [...(placemark.getElementsByTagNameNS?.("*", "Point") || [])];
  const lines = [...(placemark.getElementsByTagNameNS?.("*", "LineString") || [])];
  const polygons = [...(placemark.getElementsByTagNameNS?.("*", "Polygon") || [])];
  for (const node of points) {
    const geometry = parsePointNode(node);
    if (geometry) geometries.push(geometry);
  }
  for (const node of lines) {
    const geometry = parseLineNode(node);
    if (geometry) geometries.push(geometry);
  }
  for (const node of polygons) {
    const geometry = parsePolygonNode(node);
    if (geometry) geometries.push(geometry);
  }
  return geometries;
}

function extendedDataText(placemark) {
  const parts = [];
  for (const data of [...(placemark.getElementsByTagNameNS?.("*", "Data") || [])]) {
    const name = data.getAttribute("name") || "";
    const value = nodeText(data, "value");
    if (name || value) parts.push(`${name} ${value}`);
  }
  for (const data of [...(placemark.getElementsByTagNameNS?.("*", "SimpleData") || [])]) {
    parts.push(`${data.getAttribute("name") || ""} ${data.textContent || ""}`);
  }
  return parts.join(" ");
}

export function parseKmlText(text, sourceName = "Google My Maps KML") {
  if (typeof DOMParser !== "function") throw new Error("KML import requires a web browser with DOMParser support.");
  const document = new DOMParser().parseFromString(text, "application/xml");
  const parserError = firstDescendant(document, "parsererror");
  if (parserError) throw new Error("The KML file could not be parsed. Export it again as KML or KMZ.");
  const placemarks = [...(document.getElementsByTagNameNS?.("*", "Placemark") || [])];
  const features = [];
  for (let index = 0; index < placemarks.length && features.length < MAX_FEATURES; index += 1) {
    const placemark = placemarks[index];
    const name = nodeText(placemark, "name") || `Map feature ${index + 1}`;
    const description = nodeText(placemark, "description");
    const layer = folderPath(placemark);
    const category = inferSpatialCategory(layer, name, description, extendedDataText(placemark));
    const geometries = placemarkGeometries(placemark);
    for (let geometryIndex = 0; geometryIndex < geometries.length && features.length < MAX_FEATURES; geometryIndex += 1) {
      const feature = normaliseSpatialFeature({
        id: `kml:${index}:${geometryIndex}`,
        geometry: geometries[geometryIndex],
        properties: { name, layer, category, description, source: sourceName }
      }, features.length);
      if (feature) features.push(feature);
    }
  }
  if (!features.length) throw new Error("The file contained no usable points, lines or polygons.");
  return normaliseSpatialData({ sourceName, importedAt: new Date().toISOString(), features });
}

function flattenGeoJsonFeatures(input) {
  if (!input) return [];
  if (input.type === "FeatureCollection") return input.features || [];
  if (input.type === "Feature") return [input];
  if (input.type && input.coordinates) return [{ type: "Feature", geometry: input, properties: {} }];
  return [];
}

export function parseGeoJsonText(text, sourceName = "GeoJSON map data") {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw new Error("The GeoJSON/JSON file is not valid JSON."); }
  const rawFeatures = flattenGeoJsonFeatures(parsed).slice(0, MAX_FEATURES);
  const features = rawFeatures.map((feature, index) => {
    const properties = feature.properties || {};
    const layer = String(properties.layer || properties.folder || properties.Layer || "");
    const name = String(properties.name || properties.Name || `Map feature ${index + 1}`);
    return normaliseSpatialFeature({
      ...feature,
      properties: {
        ...properties,
        name,
        layer,
        category: properties.category || inferSpatialCategory(layer, name, properties.description || ""),
        source: sourceName
      }
    }, index);
  }).filter(Boolean);
  if (!features.length) throw new Error("The GeoJSON file contained no usable features.");
  return normaliseSpatialData({ sourceName, importedAt: new Date().toISOString(), features });
}

export async function parseSpatialDataFile(file) {
  if (!file) throw new Error("Choose a KML, KMZ or GeoJSON file first.");
  const name = file.name || "Imported map data";
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "kmz") return parseKmlText(await extractKmlFromKmz(await file.arrayBuffer()), name);
  const text = await file.text();
  if (extension === "kml" || /^\s*</.test(text)) return parseKmlText(text, name);
  if (["geojson", "json"].includes(extension) || /^\s*[\[{]/.test(text)) return parseGeoJsonText(text, name);
  throw new Error("Unsupported map-data file. Use KML, KMZ, GeoJSON or JSON.");
}

export async function fetchConfiguredSpatialData() {
  let response;
  try {
    response = await fetch(GAME_MAP_KML_URL, { mode: "cors", credentials: "omit", cache: "no-store" });
  } catch {
    throw new Error("Google blocked the direct map-data download. Export the My Map as KML/KMZ and import the file instead.");
  }
  if (!response.ok) throw new Error(`The configured map-data download returned HTTP ${response.status}. Export and import the KML/KMZ file instead.`);
  const text = await response.text();
  return parseKmlText(text, "Configured Google My Map");
}

export function spatialDataSummary(value) {
  const stats = spatialDataStats(value);
  const usable = Object.entries(stats.categories).filter(([category]) => category !== "unknown");
  return {
    ...stats,
    classified: usable.reduce((sum, [, count]) => sum + count, 0),
    categoryList: usable.sort((a, b) => b[1] - a[1])
  };
}
