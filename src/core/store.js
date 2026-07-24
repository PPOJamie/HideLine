import { DEFAULT_DURATIONS, PHASES, STORAGE_KEY, TEAMS, VIEWS } from "./constants.js";
import { emptyScore } from "./score.js";
import { randomId, roomCode } from "./format.js";

export function createDefaultState() {
  return {
    schemaVersion: 2,
    profile: {
      id: localStorage.getItem("hideline:device-id") || randomId("device"),
      name: "Player",
      team: TEAMS.ALPHA
    },
    ui: {
      view: new URLSearchParams(location.search).get("view") || VIEWS.PLAY,
      questionCategory: "all",
      questionSearch: "",
      mapMode: "authoritative",
      deductionTool: "radar",
      deductionSearch: "",
      deductionSelectedStationId: null,
      selectedTool: "score",
      installPromptAvailable: false
    },
    connection: {
      mode: "local",
      status: "offline",
      gameId: null,
      roomCode: null,
      supabaseUrl: window.HIDELINE_CONFIG?.supabaseUrl || localStorage.getItem("hideline:supabase-url") || "",
      supabaseAnonKey: window.HIDELINE_CONFIG?.supabaseAnonKey || localStorage.getItem("hideline:supabase-key") || "",
      lastSyncedAt: null,
      error: null
    },
    game: null,
    privateTeamState: {
      stationId: null,
      stationName: null,
      stationCoords: null,
      hidingSpotNote: "",
      cards: [],
      handLimit: DEFAULT_DURATIONS.handLimit,
      privateNotes: "",
      deductionByRound: {}
    },
    questions: [],
    events: [],
    positions: [],
    location: { sharing: false, shareWith: "team", current: null, error: null },
    tfl: { status: "idle", updatedAt: null, lines: [], error: null },
    checklist: {},
    settings: {
      repeatRewardMode: "multiply-both",
      locationPrecision: "precise",
      theme: "system",
      safetyContact: "",
      mapTileProvider: "osm"
    }
  };
}

export function createGameState({ name = "London Hide + Seek", code = roomCode(), hostId, mode = "local" } = {}) {
  const now = new Date().toISOString();
  return {
    id: mode === "local" ? randomId("game") : null,
    code,
    name,
    mode,
    hostId,
    createdAt: now,
    updatedAt: now,
    version: 1,
    phase: PHASES.LOBBY,
    round: 1,
    hiderTeam: TEAMS.ALPHA,
    teams: {
      alpha: { name: "Team Alpha" },
      bravo: { name: "Team Bravo" }
    },
    members: [],
    timers: {
      roundStartedAt: null,
      roundStoppedAt: null,
      pauses: [],
      hidingPeriodSeconds: DEFAULT_DURATIONS.hidingPeriodSeconds,
      seekingWindowSeconds: DEFAULT_DURATIONS.seekingWindowSeconds,
      cutoffSeconds: DEFAULT_DURATIONS.roundCutoffSeconds,
      foundAt: null
    },
    transit: {
      alpha: { active: false, startedAt: null, station: "", note: "" },
      bravo: { active: false, startedAt: null, station: "", note: "" }
    },
    scoreByRound: {
      1: emptyScore(),
      2: emptyScore()
    },
    traps: [],
    usedStations: [],
    settings: {
      autoEndgamePrompt: true,
      allowLocationSharing: true
    }
  };
}

function mergeDeep(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return source;
  const output = { ...(target || {}) };
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) output[key] = mergeDeep(output[key], value);
    else output[key] = value;
  }
  return output;
}

export class Store extends EventTarget {
  constructor() {
    super();
    const defaults = createDefaultState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      this.state = saved ? mergeDeep(defaults, saved) : defaults;
    } catch {
      this.state = defaults;
    }
    const requestedView = new URLSearchParams(location.search).get("view");
    if (requestedView && Object.values(VIEWS).includes(requestedView)) this.state.ui.view = requestedView;
    localStorage.setItem("hideline:device-id", this.state.profile.id);
  }

  get() { return this.state; }

  set(updater, { persist = true, source = "local" } = {}) {
    const next = typeof updater === "function" ? updater(structuredClone(this.state)) : mergeDeep(this.state, updater);
    this.state = next;
    if (persist) this.persist();
    this.dispatchEvent(new CustomEvent("change", { detail: { state: this.state, source } }));
    return this.state;
  }

  patch(path, value, options = {}) {
    return this.set((draft) => {
      const keys = Array.isArray(path) ? path : String(path).split(".");
      let cursor = draft;
      for (let index = 0; index < keys.length - 1; index += 1) {
        cursor[keys[index]] ??= {};
        cursor = cursor[keys[index]];
      }
      cursor[keys.at(-1)] = typeof value === "function" ? value(cursor[keys.at(-1)]) : value;
      return draft;
    }, options);
  }

  persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (error) { console.warn("State could not be persisted", error); }
  }

  reset() {
    this.state = createDefaultState();
    this.persist();
    this.dispatchEvent(new CustomEvent("change", { detail: { state: this.state, source: "reset" } }));
  }
}
