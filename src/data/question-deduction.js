/**
 * Deduction-map capabilities for every handbook question.
 *
 * `automatic` entries create geometry as soon as the hider answers, provided the
 * required spatial layer has been imported. `guided` entries are still linked to
 * the audit trail, but need a seeker-drawn area because the clue cannot be
 * converted to geography reliably without judgement (for example photographs or
 * indoor floor/altitude comparisons).
 */

const automatic = (type, options = {}) => Object.freeze({ mode: "automatic", type, ...options });
const guided = (reason, options = {}) => Object.freeze({ mode: "guided", type: "manual-review", reason, ...options });

export const QUESTION_DEDUCTION = Object.freeze({
  "matching-rail-line": automatic("transit-line", { stationLevel: true }),
  "matching-station-name": automatic("station-name-length", { stationLevel: true }),
  "matching-street": automatic("nearest-feature-match", { category: "street_path", requiresSeekerPoint: true, dataLabel: "streets / paths" }),
  "matching-borough": automatic("region-match", { category: "borough", requiresSeekerPoint: true, dataLabel: "London borough polygons" }),
  "matching-constituency": automatic("region-match", { category: "constituency", requiresSeekerPoint: true, dataLabel: "constituency polygons" }),
  "matching-ward": automatic("region-match", { category: "ward", requiresSeekerPoint: true, dataLabel: "electoral ward polygons" }),
  "matching-landmass": automatic("thames-side", { requiresMovementMode: true }),
  "matching-park": automatic("nearest-feature-match", { category: "park", requiresSeekerPoint: true, dataLabel: "park POIs" }),
  "matching-zoo": automatic("nearest-feature-match", { category: "zoo", requiresSeekerPoint: true, dataLabel: "zoo POIs" }),
  "matching-museum": automatic("nearest-feature-match", { category: "museum", requiresSeekerPoint: true, dataLabel: "museum POIs" }),
  "matching-cinema": automatic("nearest-feature-match", { category: "cinema", requiresSeekerPoint: true, dataLabel: "movie-theatre POIs" }),
  "matching-hospital": automatic("nearest-feature-match", { category: "hospital", requiresSeekerPoint: true, dataLabel: "hospital POIs" }),
  "matching-library": automatic("nearest-feature-match", { category: "library", requiresSeekerPoint: true, dataLabel: "library POIs" }),
  "matching-consulate": automatic("nearest-feature-match", { category: "consulate", requiresSeekerPoint: true, dataLabel: "foreign-consulate POIs" }),

  "measuring-high-speed": automatic("nearest-feature-distance", { category: "high_speed_rail", requiresSeekerPoint: true, dataLabel: "high-speed railway lines" }),
  "measuring-station": automatic("nearest-station-distance", { requiresSeekerPoint: true }),
  "measuring-borough": automatic("nearest-feature-distance", { category: "borough", requiresSeekerPoint: true, boundaryOnly: true, dataLabel: "London borough polygons" }),
  "measuring-altitude": guided("Altitude and indoor-floor answers are not a reliable two-dimensional map boundary. Link the answer, then draw only the area you can fairly infer."),
  "measuring-water": automatic("nearest-feature-distance", { category: "water", requiresSeekerPoint: true, dataLabel: "named bodies of water" }),
  "measuring-park": automatic("nearest-feature-distance", { category: "park", requiresSeekerPoint: true, dataLabel: "park POIs" }),
  "measuring-zoo": automatic("nearest-feature-distance", { category: "zoo", requiresSeekerPoint: true, dataLabel: "zoo POIs" }),
  "measuring-aquarium": automatic("nearest-feature-distance", { category: "aquarium", requiresSeekerPoint: true, dataLabel: "aquarium POI" }),
  "measuring-museum": automatic("nearest-feature-distance", { category: "museum", requiresSeekerPoint: true, dataLabel: "museum POIs" }),
  "measuring-cinema": automatic("nearest-feature-distance", { category: "cinema", requiresSeekerPoint: true, dataLabel: "movie-theatre POIs" }),
  "measuring-hospital": automatic("nearest-feature-distance", { category: "hospital", requiresSeekerPoint: true, dataLabel: "hospital POIs" }),
  "measuring-library": automatic("nearest-feature-distance", { category: "library", requiresSeekerPoint: true, dataLabel: "library POIs" }),
  "measuring-consulate": automatic("nearest-feature-distance", { category: "consulate", requiresSeekerPoint: true, dataLabel: "foreign-consulate POIs" }),

  "thermometer-1": automatic("thermometer", { requiresEndpoints: true }),
  "thermometer-5": automatic("thermometer", { requiresEndpoints: true }),
  "thermometer-15": automatic("thermometer", { requiresEndpoints: true }),

  "radar-0-5": automatic("radar", { requiresSeekerPoint: true }),
  "radar-1": automatic("radar", { requiresSeekerPoint: true }),
  "radar-2": automatic("radar", { requiresSeekerPoint: true }),
  "radar-5": automatic("radar", { requiresSeekerPoint: true }),
  "radar-10": automatic("radar", { requiresSeekerPoint: true }),
  "radar-custom": automatic("radar", { requiresSeekerPoint: true }),

  "tentacles-museums": automatic("tentacle", { category: "museum", requiresSeekerPoint: true, dataLabel: "museum POIs" }),
  "tentacles-libraries": automatic("tentacle", { category: "library", requiresSeekerPoint: true, dataLabel: "library POIs" }),
  "tentacles-cinemas": automatic("tentacle", { category: "cinema", requiresSeekerPoint: true, dataLabel: "movie-theatre POIs" }),
  "tentacles-hospitals": automatic("tentacle", { category: "hospital", requiresSeekerPoint: true, dataLabel: "hospital POIs" }),

  "photo-tree": guided("A photograph needs human interpretation. Link it to a manual polygon or circle after the seeker team identifies a fair area."),
  "photo-sky": guided("A photograph needs human interpretation. Link it to a manual polygon or circle after the seeker team identifies a fair area."),
  "photo-selfie": guided("A photograph needs human interpretation. Link it to a manual polygon or circle after the seeker team identifies a fair area."),
  "photo-widest-street": guided("A photograph needs human interpretation. Link it to a manual polygon or circle after the seeker team identifies a fair area."),
  "photo-tallest-sightline": guided("A photograph needs human interpretation. Link it to a manual polygon or circle after the seeker team identifies a fair area."),
  "photo-building-station": guided("The station-related photograph can be reviewed against candidate stations, then linked to a manual area or manual station eliminations."),
  "photo-tallest-station": guided("The station-related photograph can be reviewed against candidate stations, then linked to a manual area or manual station eliminations."),
  "photo-trace-path": guided("The traced path needs human map matching. Once matched, draw the corresponding path area or manually eliminate stations."),
  "photo-two-buildings": guided("A photograph needs human interpretation. Link it to a manual polygon or circle after the seeker team identifies a fair area."),
  "photo-restaurant": guided("A photograph needs human interpretation. Link it to a manual polygon or circle after the seeker team identifies a fair area."),
  "photo-platform": guided("Review the platform image against candidate stations, then link the conclusion to manual station eliminations or an area mask."),
  "photo-park": guided("Review the photograph against imported parks, then link the fair conclusion to a manual area mask."),
  "photo-grocery": guided("A photograph needs human interpretation. Link it to a manual polygon or circle after the seeker team identifies a fair area."),
  "photo-worship": guided("A photograph needs human interpretation. Link it to a manual polygon or circle after the seeker team identifies a fair area."),
  "photo-field-view": guided("A photograph needs human interpretation. Link it to a manual polygon or circle after the seeker team identifies a fair area.")
});

export function questionDeductionConfig(questionOrId) {
  const id = typeof questionOrId === "string" ? questionOrId : questionOrId?.id;
  return QUESTION_DEDUCTION[id] || guided("This question is linked to the audit trail and can be converted to a manual map area after review.");
}

export function questionDeductionKind(questionOrId) {
  const config = questionDeductionConfig(questionOrId);
  return config.mode === "automatic" ? "Automatic area" : "Guided map review";
}
