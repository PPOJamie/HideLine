import { APP_VERSION, DEFAULT_DURATIONS, PHASES, STORAGE_KEY, TEAM_LABELS, TEAMS, VIEWS } from "./core/constants.js";
import { Store, createGameState } from "./core/store.js";
import { adjustmentTarget, calculateScore } from "./core/score.js";
import { activeElapsedSeconds, formatDuration, parseDurationParts, questionSecondsRemaining, toIso } from "./core/time.js";
import { downloadJson, escapeHtml, number, randomId, roomCode } from "./core/format.js";
import { haversineMetres } from "./core/geo.js";
import {
  DEDUCTION_MAP_MODES,
  DEDUCTION_MOVEMENT,
  DEDUCTION_TOOL_TYPES,
  createDeductionRoundState,
  normaliseDeductionRoundState
} from "./core/deduction.js";
import { QUESTION_BY_ID, repeatedReward } from "./data/questions.js";
import { questionDeductionConfig } from "./data/question-deduction.js";
import { STATIONS, STATION_BY_ID, stationNameLength } from "./data/stations.js";
import { STATION_GEO_BY_ID } from "./data/station-geo.js";
import { SupabaseSync } from "./services/supabase.js";
import { LocationService } from "./services/geolocation.js";
import { compressImage } from "./services/media.js";
import { clearEvidenceStore, getLocalEvidenceUrl, saveLocalEvidence } from "./services/evidence.js";
import { fetchTflStatus } from "./services/tfl.js";
import { fetchConfiguredSpatialData, parseSpatialDataFile } from "./services/spatial-data.js";
import { normaliseSpatialData } from "./core/spatial.js";
import { cachedStationCoordinates, resolveStationCoordinates } from "./services/stations.js";
import {
  beginDeductionMapPick,
  cancelDeductionMapPick,
  destroyDeductionMap,
  destroyZoneMap,
  focusDeductionStation,
  renderDeductionMap,
  renderMapFallback,
  renderZoneMap,
  updateZoneMap
} from "./services/map.js";
import { renderShell } from "./ui/shell.js";
import { renderPlay } from "./ui/play.js";
import { renderMapView } from "./ui/map-view.js";
import { buildDeductionViewModel } from "./ui/deduction-view.js";
import { renderQuestionsView } from "./ui/questions-view.js";
import { renderToolsView } from "./ui/tools-view.js";
import { renderRulesView } from "./ui/rules-view.js";
import { renderModal } from "./ui/modals.js";

class HideLineApp {
  constructor(root) {
    this.root = root;
    this.store = new Store();
    this.sync = new SupabaseSync();
    this.location = new LocationService();
    this.modalContext = null;
    this.deferredInstallPrompt = null;
    this.remoteRefreshTimer = null;
    this.renderTimer = null;
    this.locationUploadAt = 0;
    this.transitionLock = false;
    this.autoConnectAttempted = false;
    this.evidenceObjectUrl = null;
  }

  async init() {
    this.bindGlobalEvents();
    this.store.addEventListener("change", () => this.render());
    this.sync.addEventListener("remote-change", () => this.scheduleRemoteRefresh());
    this.sync.addEventListener("status", (event) => this.store.patch("connection.status", event.detail.status));
    this.sync.addEventListener("presence", () => this.scheduleRemoteRefresh());
    this.location.addEventListener("position", (event) => this.handlePosition(event.detail));
    this.location.addEventListener("error", (event) => this.handleLocationError(event.detail));
    this.render();
    this.startClock();
    this.registerServiceWorker();
    await this.autoConnect();
    const joinCode = new URLSearchParams(location.search).get("join");
    if (joinCode && !this.store.get().game) this.openModal("join-game");
  }

