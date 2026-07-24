function finitePoint(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function formatCoordinates(point, digits = 6) {
  const valid = finitePoint(point);
  if (!valid) return "";
  return `${valid.lat.toFixed(digits)}, ${valid.lng.toFixed(digits)}`;
}

export function googleMapsCoordinateUrl(point) {
  const valid = finitePoint(point);
  if (!valid) return "";
  const query = `${valid.lat.toFixed(6)},${valid.lng.toFixed(6)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function safeExternalUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const base = typeof location !== "undefined" ? location.href : "https://example.invalid/";
    const url = new URL(text, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function pointFromText(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const decoded = (() => {
    try { return decodeURIComponent(text); } catch { return text; }
  })();

  // Handles plain "lat, lng", Google Maps q/query parameters and @lat,lng URLs.
  const match = decoded.match(/(?:@|(?:query|q)=)?\s*(-?\d{1,2}(?:\.\d+)?)\s*[,/]\s*(-?\d{1,3}(?:\.\d+)?)/i);
  return match ? finitePoint({ lat: match[1], lng: match[2] }) : null;
}

function addPoint(list, seen, label, value, keyName = "") {
  const point = finitePoint(value);
  if (!point) return;
  const coordinateKey = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
  if (seen.has(`point:${coordinateKey}`)) return;
  seen.add(`point:${coordinateKey}`);
  list.push({
    key: String(keyName || `${label}:${coordinateKey}`),
    label,
    lat: point.lat,
    lng: point.lng,
    text: formatCoordinates(point),
    url: googleMapsCoordinateUrl(point)
  });
}

function addTextLocation(list, seen, value, fallbackLabel = "Shared location") {
  if (!value || typeof value !== "object") return;
  const label = String(value.label || fallbackLabel).trim() || fallbackLabel;
  const point = finitePoint(value) || pointFromText(value.text) || pointFromText(value.url);
  if (point) {
    addPoint(list, seen, label, point, value.key || "explicit");
    return;
  }
  const text = String(value.text || value.url || "").trim();
  const url = safeExternalUrl(value.url || value.text);
  if (!text) return;
  const identity = `text:${url || text}`;
  if (seen.has(identity)) return;
  seen.add(identity);
  list.push({
    key: String(value.key || identity),
    label,
    text,
    url
  });
}

function explicitQuestionLocations(record) {
  const candidates = [record?.locations, record?.questionLocations, record?.locationData];
  return candidates.find(Array.isArray) || [];
}

/**
 * Return every location shared with a question in a stable, display-ready shape.
 *
 * Version 2.2.1 stores an explicit `locations` array on each question. Older
 * questions are still reconstructed from deductionInput and pinLabel so rooms
 * created by earlier releases remain compatible.
 */
export function questionLocations(record) {
  const input = record?.deductionInput || record?.deduction_input || {};
  const type = String(input.type || "");
  const locations = [];
  const seen = new Set();

  for (const location of explicitQuestionLocations(record)) addTextLocation(locations, seen, location);

  if (type === "radar") addPoint(locations, seen, "Seeker pin", input.centre || input.sharedPin, "centre");
  else if (type === "thermometer") {
    addPoint(locations, seen, "Journey start", input.start, "start");
    addPoint(locations, seen, "Journey end", input.end || input.sharedPin, "end");
  } else if (type === "distance") {
    addPoint(locations, seen, "Seeker pin", input.seeker || input.sharedPin, "seeker");
    addPoint(locations, seen, "Reference point", input.target, "target");
  } else if (type === "manual-area" && input.shape === "circle") {
    addPoint(locations, seen, "Area centre", input.centre, "centre");
  } else {
    addPoint(locations, seen, "Seeker pin", input.seeker || input.sharedPin, "seeker");
  }

  // Support older records and custom deduction data whose type is not recognised.
  if (!locations.length) {
    addPoint(locations, seen, "Seeker pin", input.centre, "centre");
    addPoint(locations, seen, "Journey start", input.start, "start");
    addPoint(locations, seen, "Journey end", input.end, "end");
    addPoint(locations, seen, "Seeker pin", input.seeker, "seeker");
    addPoint(locations, seen, "Reference point", input.target, "target");
    addPoint(locations, seen, "Question pin", input.sharedPin, "shared-pin");
  }

  const pinLabel = String(record?.pinLabel || record?.pin_label || "").trim();
  if (pinLabel) {
    const pinPoint = pointFromText(pinLabel);
    if (pinPoint) addPoint(locations, seen, "Shared pin", pinPoint, "pin-label");
    else addTextLocation(locations, seen, { key: `pin-label:${pinLabel}`, label: "Shared location", text: pinLabel, url: pinLabel });
  }

  return locations;
}

export function serialiseQuestionLocations(record) {
  return questionLocations(record).map(({ key, label, lat, lng, text, url }) => ({
    key,
    label,
    ...(Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : {}),
    text: String(text || ""),
    url: safeExternalUrl(url)
  }));
}

export function questionLocationSummary(record) {
  return questionLocations(record)
    .map((location) => `${location.label}: ${location.text}`)
    .join(" · ");
}
