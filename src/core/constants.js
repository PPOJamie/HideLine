export const APP_NAME = "HideLine";
export const APP_VERSION = "2.1.2";
export const STORAGE_KEY = "hideline:v1:state";
export const SETTINGS_KEY = "hideline:v1:settings";
export const SUPABASE_MODULE_URL = "https://esm.sh/@supabase/supabase-js@2?bundle";
export const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
export const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const RUNTIME_CONFIG = typeof window !== "undefined" ? window.HIDELINE_CONFIG || {} : {};
export const GAME_MAP_ID = RUNTIME_CONFIG.googleMapId || "1lDtKjR7rN1zelD3FjepU1XNvHmnb774";
export const GAME_MAP_URL = `https://www.google.com/maps/d/viewer?mid=${GAME_MAP_ID}`;
export const GAME_MAP_EMBED_URL = `https://www.google.com/maps/d/embed?mid=${GAME_MAP_ID}`;
export const GAME_MAP_KML_URL = `https://www.google.com/maps/d/kml?mid=${GAME_MAP_ID}&forcekml=1`;
export const HANDBOOK_FILE = "Hide and Seek_London_SG2Rs45_Handbook9.pdf";

export const DEFAULT_DURATIONS = Object.freeze({
  hidingPeriodSeconds: 45 * 60,
  seekingWindowSeconds: 4 * 60 * 60,
  roundCutoffSeconds: 4 * 60 * 60 + 45 * 60,
  standardAnswerSeconds: 5 * 60,
  photoAnswerSeconds: 10 * 60,
  invalidZonePenaltySeconds: -30 * 60,
  curseCureSeconds: 45 * 60,
  hidingZoneRadiusMetres: 500,
  foundDistanceMetres: 2,
  photoPauseThresholdSeconds: 10 * 60,
  handLimit: 6
});

export const PHASES = Object.freeze({
  LOBBY: "lobby",
  HIDING: "hiding",
  SEEKING: "seeking",
  ENDGAME: "endgame",
  COMPLETE: "complete"
});

export const TEAMS = Object.freeze({
  ALPHA: "alpha",
  BRAVO: "bravo"
});

export const TEAM_LABELS = Object.freeze({ alpha: "Team Alpha", bravo: "Team Bravo" });

export const VIEWS = Object.freeze({
  PLAY: "play",
  MAP: "map",
  QUESTIONS: "questions",
  TOOLS: "tools",
  RULES: "rules"
});

export const VIEW_META = Object.freeze({
  play: { title: "Game", subtitle: "Timer, teams and the next action" },
  map: { title: "Map", subtitle: "See what remains possible" },
  questions: { title: "Questions", subtitle: "Ask, answer and update the map" },
  tools: { title: "Game kit", subtitle: "Cards, traps and scoring" },
  rules: { title: "Quick rules", subtitle: "The essentials for fair play" }
});

export const LOCAL_ROOM_PREFIX = "LOCAL";