  bindGlobalEvents() {
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("submit", (event) => this.handleSubmit(event));
    this.root.addEventListener("input", (event) => this.handleInput(event));
    this.root.addEventListener("change", (event) => this.handleChange(event));
    this.root.addEventListener("close", (event) => {
      if (event.target?.id !== "app-modal") return;
      this.modalContext = null;
      this.revokeEvidenceUrl();
    }, true);
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      this.deferredInstallPrompt = event;
      this.store.patch("ui.installPromptAvailable", true);
    });
    window.addEventListener("appinstalled", () => {
      this.deferredInstallPrompt = null;
      this.store.patch("ui.installPromptAvailable", false);
      this.toast("HideLine was installed.", "success");
    });
    window.addEventListener("online", () => {
      if (this.store.get().connection.mode === "connected") this.store.patch("connection.status", "online");
    });
    window.addEventListener("offline", () => this.store.patch("connection.status", "offline"));
  }

  render({ preserveFocus = true } = {}) {
    const focus = preserveFocus ? this.captureFocus() : null;
    const state = this.store.get();
    const now = Date.now();
    let content;
    switch (state.ui.view) {
      case VIEWS.MAP: content = renderMapView(state); break;
      case VIEWS.QUESTIONS: content = renderQuestionsView(state, now); break;
      case VIEWS.TOOLS: content = renderToolsView(state); break;
      case VIEWS.RULES: content = renderRulesView(state); break;
      default: content = renderPlay(state, now);
    }
    this.root.innerHTML = renderShell(state, content);
    this.restoreModal();
    this.restoreFocus(focus);
    this.afterRender();
  }

  afterRender() {
    const state = this.store.get();
    if (state.ui.view === VIEWS.MAP && state.ui.mapMode === "zone") {
      destroyDeductionMap();
      const station = this.stationMapObject();
      const positions = this.mapPositions();
      renderZoneMap({ station, positions, radiusMetres: DEFAULT_DURATIONS.hidingZoneRadiusMetres }).catch((error) => {
        renderMapFallback("zone-map", error.message);
        this.toast(error.message, "warning");
      });
      return;
    }
    if (state.ui.view === VIEWS.MAP && state.ui.mapMode === "deduction") {
      destroyZoneMap();
      const model = buildDeductionViewModel(state);
      if (!model.canView) {
        destroyDeductionMap();
        return;
      }
      renderDeductionMap({
        results: model.results,
        constraints: model.constraints,
        showEliminated: model.roundState.showEliminated,
        showZones: model.roundState.showZones,
        showAreaMask: model.roundState.showAreaMask,
        displayMode: model.roundState.mapDisplayMode,
        maskScope: model.roundState.maskScope,
        activeConstraint: model.activeAreaConstraint,
        endgameStation: model.endgameStation,
        spatialFeatures: model.spatialData.features,
        selectedStationId: state.ui.deductionSelectedStationId || null,
        onStationAction: (action, id) => {
          const promise = action === "deduction-toggle-priority"
            ? this.toggleDeductionStationPriority(id)
            : action === "deduction-toggle-eliminated"
              ? this.toggleDeductionStationEliminated(id)
              : null;
          promise?.catch((error) => this.toast(error.message, "error"));
        }
      }).catch((error) => {
        renderMapFallback("deduction-map", error.message);
        this.toast(error.message, "warning");
      });
      return;
    }
    destroyZoneMap();
    destroyDeductionMap();
  }

  captureFocus() {
    const active = document.activeElement;
    if (!active || !this.root.contains(active)) return null;
    return {
      id: active.id || null,
      action: active.dataset?.action || null,
      selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null
    };
  }

  restoreFocus(focus) {
    if (!focus) return;
    const selector = focus.id ? `#${CSS.escape(focus.id)}` : focus.action ? `[data-action="${CSS.escape(focus.action)}"]` : null;
    const element = selector ? this.root.querySelector(selector) : null;
    if (!element) return;
    element.focus({ preventScroll: true });
    if (focus.selectionStart != null && element.setSelectionRange) element.setSelectionRange(focus.selectionStart, focus.selectionEnd);
  }

  openModal(name, context = {}) {
    if (this.modalContext?.name === "evidence-preview" && name !== "evidence-preview") this.revokeEvidenceUrl();
    this.modalContext = { name, ...context };
    this.renderCurrentModal();
  }

  renderCurrentModal() {
    if (!this.modalContext) return;
    const dialog = document.getElementById("app-modal");
    if (!dialog) return;
    dialog.innerHTML = renderModal(this.modalContext.name, this.store.get(), this.modalContext);
    if (!dialog.open) dialog.showModal();
  }

  restoreModal() {
    if (this.modalContext) this.renderCurrentModal();
  }

  revokeEvidenceUrl() {
    if (this.evidenceObjectUrl) URL.revokeObjectURL(this.evidenceObjectUrl);
    this.evidenceObjectUrl = null;
  }

  closeModal() {
    const dialog = document.getElementById("app-modal");
    if (dialog?.open) dialog.close();
    this.modalContext = null;
    this.revokeEvidenceUrl();
  }

  toast(message, tone = "") {
    const region = document.getElementById("toast-region");
    if (!region) return;
    const id = randomId("toast");
    const element = document.createElement("div");
    element.className = `toast ${tone}`;
    element.dataset.toastId = id;
    element.innerHTML = `<p>${escapeHtml(message)}</p><button type="button" data-action="dismiss-toast" aria-label="Dismiss">×</button>`;
    region.append(element);
    setTimeout(() => element.remove(), 5200);
  }

  questionPermissions() {
    const state = this.store.get();
    const game = state.game;
    const activePhase = Boolean(game && [PHASES.SEEKING, PHASES.ENDGAME].includes(game.phase));
    const sharedDevice = game?.mode === "local";
    const isHider = Boolean(game && state.profile.team === game.hiderTeam);
    return {
      activePhase,
      canAsk: activePhase && (sharedDevice || !isHider),
      canAnswer: activePhase && (sharedDevice || isHider)
    };
  }

  assertCanAskQuestion() {
    const state = this.store.get();
    const permission = this.questionPermissions();
    if (!state.game) throw new Error("Create or join a game before asking questions.");
    if (!permission.activePhase) throw new Error("Questions become available after the hiding period, when the seeker phase starts.");
    if (!permission.canAsk) throw new Error("Only the active seeker team can ask questions in Connected Mode.");
  }

  assertCanAnswerQuestion() {
    const state = this.store.get();
    const permission = this.questionPermissions();
    if (!state.game) throw new Error("Create or join a game before recording answers.");
    if (!permission.activePhase) throw new Error("Answers can be recorded during the seeker or endgame phase.");
    if (!permission.canAnswer) throw new Error("Only the active hider team can answer questions in Connected Mode.");
  }

  async handleClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    try {
      switch (action) {
        case "navigate": this.store.patch("ui.view", button.dataset.view); this.updateUrlView(button.dataset.view); break;
        case "open-modal": this.openModal(button.dataset.modal); break;
        case "close-modal": this.closeModal(); break;
        case "dismiss-toast": button.closest(".toast")?.remove(); break;
        case "install-app": await this.installApp(); break;
        case "map-mode": cancelDeductionMapPick(); this.store.patch("ui.mapMode", button.dataset.mode); break;
        case "deduction-map-display": await this.updateDeductionPreference("mapDisplayMode", button.dataset.mode); break;
        case "deduction-show-constraint": await this.showDeductionConstraint(button.dataset.id); break;
        case "deduction-fill-gps": await this.fillDeductionCoordinates(button.dataset.prefix, button); break;
        case "deduction-pick-map": this.startDeductionMapPick(button.dataset.prefix, button); break;
        case "deduction-pick-vertex": this.startDeductionVertexPick(button); break;
        case "deduction-clear-vertices": this.clearDeductionVertices(button); break;
        case "deduction-focus-station": this.focusDeductionStation(button.dataset.id); break;
        case "deduction-inspect-station": await this.inspectDeductionStation(button.dataset.id, button.dataset.constraintId, button.dataset.mode); break;
        case "deduction-toggle-eliminated": await this.toggleDeductionStationEliminated(button.dataset.id); break;
        case "deduction-toggle-priority": await this.toggleDeductionStationPriority(button.dataset.id); break;
        case "deduction-toggle-auto": await this.toggleAutomaticDeduction(button.dataset.id); break;
        case "deduction-remove-constraint": await this.removeDeductionConstraint(button.dataset.id); break;
        case "deduction-undo": await this.undoDeduction(); break;
        case "deduction-reset": await this.resetDeductionRound(); break;
        case "spatial-data-load-configured": await this.loadConfiguredSpatialData(button); break;
        case "spatial-data-clear": await this.clearSpatialData(); break;
        case "tool-tab": this.store.patch("ui.selectedTool", button.dataset.tool); break;
        case "question-category": this.store.patch("ui.questionCategory", button.dataset.category); break;
        case "open-ask-question": this.assertCanAskQuestion(); this.openModal("ask-question", { questionId: button.dataset.questionId }); break;
        case "open-custom-answer": this.assertCanAnswerQuestion(); this.openModal("custom-answer", { questionInstanceId: button.dataset.questionInstance }); break;
        case "open-answer-photo": this.assertCanAnswerQuestion(); this.openModal("photo-answer", { questionInstanceId: button.dataset.questionInstance }); break;
        case "answer-question": await this.answerQuestion(button.dataset.questionInstance, button.dataset.answer); break;
        case "view-evidence": await this.viewEvidence(button.dataset.questionInstance); break;
        case "toggle-pause": await this.togglePause(); break;
        case "mark-found": this.openModal("mark-found"); break;
        case "trigger-endgame": await this.setEndgame(true); break;
        case "cancel-endgame": await this.setEndgame(false); break;
        case "next-round": await this.prepareNextRound(); break;
        case "share-invite": await this.shareInvite(); break;
        case "export-game": this.exportGame(); break;
        case "reset-app": await this.resetApp(); break;
        case "leave-game": await this.leaveGame(); break;
        case "start-location": await this.startLocationSharing(); break;
        case "stop-location": await this.stopLocationSharing(); break;
        case "resolve-station": await this.resolveSelectedStation(); break;
        case "send-safety-check": await this.sendSafetyCheck(); break;
        case "refresh-tfl": await this.refreshTfl(); break;
        case "use-live-time": await this.useLiveHidingTime(); break;
        case "remove-adjustment": await this.removeAdjustment(button.dataset.group, button.dataset.id); break;
        case "remove-card": await this.removeCard(button.dataset.id); break;
        case "remove-trap": await this.removeTrap(button.dataset.id); break;
        case "delete-trap": await this.deleteTrap(button.dataset.id); break;
        case "add-trap-to-score": await this.addTrapToScore(button.dataset.id); break;
        case "random-station": this.randomStation(); break;
        case "choose-random-station": await this.chooseStation(button.dataset.id, true); break;
        case "toggle-used-station": await this.toggleUsedStation(button.dataset.id); break;
        default: break;
      }
    } catch (error) {
      console.error(error);
      this.toast(error.message || "Something went wrong.", "error");
    }
  }

  handleInput(event) {
    const action = event.target.dataset.action;
    if (action === "question-search") this.debouncedPatch("ui.questionSearch", event.target.value);
    if (action === "station-filter") this.debouncedPatch("ui.stationSearch", event.target.value);
    if (action === "deduction-search") this.debouncedPatch("ui.deductionSearch", event.target.value);
  }

  async handleChange(event) {
    const action = event.target.dataset.action;
    if (action === "location-visibility") {
      const value = event.target.value;
      this.store.patch("location.shareWith", value);
      if (this.store.get().location.sharing && this.store.get().location.current) await this.pushPosition(this.store.get().location.current, true);
    }
    if (action === "toggle-checklist") this.store.patch(["checklist", event.target.dataset.id], event.target.checked);
    if (action === "deduction-tool") this.store.patch("ui.deductionTool", event.target.value);
    if (action === "deduction-filter") await this.updateDeductionPreference("filter", event.target.value);
    if (action === "deduction-show-eliminated") await this.updateDeductionPreference("showEliminated", event.target.checked);
    if (action === "deduction-show-zones") await this.updateDeductionPreference("showZones", event.target.checked);
    if (action === "deduction-show-area-mask") await this.updateDeductionPreference("showAreaMask", event.target.checked);
    if (action === "deduction-area-constraint") await this.updateDeductionPreference("areaConstraintId", event.target.value || "latest");
    if (action === "deduction-endgame-station") {
      await this.updateDeductionPreference("endgameStationId", event.target.value || null);
      if (event.target.value) this.store.patch("ui.deductionSelectedStationId", event.target.value);
    }
    if (action === "deduction-mask-scope") await this.updateDeductionPreference("maskScope", event.target.value === "selected" ? "selected" : "all");
    if (action === "deduction-area-shape") this.toggleDeductionShapeFields(event.target.closest("form"), event.target.value);
    if (action === "deduction-enable-question") {
      const details = event.target.closest(".deduction-question-fields");
      details?.querySelectorAll(".deduction-auto-fields input, .deduction-auto-fields select, .deduction-auto-fields button").forEach((control) => { control.disabled = !event.target.checked; });
    }
  }

  debouncedPatch(path, value) {
    clearTimeout(this.renderTimer);
    this.store.patch(path, value, { persist: true });
    this.renderTimer = setTimeout(() => this.render(), 80);
  }

  async handleSubmit(event) {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      switch (form.dataset.form) {
        case "profile": await this.saveProfile(data); break;
        case "new-game": await this.createGame(data); break;
        case "join-game": await this.joinGame(data); break;
        case "settings": await this.saveSettings(data); break;
        case "start-round": await this.startRound(data); break;
        case "game-settings": await this.saveGameSettings(data); break;
        case "pause-game": await this.pauseGame(data); break;
        case "transit-start": await this.transitStart(data); break;
        case "transit-end": await this.transitEnd(data); break;
        case "chat": await this.sendChat(data); form.reset(); break;
        case "station-select": await this.chooseStation(data.stationId, true); break;
        case "base-score": await this.saveBaseScore(data); break;
        case "score-adjustment": await this.addScoreAdjustment(data); break;
        case "add-card": await this.addCard(data); break;
        case "add-trap": await this.addTrap(data); break;
        case "ask-question": await this.askQuestion(form.dataset.questionId, data, form); break;
        case "deduction-constraint": await this.addDeductionConstraint(form, data); break;
        case "spatial-data-import": await this.importSpatialData(form); break;
        case "custom-answer": await this.answerQuestion(form.dataset.questionInstance, data.answer, data.note); break;
        case "photo-answer": await this.answerPhoto(form, data); break;
        case "mark-found": await this.markFound(data); break;
        default: break;
      }
    } catch (error) {
      console.error(error);
      this.toast(error.message || "The action could not be completed.", "error");
    } finally {
      if (submit?.isConnected) submit.disabled = false;
    }
  }

  updateUrlView(view) {
    const url = new URL(location.href);
    url.searchParams.set("view", view);
    history.replaceState({}, "", url);
  }

  async installApp() {
    if (!this.deferredInstallPrompt) return this.toast("Use your browser menu and choose Add to Home Screen.", "warning");
    await this.deferredInstallPrompt.prompt();
    await this.deferredInstallPrompt.userChoice;
    this.deferredInstallPrompt = null;
    this.store.patch("ui.installPromptAvailable", false);
  }

  async createGame(data) {
    const mode = data.mode || "local";
    const gameName = String(data.gameName || "London Hide + Seek").trim();
    if (mode === "connected") {
      await this.saveConnectionConfig(data.supabaseUrl, data.supabaseAnonKey);
      this.store.patch("connection.status", "syncing");
      await this.sync.connect(data.supabaseUrl, data.supabaseAnonKey);
      const hydrated = await this.sync.createGame({ gameName, displayName: this.store.get().profile.name, team: this.store.get().profile.team });
      this.hydrateRemote(hydrated);
      this.store.set((draft) => {
        draft.connection.mode = "connected";
        draft.connection.status = "online";
        draft.connection.gameId = hydrated.game.id;
        draft.connection.roomCode = hydrated.game.join_code;
        return draft;
      });
      await this.recordEvent("chat", { message: `${this.store.get().profile.name} created the game room.` });
    } else {
      const profile = this.store.get().profile;
      const game = createGameState({ name: gameName, code: roomCode(), hostId: profile.id, mode: "local" });
      game.members = [{ userId: profile.id, displayName: profile.name, team: profile.team, isHost: true, joinedAt: toIso(), lastSeen: toIso() }];
      this.store.set((draft) => {
        draft.game = game;
        draft.questions = [];
        draft.events = [];
        draft.positions = [];
        draft.connection = { ...draft.connection, mode: "local", status: "offline", gameId: game.id, roomCode: game.code, error: null };
        return draft;
      });
      await this.recordEvent("chat", { message: `${profile.name} created a local game board.` });
    }
    this.closeModal();
    this.toast("Game created. Choose the first hiding team when everyone is ready.", "success");
  }

  async joinGame(data) {
    await this.saveConnectionConfig(data.supabaseUrl, data.supabaseAnonKey);
    this.store.patch("connection.status", "syncing");
    await this.sync.connect(data.supabaseUrl, data.supabaseAnonKey);
    const hydrated = await this.sync.joinGame({ code: data.code, displayName: this.store.get().profile.name, team: data.team || this.store.get().profile.team });
    this.hydrateRemote(hydrated);
    this.store.set((draft) => {
      draft.connection.mode = "connected";
      draft.connection.status = "online";
      draft.connection.gameId = hydrated.game.id;
      draft.connection.roomCode = hydrated.game.join_code;
      draft.profile.team = hydrated.member?.team || data.team;
      return draft;
    });
    await this.recordEvent("chat", { message: `${this.store.get().profile.name} joined the game.` });
    this.closeModal();
    this.toast("Joined the connected game room.", "success");
  }

  async saveConnectionConfig(url, key) {
    const supabaseUrl = String(url || this.store.get().connection.supabaseUrl || "").trim();
    const supabaseAnonKey = String(key || this.store.get().connection.supabaseAnonKey || "").trim();
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Connected Mode needs a Supabase URL and anon key.");
    localStorage.setItem("hideline:supabase-url", supabaseUrl);
    localStorage.setItem("hideline:supabase-key", supabaseAnonKey);
    this.store.set((draft) => {
      draft.connection.supabaseUrl = supabaseUrl;
      draft.connection.supabaseAnonKey = supabaseAnonKey;
      return draft;
    });
  }

  async autoConnect() {
    if (this.autoConnectAttempted) return;
    this.autoConnectAttempted = true;
    const state = this.store.get();
    if (state.connection.mode !== "connected" || !state.connection.gameId || !state.connection.supabaseUrl || !state.connection.supabaseAnonKey) return;
    try {
      this.store.patch("connection.status", "syncing");
      await this.sync.connect(state.connection.supabaseUrl, state.connection.supabaseAnonKey);
      this.sync.gameId = state.connection.gameId;
      const hydrated = await this.sync.hydrate(state.connection.gameId);
      await this.sync.subscribe(state.connection.gameId);
      this.hydrateRemote(hydrated);
      this.store.patch("connection.status", "online");
    } catch (error) {
      this.store.set((draft) => {
        draft.connection.status = navigator.onLine ? "error" : "offline";
        draft.connection.error = error.message;
        return draft;
      });
      this.toast(`Connected Mode could not resume: ${error.message}`, "warning");
    }
  }

  hydrateRemote(hydrated) {
    if (!hydrated?.game) return;
    const remote = hydrated.game.state || {};
    const base = createGameState({ name: hydrated.game.name, code: hydrated.game.join_code, hostId: hydrated.game.created_by, mode: "connected" });
    const game = {
      ...base,
      ...remote,
      id: hydrated.game.id,
      code: hydrated.game.join_code,
      name: remote.name || hydrated.game.name,
      mode: "connected",
      hostId: hydrated.game.created_by,
      createdAt: hydrated.game.created_at,
      updatedAt: hydrated.game.updated_at,
      version: hydrated.game.version,
      teams: { ...base.teams, ...(remote.teams || {}) },
      timers: { ...base.timers, ...(remote.timers || {}) },
      transit: { ...base.transit, ...(remote.transit || {}) },
      scoreByRound: { ...base.scoreByRound, ...(remote.scoreByRound || {}) },
      settings: { ...base.settings, ...(remote.settings || {}) },
      members: (hydrated.members || []).map((member) => ({
        userId: member.user_id,
        displayName: member.display_name,
        team: member.team,
        isHost: member.is_host,
        joinedAt: member.joined_at,
        lastSeen: member.last_seen
      }))
    };
    const events = (hydrated.events || []).map((event) => ({ id: event.id, type: event.event_type, payload: event.payload || {}, team: event.team, visibility: event.visibility, createdAt: event.created_at, createdBy: event.created_by }));
    const teamState = hydrated.teamState?.state || {};
    this.store.set((draft) => {
      draft.game = game;
      draft.questions = remote.questions || [];
      draft.events = events;
      draft.positions = hydrated.positions || [];
      draft.privateTeamState = {
        stationId: null,
        stationName: null,
        stationCoords: null,
        hidingSpotNote: "",
        cards: [],
        handLimit: DEFAULT_DURATIONS.handLimit,
        privateNotes: "",
        deductionByRound: {},
        spatialData: { version: 1, sourceName: "No map data imported", importedAt: null, features: [] },
        ...teamState
      };
      draft.connection.mode = "connected";
      draft.connection.status = "online";
      draft.connection.gameId = game.id;
      draft.connection.roomCode = game.code;
      draft.connection.lastSyncedAt = toIso();
      draft.connection.error = null;
      if (hydrated.member) {
        draft.profile.team = hydrated.member.team;
        draft.profile.name = hydrated.member.display_name || draft.profile.name;
      }
      return draft;
    }, { source: "remote" });
  }

  scheduleRemoteRefresh() {
    clearTimeout(this.remoteRefreshTimer);
    this.remoteRefreshTimer = setTimeout(async () => {
      try {
        const hydrated = await this.sync.hydrate();
        this.hydrateRemote(hydrated);
      } catch (error) {
        this.store.set((draft) => { draft.connection.status = "error"; draft.connection.error = error.message; return draft; });
      }
    }, 220);
  }

  async patchGameRemote(patch) {
    if (this.store.get().connection.mode !== "connected") return;
    this.store.patch("connection.status", "syncing");
    try {
      await this.sync.patchGame(patch);
      this.store.patch("connection.status", "online");
    } catch (error) {
      this.store.set((draft) => { draft.connection.status = "error"; draft.connection.error = error.message; return draft; });
      throw error;
    }
  }

  async savePrivateTeamState() {
    if (this.store.get().connection.mode === "connected") await this.sync.saveTeamState(this.store.get().privateTeamState);
  }

  async recordEvent(type, payload = {}, visibility = "all") {
    const eventPayload = { ...payload, authorName: payload.authorName || this.store.get().profile.name, round: payload.round || this.store.get().game?.round || 1 };
    let event;
    if (this.store.get().connection.mode === "connected") {
      const row = await this.sync.postEvent({ type, payload: eventPayload, visibility });
      event = { id: row.id, type: row.event_type, payload: row.payload, team: row.team, visibility: row.visibility, createdAt: row.created_at, createdBy: row.created_by };
    } else {
      event = { id: randomId("event"), type, payload: eventPayload, team: this.store.get().profile.team, visibility, createdAt: toIso(), createdBy: this.store.get().profile.id };
    }
    this.store.set((draft) => { draft.events = [event, ...draft.events.filter((item) => item.id !== event.id)].slice(0, 300); return draft; });
    return event;
  }

  async saveProfile(data) {
    const name = String(data.name || "Player").trim().slice(0, 40) || "Player";
    const team = data.team === "bravo" ? "bravo" : "alpha";
    if (this.store.get().connection.mode === "connected") {
      await this.sync.updateProfile({ displayName: name, team });
      await this.sync.removePosition().catch(() => {});
      const hydrated = await this.sync.hydrate();
      this.hydrateRemote(hydrated);
    }
    this.store.set((draft) => {
      draft.profile.name = name;
      draft.profile.team = team;
      if (draft.game?.mode === "local") {
        const member = draft.game.members.find((item) => item.userId === draft.profile.id);
        if (member) { member.displayName = name; member.team = team; member.lastSeen = toIso(); }
      }
      draft.location.shareWith = draft.game && team !== draft.game.hiderTeam ? "all" : "team";
      return draft;
    });
    if (this.store.get().connection.mode === "connected" && this.store.get().location.sharing && this.store.get().location.current) {
      await this.pushPosition(this.store.get().location.current, true);
    }
    this.closeModal();
    this.toast("Profile saved.", "success");
  }

  async saveSettings(data) {
    const supabaseUrl = String(data.supabaseUrl || "").trim();
    const supabaseAnonKey = String(data.supabaseAnonKey || "").trim();
    if (data.rememberConnection === "on") {
      localStorage.setItem("hideline:supabase-url", supabaseUrl);
      localStorage.setItem("hideline:supabase-key", supabaseAnonKey);
    }
    this.store.set((draft) => {
      draft.connection.supabaseUrl = supabaseUrl;
      draft.connection.supabaseAnonKey = supabaseAnonKey;
      draft.settings.repeatRewardMode = data.repeatRewardMode || "multiply-both";
      draft.settings.safetyContact = String(data.safetyContact || "").trim();
      return draft;
    });
    this.closeModal();
    this.toast("Settings saved.", "success");
  }

  async saveGameSettings(data) {
    const game = structuredClone(this.store.get().game);
    game.name = String(data.gameName || game.name).trim();
    game.hiderTeam = data.hiderTeam === "bravo" ? "bravo" : "alpha";
    game.teams.alpha.name = String(data.alphaName || "Team Alpha").trim();
    game.teams.bravo.name = String(data.bravoName || "Team Bravo").trim();
    game.updatedAt = toIso();
    this.store.patch("game", game);
    await this.patchGameRemote({ name: game.name, hiderTeam: game.hiderTeam, teams: game.teams });
    this.closeModal();
    this.toast("Game settings saved.", "success");
  }

  async startRound(data) {
    const game = structuredClone(this.store.get().game);
    if (!game) throw new Error("Create or join a game first.");
    const parsedStart = Date.parse(data.roundStart);
    if (!Number.isFinite(parsedStart)) throw new Error("Choose a valid round start time.");
    const startedAt = new Date(parsedStart).toISOString();
    const hidingMinutes = Math.max(1, number(data.hidingMinutes, 45));
    const cutoffMinutes = Math.max(hidingMinutes + 1, number(data.cutoffMinutes, 285));
    game.hiderTeam = data.hiderTeam === "bravo" ? "bravo" : "alpha";
    game.phase = PHASES.HIDING;
    game.timers = {
      ...game.timers,
      roundStartedAt: startedAt,
      roundStoppedAt: null,
      foundAt: null,
      pauses: [],
      hidingPeriodSeconds: hidingMinutes * 60,
      cutoffSeconds: cutoffMinutes * 60,
      seekingWindowSeconds: (cutoffMinutes - hidingMinutes) * 60
    };
    game.updatedAt = toIso();
    this.store.set((draft) => {
      draft.game = game;
      draft.location.shareWith = draft.profile.team === game.hiderTeam ? "team" : "all";
      return draft;
    });
    await this.patchGameRemote({ phase: game.phase, hiderTeam: game.hiderTeam, timers: game.timers, transit: game.transit });
    await this.recordEvent("round-start", { message: `Round ${game.round} started. ${game.teams[game.hiderTeam].name} are hiding.`, startedAt });
    this.closeModal();
    this.toast(`Round ${game.round} started. Seekers release after ${formatDuration(game.timers.hidingPeriodSeconds, { compact: true })}.`, "success");
  }

  async togglePause() {
    const game = this.store.get().game;
    if (!game || game.phase === PHASES.LOBBY || game.phase === PHASES.COMPLETE) return;
    const lastPause = game.timers.pauses?.at(-1);
    if (lastPause && !lastPause.endedAt) {
      const next = structuredClone(game.timers);
      next.pauses[next.pauses.length - 1].endedAt = toIso();
      this.store.patch("game.timers", next);
      await this.patchGameRemote({ timers: next });
      await this.recordEvent("resume", { reason: lastPause.reason || "Game resumed" });
      this.toast("Round timer resumed.", "success");
    } else this.openModal("pause");
  }

  async pauseGame(data) {
    const timers = structuredClone(this.store.get().game.timers);
    timers.pauses ||= [];
    timers.pauses.push({ id: randomId("pause"), startedAt: toIso(), endedAt: null, reason: data.reason || "Pause", note: data.note || "" });
    this.store.patch("game.timers", timers);
    await this.patchGameRemote({ timers });
    await this.recordEvent("pause", { reason: data.reason, note: data.note });
    this.closeModal();
    this.toast("Round paused for all active timing.", "warning");
  }


  async setEndgame(active) {
    const game = this.store.get().game;
    if (!game || ![PHASES.SEEKING, PHASES.ENDGAME].includes(game.phase)) return;
    const phase = active ? PHASES.ENDGAME : PHASES.SEEKING;
    this.store.patch("game.phase", phase);
    await this.patchGameRemote({ phase });
    await this.recordEvent(active ? "endgame" : "endgame-cancelled", {
      message: active
        ? "Endgame confirmed: seekers are inside the hiding zone and off transit."
        : "Endgame cancelled because seekers left the zone by public transport after an accidental trigger."
    });
    this.toast(active ? "Endgame started. Hiders must remain at the hiding spot." : "Accidental endgame cleared. Hiders may move within the zone again.", active ? "warning" : "success");
  }

  async markFound(data) {
    const game = structuredClone(this.store.get().game);
    const now = toIso();
    game.phase = PHASES.COMPLETE;
    game.timers.roundStoppedAt = now;
    game.timers.foundAt = now;
    const elapsed = activeElapsedSeconds(game.timers.roundStartedAt, now, game.timers.pauses, now);
    const hidingSeconds = Math.max(0, elapsed - game.timers.hidingPeriodSeconds);
    game.scoreByRound[game.round] ||= {};
    game.scoreByRound[game.round].hidingSeconds = hidingSeconds;
    this.store.patch("game", game);
    await this.patchGameRemote({ phase: game.phase, timers: game.timers, scoreByRound: game.scoreByRound });
    await this.recordEvent("found", { note: data.note || "Hiders found", hidingSeconds });
    this.closeModal();
    this.toast(`Round stopped at ${formatDuration(hidingSeconds)} of hiding time.`, "success");
  }

  async prepareNextRound() {
    const game = structuredClone(this.store.get().game);
    if (!game || game.round !== 1) return;
    game.round = 2;
    game.phase = PHASES.LOBBY;
    game.hiderTeam = game.hiderTeam === "alpha" ? "bravo" : "alpha";
    game.timers = { ...game.timers, roundStartedAt: null, roundStoppedAt: null, foundAt: null, pauses: [] };
    game.transit = { alpha: { active: false, startedAt: null, station: "", note: "" }, bravo: { active: false, startedAt: null, station: "", note: "" } };
    this.store.set((draft) => {
      draft.game = game;
      draft.privateTeamState = { ...draft.privateTeamState, stationId: null, stationName: null, stationCoords: null, hidingSpotNote: "", cards: [] };
      return draft;
    });
    await this.patchGameRemote({ round: 2, phase: game.phase, hiderTeam: game.hiderTeam, timers: game.timers, transit: game.transit });
    await this.savePrivateTeamState();
    await this.recordEvent("round-reset", { message: `Round 2 prepared. ${game.teams[game.hiderTeam].name} will hide.` });
    this.toast("Round 2 lobby is ready.", "success");
  }

  async sendChat(data) {
    const message = String(data.message || "").trim();
    if (!message) return;
    await this.recordEvent("chat", { message });
  }

  async transitStart(data) {
    const game = structuredClone(this.store.get().game);
    const team = this.store.get().profile.team;
    const station = String(data.station || "").trim();
    const note = [data.line, data.note].filter(Boolean).join(" · ");
    game.transit[team] = { active: true, startedAt: toIso(), station, note };
    this.store.patch("game.transit", game.transit);
    await this.patchGameRemote({ transit: game.transit });
    let position = null;
    if (data.includeLocation === "on") {
      try { position = await this.location.getCurrent(); await this.pushPosition(position, true); } catch (error) { this.toast(error.message, "warning"); }
    }
    await this.recordEvent("transit-start", { station, note, line: data.line || "", hasLocation: Boolean(position) });
    this.closeModal();
    this.toast("Boarding intent shared.", "success");
  }

  async transitEnd(data) {
    const game = structuredClone(this.store.get().game);
    const team = this.store.get().profile.team;
    const station = String(data.station || "").trim();
    game.transit[team] = { active: false, startedAt: null, station, note: data.note || "" };
    if (game.phase === PHASES.ENDGAME && team !== game.hiderTeam) {
      // Leaving via transit may mean the endgame was triggered accidentally. The hiders decide whether to revert.
    }
    this.store.patch("game.transit", game.transit);
    await this.patchGameRemote({ transit: game.transit });
    if (data.includeLocation === "on") {
      try { const position = await this.location.getCurrent(); await this.pushPosition(position, true); } catch (error) { this.toast(error.message, "warning"); }
    }
    await this.recordEvent("transit-end", { station, note: data.note || "" });
    this.closeModal();
    this.toast("Off-transit notice shared.", "success");
  }

  async sendSafetyCheck() {
    const contact = this.store.get().settings.safetyContact;
    await this.recordEvent("safety", { message: `${this.store.get().profile.name} checked in as safe.${contact ? ` Organiser contact: ${contact}` : ""}` });
    this.toast("Safety check-in posted to the game timeline.", "success");
  }

  async askQuestion(questionId, data, form) {
    this.assertCanAskQuestion();
    const definition = QUESTION_BY_ID.get(questionId);
    if (!definition) throw new Error("Question definition not found.");
    const state = this.store.get();
    if (state.questions.some((question) => question.status === "pending")) throw new Error("Wait for the current question to be answered before asking another.");
    const round = state.game?.round || 1;
    const occurrence = state.questions.filter((question) => question.questionId === questionId && (question.round || 1) === round).length + 1;
    const reward = repeatedReward(definition, occurrence, state.settings.repeatRewardMode);
    const custom = String(data.customValue || "").trim();
    const prompt = custom ? `${definition.prompt} (${custom})` : definition.prompt;
    const deductionInput = this.questionDeductionInput(definition, data, form, state);
    const record = {
      id: randomId("question"),
      questionId,
      questionName: definition.name,
      category: definition.category,
      prompt,
      guidance: definition.guidance,
      answers: definition.answers,
      askedAt: toIso(),
      askedBy: state.profile.id,
      askedByName: state.profile.name,
      askedByTeam: state.profile.team,
      responseSeconds: definition.responseSeconds,
      reward,
      occurrence,
      round,
      phase: state.game?.phase || PHASES.SEEKING,
      deductionInput,
      note: String(data.note || "").trim(),
      pinLabel: String(data.pinLabel || "").trim(),
      status: "pending",
      answer: null,
      answeredAt: null,
      rewardEarned: null
    };
    const questions = [...state.questions, record];
    this.store.patch("questions", questions);
    await this.patchGameRemote({ questions });
    await this.recordEvent("question", { questionId, questionName: definition.name, prompt, note: record.note, occurrence, reward, questionInstanceId: record.id, pinLabel: record.pinLabel, round });
    this.closeModal();
    this.toast(`Question asked. Hiders have ${definition.responseSeconds / 60} minutes.`, "success");
  }

  async answerQuestion(instanceId, answer, note = "", evidence = {}) {
    this.assertCanAnswerQuestion();
    const state = this.store.get();
    const index = state.questions.findIndex((question) => question.id === instanceId);
    if (index < 0) throw new Error("Question instance not found.");
    const record = structuredClone(state.questions[index]);
    const remaining = questionSecondsRemaining(record);
    record.answer = String(answer || "").trim();
    record.answerNote = String(note || "").trim();
    record.answeredAt = toIso();
    record.answeredPhase = state.game?.phase || record.phase || PHASES.SEEKING;
    record.answeredBy = state.profile.id;
    record.answeredByName = state.profile.name;
    record.status = "answered";
    record.rewardEarned = remaining >= 0;
    Object.assign(record, evidence);
    const questions = [...state.questions];
    questions[index] = record;
    this.store.patch("questions", questions);
    await this.patchGameRemote({ questions });
    await this.recordEvent("answer", { questionInstanceId: instanceId, questionName: record.questionName, answer: record.answer, note: record.answerNote, rewardEarned: record.rewardEarned, evidencePath: record.evidencePath || null, round: record.round });
    this.closeModal();
    if (record.rewardEarned) this.toast(`Answer recorded. Draw ${record.reward.draw}, keep ${record.reward.keep}.`, "success");
    else this.toast("Answer recorded after the deadline: pause required and no reward earned.", "warning");
  }

  async answerPhoto(form, data) {
    const fileInput = form.querySelector('input[name="photo"]');
    const file = fileInput?.files?.[0];
    if (!file) throw new Error("Select or take a photo first.");
    const compressed = await compressImage(file);
    let evidence = {};
    if (this.store.get().connection.mode === "connected") {
      const path = await this.sync.uploadEvidence(compressed, form.dataset.questionInstance);
      evidence = { evidencePath: path, evidenceType: "supabase" };
    } else {
      const evidenceKey = await saveLocalEvidence(compressed, {
        gameId: this.store.get().game?.id || "local",
        questionId: form.dataset.questionInstance
      });
      evidence = { evidenceKey, evidenceType: "local-indexeddb" };
    }
    await this.answerQuestion(form.dataset.questionInstance, "Photo submitted", data.note, evidence);
  }

  async viewEvidence(instanceId) {
    const record = this.store.get().questions.find((question) => question.id === instanceId);
    if (!record) throw new Error("Question evidence could not be found.");
    this.openModal("evidence-loading", { questionName: record.questionName });
    try {
      let url = null;
      let objectUrl = false;
      if (record.evidencePath) {
        if (this.store.get().connection.mode !== "connected") throw new Error("Reconnect to the game room to view this private photo.");
        url = await this.sync.signedEvidenceUrl(record.evidencePath);
      } else if (record.evidenceKey) {
        url = await getLocalEvidenceUrl(record.evidenceKey);
        objectUrl = true;
      } else if (record.evidenceDataUrl) {
        url = record.evidenceDataUrl;
      }
      if (!url || !/^(blob:|data:image\/|https:\/\/)/i.test(url)) throw new Error("This question has no viewable photo evidence.");
      this.revokeEvidenceUrl();
      if (objectUrl) this.evidenceObjectUrl = url;
      this.modalContext = {
        name: "evidence-preview",
        questionName: record.questionName,
        answerNote: record.answerNote || "",
        url
      };
      this.renderCurrentModal();
    } catch (error) {
      this.closeModal();
      throw error;
    }
  }

  async saveBaseScore(data) {
    const game = structuredClone(this.store.get().game);
    if (!game) throw new Error("Create a game first.");
    const round = game.round;
    game.scoreByRound[round] ||= {};
    game.scoreByRound[round].hidingSeconds = parseDurationParts(data.hours, data.minutes, data.seconds);
    game.scoreByRound[round].hidingPeriodSeconds = Math.max(0, number(data.hidingPeriodMinutes, 45) * 60);
    this.store.patch("game.scoreByRound", game.scoreByRound);
    await this.patchGameRemote({ scoreByRound: game.scoreByRound });
    this.toast("Base score time saved.", "success");
  }

  async useLiveHidingTime() {
    const game = structuredClone(this.store.get().game);
    if (!game?.timers?.roundStartedAt) throw new Error("The round timer has not started.");
    const elapsed = activeElapsedSeconds(game.timers.roundStartedAt, game.timers.roundStoppedAt, game.timers.pauses);
    const hidingSeconds = Math.max(0, elapsed - game.timers.hidingPeriodSeconds);
    game.scoreByRound[game.round] ||= {};
    game.scoreByRound[game.round].hidingSeconds = hidingSeconds;
    this.store.patch("game.scoreByRound", game.scoreByRound);
    await this.patchGameRemote({ scoreByRound: game.scoreByRound });
    this.toast(`Live hiding time set to ${formatDuration(hidingSeconds)}.`, "success");
  }

  async addScoreAdjustment(data) {
    const game = structuredClone(this.store.get().game);
    if (!game) throw new Error("Create a game first.");
    const round = game.round;
    const score = game.scoreByRound[round];
    const target = adjustmentTarget(data.kind);
    score[target] ||= [];
    const signAwareSeconds = parseDurationParts(data.hours, data.minutes, data.seconds);
    const item = { id: randomId("adjustment"), label: String(data.label || "Adjustment").trim() };
    if (target === "percentageBonuses") item.percent = number(data.percent);
    else item.seconds = signAwareSeconds;
    score[target].push(item);
    this.store.patch("game.scoreByRound", game.scoreByRound);
    await this.patchGameRemote({ scoreByRound: game.scoreByRound });
    this.closeModal();
    this.toast("Score adjustment added.", "success");
  }

  async removeAdjustment(group, id) {
    const game = structuredClone(this.store.get().game);
    const score = game.scoreByRound[game.round];
    score[group] = (score[group] || []).filter((item) => item.id !== id);
    this.store.patch("game.scoreByRound", game.scoreByRound);
    await this.patchGameRemote({ scoreByRound: game.scoreByRound });
  }

  async addCard(data) {
    const card = { id: randomId("card"), type: data.type || "custom", name: String(data.name || "Card").trim(), note: String(data.note || "").trim(), addedAt: toIso() };
    this.store.set((draft) => {
      draft.privateTeamState.cards.push(card);
      draft.privateTeamState.handLimit = Math.max(1, number(data.handLimit, draft.privateTeamState.handLimit || 6));
      return draft;
    });
    await this.savePrivateTeamState();
    this.closeModal();
    this.toast("Card added to the private hand.", "success");
  }

  async removeCard(id) {
    this.store.set((draft) => { draft.privateTeamState.cards = draft.privateTeamState.cards.filter((card) => card.id !== id); return draft; });
    await this.savePrivateTeamState();
  }

  async addTrap(data) {
    const game = structuredClone(this.store.get().game);
    const trap = { id: randomId("trap"), station: String(data.station || "").trim(), note: String(data.note || "").trim(), placedAt: toIso(), removedAt: null, placedBy: this.store.get().profile.name };
    game.traps.push(trap);
    this.store.patch("game.traps", game.traps);
    await this.patchGameRemote({ traps: game.traps });
    await this.recordEvent("trap", { station: trap.station, message: `Time trap placed at ${trap.station}.`, trapId: trap.id });
    this.closeModal();
    this.toast("Time-trap placement recorded.", "success");
  }

  async removeTrap(id) {
    const game = structuredClone(this.store.get().game);
    const trap = game.traps.find((item) => item.id === id);
    if (!trap) return;
    trap.removedAt = toIso();
    trap.removedBy = this.store.get().profile.name;
    this.store.patch("game.traps", game.traps);
    await this.patchGameRemote({ traps: game.traps });
    await this.recordEvent("trap", { station: trap.station, message: `Time trap removed/passed at ${trap.station}.`, trapId: trap.id });
  }

  async deleteTrap(id) {
    const game = structuredClone(this.store.get().game);
    game.traps = game.traps.filter((item) => item.id !== id);
    this.store.patch("game.traps", game.traps);
    await this.patchGameRemote({ traps: game.traps });
  }

  async addTrapToScore(id) {
    const game = structuredClone(this.store.get().game);
    const trap = game.traps.find((item) => item.id === id);
    if (!trap?.removedAt) throw new Error("Mark the trap removed before adding its time.");
    const seconds = Math.max(0, Math.floor((new Date(trap.removedAt) - new Date(trap.placedAt)) / 1000));
    const score = game.scoreByRound[game.round];
    score.timeTraps ||= [];
    score.timeTraps = score.timeTraps.filter((item) => item.sourceTrapId !== id);
    score.timeTraps.push({ id: randomId("trap-score"), sourceTrapId: id, label: `Trap: ${trap.station}`, seconds });
    this.store.patch("game.scoreByRound", game.scoreByRound);
    await this.patchGameRemote({ scoreByRound: game.scoreByRound });
    this.toast("Raw trap duration added to the score. Apply any card cap manually.", "success");
  }

  deductionRoundKey() {
    return String(this.store.get().game?.round || 1);
  }

  deductionRoundState() {
    const state = this.store.get();
    return normaliseDeductionRoundState(state.privateTeamState?.deductionByRound?.[this.deductionRoundKey()]);
  }

  deductionSnapshot(roundState) {
    const { undoStack: _undoStack, ...snapshot } = normaliseDeductionRoundState(roundState);
    return structuredClone(snapshot);
  }

  async mutateDeduction(mutator, { history = true } = {}) {
    const roundKey = this.deductionRoundKey();
    this.store.set((draft) => {
      draft.privateTeamState.deductionByRound ||= {};
      const current = normaliseDeductionRoundState(draft.privateTeamState.deductionByRound[roundKey]);
      if (history) current.undoStack = [...(current.undoStack || []).slice(-11), this.deductionSnapshot(current)];
      mutator(current, draft);
      draft.privateTeamState.deductionByRound[roundKey] = current;
      return draft;
    });
    await this.savePrivateTeamState();
  }

  async updateDeductionPreference(key, value) {
    await this.mutateDeduction((roundState) => { roundState[key] = value; }, { history: false });
  }

  async showDeductionConstraint(id) {
    if (!id) return;
    await this.mutateDeduction((roundState) => {
      roundState.mapDisplayMode = DEDUCTION_MAP_MODES.ANSWER;
      roundState.areaConstraintId = id;
      roundState.showAreaMask = true;
    }, { history: false });
  }

  async inspectDeductionStation(id, constraintId, mode) {
    if (!STATION_BY_ID.has(id)) throw new Error("Station not found.");
    this.store.patch("ui.deductionSelectedStationId", id);
    await this.mutateDeduction((roundState) => {
      roundState.showAreaMask = true;
      roundState.maskScope = "selected";
      if (mode === DEDUCTION_MAP_MODES.ENDGAME) {
        roundState.mapDisplayMode = DEDUCTION_MAP_MODES.ENDGAME;
        roundState.endgameStationId = id;
      } else {
        roundState.mapDisplayMode = DEDUCTION_MAP_MODES.ANSWER;
        if (constraintId) roundState.areaConstraintId = constraintId;
      }
    }, { history: false });
  }

  toggleDeductionShapeFields(form, shape) {
    if (!form) return;
    form.querySelectorAll("[data-shape-fields]").forEach((section) => {
      section.hidden = section.dataset.shapeFields !== shape;
      section.querySelectorAll("input, textarea, select, button").forEach((control) => {
        if (control.dataset.action === "deduction-area-shape") return;
        control.disabled = section.hidden;
      });
    });
  }

  startDeductionVertexPick(button) {
    const form = button.closest("form");
    const textarea = form?.querySelector('[name="polygonPoints"]');
    if (!form || !textarea) throw new Error("Open the manual polygon tool first.");
    beginDeductionMapPick("polygon", ({ lat, lng }) => {
      if (!form.isConnected) return;
      const line = `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
      textarea.value = `${textarea.value.trim()}${textarea.value.trim() ? "\n" : ""}${line}`;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      this.toast("Polygon vertex added. Add at least three in boundary order.", "success");
    });
    this.toast("Tap the next polygon corner on the map.", "warning");
  }

  clearDeductionVertices(button) {
    const textarea = button.closest("form")?.querySelector('[name="polygonPoints"]');
    if (!textarea) return;
    textarea.value = "";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  parseDeductionPolygon(value) {
    const points = String(value || "")
      .split(/\r?\n|;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [latValue, lngValue] = line.split(/[\s,]+/).filter(Boolean);
        return { lat: Number(latValue), lng: Number(lngValue) };
      });
    if (points.length < 3) throw new Error("Add at least three latitude,longitude vertices for the manual polygon.");
    if (points.some((point) => !Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90 || !Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180)) {
      throw new Error("Every polygon vertex must be a valid latitude,longitude pair.");
    }
    return points;
  }

  async saveSpatialData(spatialData, successMessage) {
    const normalised = normaliseSpatialData(spatialData);
    this.store.patch("privateTeamState.spatialData", normalised);
    await this.savePrivateTeamState();
    this.toast(successMessage || `${normalised.features.length} map features imported.`, "success");
  }

  async importSpatialData(form) {
    const input = form.querySelector('input[type="file"][name="spatialDataFile"]');
    const file = input?.files?.[0];
    if (!file) throw new Error("Choose a KML, KMZ or GeoJSON file first.");
    const spatialData = await parseSpatialDataFile(file);
    await this.saveSpatialData(spatialData, `${spatialData.features.length} authoritative map features imported from ${file.name}.`);
    form.reset();
  }

  async loadConfiguredSpatialData(button) {
    if (button) button.disabled = true;
    try {
      this.toast("Downloading the configured public Google My Map…", "");
      const spatialData = await fetchConfiguredSpatialData();
      await this.saveSpatialData(spatialData, `${spatialData.features.length} features loaded from the configured Google My Map.`);
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  }

  async clearSpatialData() {
    if (!window.confirm("Clear the imported KML/KMZ geometry from this seeker team's private state? Linked questions will remain in the audit trail.")) return;
    await this.saveSpatialData({ version: 1, sourceName: "No map data imported", importedAt: null, features: [] }, "Imported map data cleared.");
  }

  deductionPoint(data, prefix, label) {
    const lat = Number(data[`${prefix}Lat`]);
    const lng = Number(data[`${prefix}Lng`]);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error(`Enter valid latitude and longitude for ${label}.`);
    }
    return { lat, lng };
  }

  async addDeductionConstraint(form, data) {
    const type = form.dataset.constraintType;
    const base = {
      id: randomId("deduction"),
      source: "manual",
      type,
      label: String(data.label || "").trim(),
      createdAt: toIso(),
      movementMode: data.movementMode === DEDUCTION_MOVEMENT.LOCKED ? DEDUCTION_MOVEMENT.LOCKED : DEDUCTION_MOVEMENT.MOBILE,
      linkedQuestionInstanceId: String(data.linkedQuestionInstanceId || "") || null,
      enabled: true
    };
    let constraint;
    if (type === DEDUCTION_TOOL_TYPES.RADAR) {
      const radiusMetres = Number(data.radiusKm) * 1000;
      if (!Number.isFinite(radiusMetres) || radiusMetres <= 0) throw new Error("Enter a valid radar radius.");
      constraint = { ...base, centre: this.deductionPoint(data, "centre", "the seeker pin"), radiusMetres, answer: data.answer === "no" ? "no" : "yes" };
    } else if (type === DEDUCTION_TOOL_TYPES.THERMOMETER) {
      constraint = {
        ...base,
        start: this.deductionPoint(data, "start", "the thermometer start"),
        end: this.deductionPoint(data, "end", "the thermometer end"),
        answer: data.answer === "colder" ? "colder" : "hotter"
      };
      if (haversineMetres(constraint.start, constraint.end) < 20) throw new Error("The thermometer endpoints are too close together to create a useful boundary.");
    } else if (type === DEDUCTION_TOOL_TYPES.DISTANCE) {
      constraint = {
        ...base,
        seeker: this.deductionPoint(data, "seeker", "the seeker pin"),
        target: this.deductionPoint(data, "target", "the reference pin"),
        answer: data.answer === "further" ? "further" : "closer"
      };
    } else if (type === DEDUCTION_TOOL_TYPES.STATION_NAME) {
      const station = STATION_BY_ID.get(data.seekerStationId);
      if (!station) throw new Error("Choose the seeker's station.");
      constraint = {
        ...base,
        movementMode: DEDUCTION_MOVEMENT.MOBILE,
        seekerStationId: station.id,
        seekerLength: stationNameLength(station.name),
        answer: ["same", "longer", "shorter"].includes(data.answer) ? data.answer : "same"
      };
    } else if (type === DEDUCTION_TOOL_TYPES.TRANSIT) {
      const stationIds = new FormData(form).getAll("stationIds").map(String).filter((id) => STATION_BY_ID.has(id));
      const lineId = String(data.lineId || "");
      if (!lineId && !stationIds.length) throw new Error("Choose a line preset or select the train's exact stops.");
      constraint = {
        ...base,
        movementMode: DEDUCTION_MOVEMENT.MOBILE,
        lineId: lineId || null,
        stationIds,
        answer: data.answer === "no" ? "no" : "yes"
      };
    } else if (type === DEDUCTION_TOOL_TYPES.THAMES) {
      constraint = {
        ...base,
        seekerSide: ["north", "south", "both"].includes(data.seekerSide) ? data.seekerSide : "north",
        answer: data.answer === "no" ? "no" : "yes"
      };
    } else if (type === DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_MATCH) {
      constraint = {
        ...base,
        seeker: this.deductionPoint(data, "seeker", "the seeker pin"),
        category: String(data.category || ""),
        answer: data.answer === "no" ? "no" : "yes"
      };
      if (!constraint.category) throw new Error("Choose the imported feature layer to match.");
    } else if (type === DEDUCTION_TOOL_TYPES.REGION_MATCH) {
      constraint = {
        ...base,
        seeker: this.deductionPoint(data, "seeker", "the seeker pin"),
        category: String(data.category || ""),
        answer: data.answer === "no" ? "no" : "yes"
      };
      if (!constraint.category) throw new Error("Choose the administrative boundary layer.");
    } else if (type === DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE) {
      constraint = {
        ...base,
        seeker: this.deductionPoint(data, "seeker", "the seeker pin"),
        category: String(data.category || ""),
        boundaryOnly: data.boundaryOnly === "on",
        answer: data.answer === "further" ? "further" : "closer"
      };
      if (!constraint.category) throw new Error("Choose the imported feature layer to measure.");
    } else if (type === DEDUCTION_TOOL_TYPES.NEAREST_STATION_DISTANCE) {
      constraint = {
        ...base,
        seeker: this.deductionPoint(data, "seeker", "the seeker pin"),
        answer: data.answer === "further" ? "further" : "closer"
      };
    } else if (type === DEDUCTION_TOOL_TYPES.TENTACLE) {
      const answerFeatureName = String(data.answerFeatureName || "").trim();
      if (!answerFeatureName) throw new Error("Enter the POI name returned by the hider.");
      constraint = {
        ...base,
        seeker: this.deductionPoint(data, "seeker", "the seeker pin"),
        category: String(data.category || "museum"),
        radiusMetres: 2000,
        answerFeatureName,
        answer: answerFeatureName
      };
    } else if (type === DEDUCTION_TOOL_TYPES.MANUAL_AREA) {
      const shape = data.shape === "circle" ? "circle" : "polygon";
      constraint = {
        ...base,
        shape,
        answer: data.answer === "outside" ? "outside" : "inside"
      };
      if (shape === "circle") {
        const radiusMetres = Number(data.radiusMetres);
        if (!Number.isFinite(radiusMetres) || radiusMetres <= 0) throw new Error("Enter a valid manual-circle radius.");
        constraint.centre = this.deductionPoint(data, "centre", "the manual circle centre");
        constraint.radiusMetres = radiusMetres;
      } else {
        constraint.polygon = this.parseDeductionPolygon(data.polygonPoints);
      }
    } else {
      throw new Error("This deduction tool is not supported.");
    }
    await this.mutateDeduction((roundState) => {
      roundState.constraints.push(constraint);
      if (constraint.type !== DEDUCTION_TOOL_TYPES.STATION_NAME && constraint.type !== DEDUCTION_TOOL_TYPES.TRANSIT) {
        roundState.areaConstraintId = constraint.id;
        roundState.mapDisplayMode = constraint.movementMode === DEDUCTION_MOVEMENT.LOCKED ? DEDUCTION_MAP_MODES.ENDGAME : DEDUCTION_MAP_MODES.ANSWER;
        roundState.showAreaMask = true;
      }
    });
    this.toast("Deduction applied to the private seeker map.", "success");
  }

  fillCoordinateFields(form, prefix, point) {
    if (!form || !point) return;
    const lat = form.querySelector(`[name="${CSS.escape(prefix)}Lat"]`);
    const lng = form.querySelector(`[name="${CSS.escape(prefix)}Lng"]`);
    if (!lat || !lng) throw new Error("The coordinate fields could not be found.");
    lat.value = Number(point.lat).toFixed(6);
    lng.value = Number(point.lng).toFixed(6);
    lat.dispatchEvent(new Event("input", { bubbles: true }));
    lng.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async fillDeductionCoordinates(prefix, button) {
    const form = button.closest("form");
    if (!form) throw new Error("Open a deduction tool first.");
    let point = this.store.get().location.current;
    if (!point) point = await this.location.getCurrent();
    this.fillCoordinateFields(form, prefix, point);
    this.toast("GPS coordinates added.", "success");
  }

  startDeductionMapPick(prefix, button) {
    const form = button.closest("form");
    if (!form) throw new Error("Open a deduction tool first.");
    beginDeductionMapPick(prefix, ({ lat, lng }) => {
      if (!form.isConnected) return;
      this.fillCoordinateFields(form, prefix, { lat, lng });
      this.toast("Map coordinates added.", "success");
    });
    this.toast("Tap the required point on the map.", "warning");
  }

  focusDeductionStation(id) {
    const geo = STATION_GEO_BY_ID.get(id);
    if (!geo) return;
    this.store.patch("ui.deductionSelectedStationId", id);
    requestAnimationFrame(() => focusDeductionStation(geo));
  }

  async toggleDeductionStationEliminated(id) {
    if (!STATION_BY_ID.has(id)) throw new Error("Station not found.");
    await this.mutateDeduction((roundState) => {
      const existing = roundState.stationOverrides[id] || {};
      roundState.stationOverrides[id] = { ...existing, eliminated: !existing.eliminated, updatedAt: toIso() };
      if (!roundState.stationOverrides[id].eliminated && !roundState.stationOverrides[id].priority && !roundState.stationOverrides[id].note) delete roundState.stationOverrides[id];
    });
  }

  async toggleDeductionStationPriority(id) {
    if (!STATION_BY_ID.has(id)) throw new Error("Station not found.");
    await this.mutateDeduction((roundState) => {
      const existing = roundState.stationOverrides[id] || {};
      roundState.stationOverrides[id] = { ...existing, priority: !existing.priority, eliminated: existing.priority ? existing.eliminated : false, updatedAt: toIso() };
      if (!roundState.stationOverrides[id].eliminated && !roundState.stationOverrides[id].priority && !roundState.stationOverrides[id].note) delete roundState.stationOverrides[id];
    });
  }

  async toggleAutomaticDeduction(id) {
    await this.mutateDeduction((roundState) => {
      const ignored = new Set(roundState.ignoredAutoConstraintIds || []);
      ignored.has(id) ? ignored.delete(id) : ignored.add(id);
      roundState.ignoredAutoConstraintIds = [...ignored];
    });
  }

  async removeDeductionConstraint(id) {
    await this.mutateDeduction((roundState) => {
      roundState.constraints = roundState.constraints.filter((constraint) => constraint.id !== id);
    });
  }

  async undoDeduction() {
    const roundKey = this.deductionRoundKey();
    let restored = false;
    this.store.set((draft) => {
      draft.privateTeamState.deductionByRound ||= {};
      const current = normaliseDeductionRoundState(draft.privateTeamState.deductionByRound[roundKey]);
      const previous = current.undoStack?.at(-1);
      if (!previous) return draft;
      const remainingUndo = current.undoStack.slice(0, -1);
      draft.privateTeamState.deductionByRound[roundKey] = { ...createDeductionRoundState(), ...structuredClone(previous), undoStack: remainingUndo };
      restored = true;
      return draft;
    });
    if (!restored) return this.toast("Nothing to undo.", "warning");
    await this.savePrivateTeamState();
    this.toast("Last deduction-map change undone.", "success");
  }

  async resetDeductionRound() {
    if (!window.confirm("Reset every manual deduction, ignored answer and station mark for this round? Shared question history will not be deleted.")) return;
    await this.mutateDeduction((roundState) => {
      roundState.constraints = [];
      roundState.stationOverrides = {};
      roundState.ignoredAutoConstraintIds = [];
    });
    this.toast("Round deduction map reset. Answer records remain intact.", "success");
  }

  questionDeductionInput(question, data, form, state) {
    if (!question || data.deductionEnabled !== "on") return null;
    const config = questionDeductionConfig(question);
    const movementMode = data.deductionMovementMode === DEDUCTION_MOVEMENT.LOCKED || state.game?.phase === PHASES.ENDGAME
      ? DEDUCTION_MOVEMENT.LOCKED
      : DEDUCTION_MOVEMENT.MOBILE;

    if (config.mode === "guided") {
      return {
        enabled: true,
        type: DEDUCTION_TOOL_TYPES.MANUAL_REVIEW,
        movementMode,
        reviewReason: config.reason || "This answer needs seeker judgement before it can become an area mask."
      };
    }
    if (question.category === "radar") {
      const fixedRadius = {
        "radar-0-5": 500,
        "radar-1": 1000,
        "radar-2": 2000,
        "radar-5": 5000,
        "radar-10": 10000
      }[question.id];
      const customRadius = Number.parseFloat(String(data.customValue || "").replace(",", ".")) * 1000;
      const radiusMetres = fixedRadius || customRadius;
      if (!Number.isFinite(radiusMetres) || radiusMetres <= 0) throw new Error("Enter a valid custom radar radius before adding it to the deduction map.");
      return {
        enabled: true,
        type: DEDUCTION_TOOL_TYPES.RADAR,
        movementMode,
        centre: this.deductionPoint(data, "deductionCentre", "the radar pin"),
        radiusMetres
      };
    }
    if (question.category === "thermometer") {
      return {
        enabled: true,
        type: DEDUCTION_TOOL_TYPES.THERMOMETER,
        movementMode,
        start: this.deductionPoint(data, "deductionStart", "the thermometer start"),
        end: this.deductionPoint(data, "deductionEnd", "the thermometer end")
      };
    }
    if (question.id === "matching-station-name") {
      const station = STATION_BY_ID.get(data.deductionSeekerStationId);
      if (!station) throw new Error("Choose the seeker's station for automatic name-length filtering.");
      return {
        enabled: true,
        type: DEDUCTION_TOOL_TYPES.STATION_NAME,
        movementMode: DEDUCTION_MOVEMENT.MOBILE,
        seekerStationId: station.id,
        seekerLength: stationNameLength(station.name)
      };
    }
    if (question.id === "matching-rail-line") {
      const stationIds = new FormData(form).getAll("deductionStationIds").map(String).filter((id) => STATION_BY_ID.has(id));
      const lineId = String(data.deductionLineId || "");
      if (!lineId && !stationIds.length) throw new Error("Choose a transit-line preset or the exact stops for automatic filtering.");
      return {
        enabled: true,
        type: DEDUCTION_TOOL_TYPES.TRANSIT,
        movementMode: DEDUCTION_MOVEMENT.MOBILE,
        lineId: lineId || null,
        stationIds
      };
    }
    if (question.id === "matching-landmass") {
      if (!["north", "south", "both"].includes(data.deductionSeekerSide)) throw new Error("Choose the seeker's side of the Thames.");
      return {
        enabled: true,
        type: DEDUCTION_TOOL_TYPES.THAMES,
        movementMode,
        seekerSide: data.deductionSeekerSide
      };
    }

    const seeker = config.requiresSeekerPoint
      ? this.deductionPoint(data, "deductionSeeker", "the seeker pin")
      : null;
    if ([DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_MATCH, DEDUCTION_TOOL_TYPES.REGION_MATCH].includes(config.type)) {
      return { enabled: true, type: config.type, movementMode, seeker, category: config.category };
    }
    if (config.type === DEDUCTION_TOOL_TYPES.NEAREST_FEATURE_DISTANCE) {
      return { enabled: true, type: config.type, movementMode, seeker, category: config.category, boundaryOnly: Boolean(config.boundaryOnly) };
    }
    if (config.type === DEDUCTION_TOOL_TYPES.NEAREST_STATION_DISTANCE) {
      return { enabled: true, type: config.type, movementMode, seeker };
    }
    if (config.type === DEDUCTION_TOOL_TYPES.TENTACLE) {
      return { enabled: true, type: config.type, movementMode, seeker, category: config.category, radiusMetres: 2000 };
    }
    return {
      enabled: true,
      type: DEDUCTION_TOOL_TYPES.MANUAL_REVIEW,
      movementMode,
      reviewReason: "This answer is linked to the audit trail and can be converted to a manual area after review."
    };
  }

  randomStation() {
    const state = this.store.get();
    const used = new Set(state.game?.usedStations || []);
    const available = STATIONS.filter((station) => !used.has(station.id));
    const pool = available.length ? available : STATIONS;
    const station = pool[Math.floor(Math.random() * pool.length)];
    this.store.patch("ui.randomStationId", station.id);
  }

  async chooseStation(stationId, resolve = false) {
    const station = STATION_BY_ID.get(stationId);
    if (!station) throw new Error("Choose a valid station.");
    const cached = cachedStationCoordinates(station.id);
    this.store.set((draft) => {
      draft.privateTeamState.stationId = station.id;
      draft.privateTeamState.stationName = station.name;
      draft.privateTeamState.stationCoords = cached;
      return draft;
    });
    await this.savePrivateTeamState();
    if (resolve) await this.resolveSelectedStation();
  }

  async resolveSelectedStation() {
    const station = STATION_BY_ID.get(this.store.get().privateTeamState.stationId);
    if (!station) throw new Error("Choose a station first.");
    this.toast("Resolving station coordinates...", "");
    const coords = await resolveStationCoordinates(station);
    this.store.patch("privateTeamState.stationCoords", coords);
    await this.savePrivateTeamState();
    if (this.store.get().ui.view === VIEWS.MAP && this.store.get().ui.mapMode === "zone") updateZoneMap({ station: this.stationMapObject(), positions: this.mapPositions(), radiusMetres: 500 });
    this.toast(`Coordinates resolved via ${coords.source}.`, "success");
  }

  async toggleUsedStation(id) {
    const game = structuredClone(this.store.get().game);
    if (!game) throw new Error("Create a game first.");
    const set = new Set(game.usedStations || []);
    set.has(id) ? set.delete(id) : set.add(id);
    game.usedStations = [...set];
    this.store.patch("game.usedStations", game.usedStations);
    await this.patchGameRemote({ usedStations: game.usedStations });
  }

  stationMapObject() {
    const state = this.store.get();
    const station = STATION_BY_ID.get(state.privateTeamState.stationId);
    const coords = state.privateTeamState.stationCoords;
    return station && coords ? { ...station, ...coords } : null;
  }

  mapPositions() {
    const state = this.store.get();
    const currentUserId = state.connection.mode === "connected" ? this.sync.session?.user?.id : state.profile.id;
    const positions = (state.positions || []).map((position) => ({
      ...position,
      lat: Number(position.lat),
      lng: Number(position.lng),
      name: position.displayName || position.display_name,
      isOwn: (position.userId || position.user_id) === currentUserId,
      teamLabel: TEAM_LABELS[position.team]
    }));
    if (state.location.current && !positions.some((position) => position.isOwn)) positions.push({ ...state.location.current, name: state.profile.name, team: state.profile.team, teamLabel: TEAM_LABELS[state.profile.team], isOwn: true });
    return positions;
  }

  async startLocationSharing() {
    const state = this.store.get();
    if (!this.location.supported()) throw new Error("Geolocation is not supported by this browser.");
    const isHider = state.game && state.profile.team === state.game.hiderTeam;
    if (isHider && state.location.shareWith === "all" && !window.confirm("You are on the hiding team. Sharing with everyone may reveal your location. Continue?")) return;
    const current = await this.location.getCurrent();
    this.store.set((draft) => { draft.location.sharing = true; draft.location.current = current; draft.location.error = null; return draft; });
    this.location.start();
    await this.pushPosition(current, true);
    this.toast("Foreground location sharing started.", "success");
  }

  async stopLocationSharing() {
    this.location.stop();
    if (this.store.get().connection.mode === "connected") await this.sync.removePosition();
    const ownId = this.store.get().connection.mode === "connected" ? this.sync.session?.user?.id : this.store.get().profile.id;
    this.store.set((draft) => {
      draft.location.sharing = false;
      draft.positions = draft.positions.filter((position) => (position.userId || position.user_id) !== ownId);
      return draft;
    });
    this.toast("Location sharing stopped and the current remote position was removed.", "success");
  }

  async handlePosition(position) {
    this.store.patch("location.current", position);
    if (this.store.get().location.sharing) await this.pushPosition(position, false);
    if (this.store.get().ui.view === VIEWS.MAP && this.store.get().ui.mapMode === "zone") updateZoneMap({ station: this.stationMapObject(), positions: this.mapPositions(), radiusMetres: 500 });
    this.maybePromptEndgame(position);
  }

  handleLocationError(error) {
    this.store.patch("location.error", error.message);
    this.toast(error.message, "warning");
  }

  async pushPosition(position, force = false) {
    if (!position) return;
    if (!force && Date.now() - this.locationUploadAt < 8000) return;
    this.locationUploadAt = Date.now();
    const state = this.store.get();
    const ownId = state.connection.mode === "connected" ? this.sync.session?.user?.id : state.profile.id;
    const own = { gameId: state.game?.id, userId: ownId, team: state.profile.team, displayName: state.profile.name, ...position, sharingWith: state.location.shareWith };
    this.store.set((draft) => { draft.positions = [...draft.positions.filter((item) => (item.userId || item.user_id) !== ownId), own]; return draft; });
    if (state.connection.mode === "connected") await this.sync.upsertPosition({ ...position, sharingWith: state.location.shareWith, displayName: state.profile.name, team: state.profile.team });
  }

  maybePromptEndgame() {
    const state = this.store.get();
    if (!state.game || state.game.phase !== PHASES.SEEKING || state.profile.team !== state.game.hiderTeam || !state.privateTeamState.stationCoords) return;
    const seekerTeam = state.game.hiderTeam === "alpha" ? "bravo" : "alpha";
    if (state.game.transit?.[seekerTeam]?.active) return;
    const nearby = state.positions.find((position) => position.team === seekerTeam && haversineMetres(position, state.privateTeamState.stationCoords) <= 500);
    if (nearby && !this.transitionLock) {
      this.transitionLock = true;
      this.toast("A seeker position is inside 500 m and off transit. Confirm endgame from the game settings if this is a real trigger.", "warning");
      setTimeout(() => { this.transitionLock = false; }, 60_000);
    }
  }

  async refreshTfl() {
    this.store.set((draft) => { draft.tfl.status = "loading"; draft.tfl.error = null; return draft; });
    try {
      const lines = await fetchTflStatus();
      this.store.set((draft) => { draft.tfl.status = "ready"; draft.tfl.lines = lines; draft.tfl.updatedAt = toIso(); return draft; });
    } catch (error) {
      this.store.set((draft) => { draft.tfl.status = "error"; draft.tfl.error = error.message; return draft; });
    }
  }

  async shareInvite() {
    const state = this.store.get();
    if (!state.game) return;
    if (state.connection.mode !== "connected") return this.toast("Local Mode cannot link another device. Create a Connected Mode room first.", "warning");
    const url = new URL(location.href);
    url.searchParams.set("join", state.game.code);
    url.searchParams.set("view", "play");
    const shareData = { title: `${state.game.name} - HideLine`, text: `Join room ${state.game.code} in HideLine.`, url: url.toString() };
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      this.toast("Invite link copied.", "success");
    }
  }

  exportGame() {
    const state = this.store.get();
    downloadJson(`hideline-${state.game?.code || "export"}-${new Date().toISOString().slice(0, 10)}.json`, {
      exportedAt: toIso(),
      appVersion: APP_VERSION,
      game: state.game,
      questions: state.questions,
      events: state.events,
      privateTeamState: state.privateTeamState,
      checklist: state.checklist
    });
  }

  async leaveGame() {
    if (!window.confirm("Leave this game on this device? The connected room will remain available to other members.")) return;
    const leavingGameId = this.store.get().game?.id;
    await this.stopLocationSharing().catch(() => {});
    await this.sync.leave().catch(() => {});
    if (this.store.get().connection.mode === "local" && leavingGameId) await clearEvidenceStore(leavingGameId).catch(() => {});
    this.store.set((draft) => {
      draft.game = null;
      draft.questions = [];
      draft.events = [];
      draft.positions = [];
      draft.privateTeamState = {
        stationId: null,
        stationName: null,
        stationCoords: null,
        hidingSpotNote: "",
        cards: [],
        handLimit: 6,
        privateNotes: "",
        deductionByRound: {},
        spatialData: { version: 1, sourceName: "No map data imported", importedAt: null, features: [] }
      };
      draft.connection.mode = "local";
      draft.connection.status = "offline";
      draft.connection.gameId = null;
      draft.connection.roomCode = null;
      return draft;
    });
    this.closeModal();
  }

  async resetApp() {
    if (!window.confirm("Reset all HideLine data stored in this browser? This cannot be undone.")) return;
    await this.sync.leave().catch(() => {});
    this.location.stop();
    await clearEvidenceStore().catch(() => {});
    localStorage.removeItem(STORAGE_KEY);
    this.store.reset();
    this.closeModal();
    this.toast("Local app data reset.", "success");
  }

  startClock() {
    setInterval(() => {
      this.updateLiveClocks();
      this.maybeAdvancePhase().catch((error) => console.error(error));
    }, 1000);
  }

  updateLiveClocks() {
    const state = this.store.get();
    const game = state.game;
    const timer = document.querySelector("[data-live-timer]");
    if (timer && game) {
      const elapsed = activeElapsedSeconds(game.timers.roundStartedAt, game.timers.roundStoppedAt, game.timers.pauses);
      if (game.phase === PHASES.LOBBY) timer.textContent = "Ready";
      else if (game.phase === PHASES.HIDING) timer.textContent = formatDuration(Math.max(0, game.timers.hidingPeriodSeconds - elapsed));
      else timer.textContent = formatDuration(Math.max(0, elapsed - game.timers.hidingPeriodSeconds));
    }
    document.querySelectorAll("[data-question-countdown]").forEach((element) => {
      const record = state.questions.find((question) => question.id === element.dataset.questionCountdown);
      if (!record) return;
      const remaining = questionSecondsRemaining(record);
      element.textContent = remaining < 0 ? `+${formatDuration(Math.abs(remaining))}` : formatDuration(remaining);
      element.classList.toggle("overdue", remaining < 0);
    });
  }

  async maybeAdvancePhase() {
    const state = this.store.get();
    const game = state.game;
    if (!game?.timers?.roundStartedAt || this.transitionLock) return;
    const lastPause = game.timers.pauses?.at(-1);
    if (lastPause && !lastPause.endedAt) return;
    const elapsed = activeElapsedSeconds(game.timers.roundStartedAt, game.timers.roundStoppedAt, game.timers.pauses);
    if (game.phase === PHASES.HIDING && elapsed >= game.timers.hidingPeriodSeconds) {
      this.transitionLock = true;
      const next = structuredClone(game);
      next.phase = PHASES.SEEKING;
      this.store.patch("game.phase", PHASES.SEEKING);
      await this.patchGameRemote({ phase: PHASES.SEEKING });
      await this.recordEvent("release", { message: "The 45-minute hiding period ended. Seekers are released." });
      this.toast("Seekers released. Hiders must now remain inside the 500 m zone.", "success");
      this.transitionLock = false;
    } else if ([PHASES.SEEKING, PHASES.ENDGAME].includes(game.phase) && elapsed >= game.timers.cutoffSeconds) {
      this.transitionLock = true;
      const next = structuredClone(game);
      next.phase = PHASES.COMPLETE;
      next.timers.roundStoppedAt = toIso();
      const hidingSeconds = Math.max(0, elapsed - next.timers.hidingPeriodSeconds);
      next.scoreByRound[next.round].hidingSeconds = hidingSeconds;
      this.store.patch("game", next);
      await this.patchGameRemote({ phase: next.phase, timers: next.timers, scoreByRound: next.scoreByRound });
      await this.recordEvent("cutoff", { message: "Round cutoff reached before the hiders were found.", hidingSeconds });
      this.toast("Round cutoff reached. Record final bonuses and penalties.", "warning");
      this.transitionLock = false;
    }
  }

  async registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    try { await navigator.serviceWorker.register("./service-worker.js", { scope: "./" }); } catch (error) { console.warn("Service worker registration failed", error); }
  }
}

const root = document.getElementById("app");
const app = new HideLineApp(root);
app.init().catch((error) => {
  console.error(error);
  root.innerHTML = `<main class="content"><section class="card card-pad"><h1>HideLine could not start</h1><p>${escapeHtml(error.message)}</p></section></main>`;
});
