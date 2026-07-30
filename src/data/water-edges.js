/**
 * Retired in HideLine 2.3.4.
 *
 * Earlier versions bundled a hand-drawn planning atlas here. It was not
 * accurate enough for game rulings, so the active application now uses the
 * deployment-generated OpenStreetMap bank/shoreline snapshot in
 * data/osm-water.json, clipped to the supplied official Game Area polygon.
 *
 * These empty compatibility exports prevent an older mixed-cache client from
 * silently falling back to the retired geometry while a PWA update completes.
 */
export const BUILT_IN_WATER_DATA = Object.freeze({
  version: 1,
  sourceName: "Retired hand-drawn water atlas (not used)",
  importedAt: null,
  features: Object.freeze([])
});

export const BUILT_IN_WATER_FEATURE_COUNT = 0;
export const BUILT_IN_WATER_ATTRIBUTION =
  "Retired in HideLine 2.3.4. Active water geometry is generated from OpenStreetMap and clipped to the official Game Area.";
