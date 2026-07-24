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
  const match = decoded.match(/(-?\d{1,2}(?:\.\d+)?)\s*[,/]\s*(-?\d{1,3}(?:\.\d+)?)/);
  return match ? finitePoint({ lat: match[1], lng: match[2] }) : null;
}

function addPoint(list, seen, label, value, keyName = "") {
  const point = finitePoint(value);
  if (!point) return;
  const coordinateKey = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
  const identity = coordinateKey;
  if (seen.has(identity)) return;
  seen.add(identity);
  list.push({
    key: `${keyName || label}:${coordinateKey}`,
    label,
    lat: point.lat,
    lng: point.lng,
    text: formatCoordinates(point),
    url: googleMapsCoordinateUrl(point)
  });
}

export function questionLocations(record) {
  const input = record?.deductionInput || record?.deduction_input || {};
  const type = String(input.type || "");
  const locations = [];
  const seen = new Set();

  if (type === "radar") addPoint(locations, seen, "Seeker pin", input.centre, "centre");
  else if (type === "thermometer") {
    addPoint(locations, seen, "Journey start", input.start, "start");
    addPoint(locations, seen, "Journey end", input.end, "end");
  } else if (type === "distance") {
    addPoint(locations, seen, "Seeker pin", input.seeker, "seeker");
    addPoint(locations, seen, "Reference point", input.target, "target");
  } else if (type === "manual-area" && input.shape === "circle") {
    addPoint(locations, seen, "Area centre", input.centre, "centre");
  } else {
    addPoint(locations, seen, "Seeker pin", input.seeker, "seeker");
  }

  // Support older records and custom deduction data whose type is not recognised.
  if (!locations.length) {
    addPoint(locations, seen, "Seeker pin", input.centre, "centre");
    addPoint(locations, seen, "Journey start", input.start, "start");
    addPoint(locations, seen, "Journey end", input.end, "end");
    addPoint(locations, seen, "Seeker pin", input.seeker, "seeker");
    addPoint(locations, seen, "Reference point", input.target, "target");
  }

  const pinLabel = String(record?.pinLabel || record?.pin_label || "").trim();
  if (pinLabel) {
    const pinPoint = pointFromText(pinLabel);
    if (pinPoint) addPoint(locations, seen, "Shared pin", pinPoint, "pin-label");
    else {
      locations.push({
        key: `pin-label:${pinLabel}`,
        label: "Shared location",
        text: pinLabel,
        url: safeExternalUrl(pinLabel)
      });
    }
  }

  return locations;
}

export function questionLocationSummary(record) {
  return questionLocations(record)
    .map((location) => `${location.label}: ${location.text}`)
    .join(" · ");
}
