import { SUPABASE_MODULE_URL } from "../core/constants.js";

let modulePromise;
function loadModule() {
  modulePromise ??= import(SUPABASE_MODULE_URL);
  return modulePromise;
}

export class SupabaseSync extends EventTarget {
  constructor() {
    super();
    this.client = null;
    this.session = null;
    this.gameId = null;
    this.channel = null;
    this.heartbeatTimer = null;
    this.member = null;
  }

  async connect(url, anonKey) {
    if (!url || !anonKey) throw new Error("Enter a Supabase project URL and anon key.");
    const { createClient } = await loadModule();
    this.client = createClient(url.trim().replace(/\/$/, ""), anonKey.trim(), {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } },
      global: { headers: { "x-client-info": "hideline/2.1.0" } }
    });
    const { data: sessionData } = await this.client.auth.getSession();
    this.session = sessionData.session;
    if (!this.session) {
      const { data, error } = await this.client.auth.signInAnonymously();
      if (error) throw new Error(`Anonymous sign-in failed: ${error.message}. Enable anonymous users in Supabase Auth.`);
      this.session = data.session;
    }
    this.dispatchEvent(new CustomEvent("status", { detail: { status: "online", userId: this.session.user.id } }));
    return this.session;
  }

  async createGame({ gameName, displayName, team = "alpha" }) {
    this.requireClient();
    const { data, error } = await this.client.rpc("create_game", {
      p_game_name: gameName,
      p_display_name: displayName,
      p_team: team
    });
    if (error) throw new Error(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.game_id) throw new Error("Supabase did not return a game ID.");
    this.gameId = result.game_id;
    const hydrated = await this.hydrate(this.gameId);
    await this.subscribe(this.gameId);
    return hydrated;
  }

  async joinGame({ code, displayName, team = "alpha" }) {
    this.requireClient();
    const { data, error } = await this.client.rpc("join_game", {
      p_join_code: String(code).trim().toUpperCase(),
      p_display_name: displayName,
      p_team: team
    });
    if (error) throw new Error(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.game_id) throw new Error("No game was found for that code.");
    this.gameId = result.game_id;
    const hydrated = await this.hydrate(this.gameId);
    await this.subscribe(this.gameId);
    return hydrated;
  }

  async hydrate(gameId = this.gameId) {
    this.requireClient();
    const [gameResult, memberResult, eventsResult, teamStateResult, positionsResult] = await Promise.all([
      this.client.from("games").select("id,join_code,name,created_by,created_at,updated_at,version,state").eq("id", gameId).single(),
      this.client.from("game_members").select("game_id,user_id,display_name,team,is_host,joined_at,last_seen").eq("game_id", gameId).order("joined_at"),
      this.client.from("game_events").select("id,game_id,created_by,team,visibility,event_type,payload,created_at").eq("game_id", gameId).order("created_at", { ascending: false }).limit(250),
      this.client.from("team_states").select("game_id,team,state,updated_at").eq("game_id", gameId).maybeSingle(),
      this.client.from("positions").select("game_id,user_id,team,display_name,lat,lng,accuracy,altitude,sharing_with,recorded_at").eq("game_id", gameId)
    ]);
    for (const result of [gameResult, memberResult, eventsResult, teamStateResult, positionsResult]) {
      if (result.error) throw new Error(result.error.message);
    }
    const currentUserId = this.session?.user?.id;
    this.member = memberResult.data.find((member) => member.user_id === currentUserId) || null;
    return {
      game: gameResult.data,
      members: memberResult.data || [],
      events: eventsResult.data || [],
      teamState: teamStateResult.data || null,
      positions: positionsResult.data || [],
      currentUserId,
      member: this.member
    };
  }

  async patchGame(patch) {
    this.requireGame();
    const { data, error } = await this.client.rpc("patch_game_state", { p_game_id: this.gameId, p_patch: patch });
    if (error) throw new Error(error.message);
    return data;
  }

  async saveTeamState(state) {
    this.requireGame();
    const { data, error } = await this.client.rpc("save_team_state", { p_game_id: this.gameId, p_state: state });
    if (error) throw new Error(error.message);
    return data;
  }

  async postEvent({ type, payload = {}, visibility = "all" }) {
    this.requireGame();
    const userId = this.session.user.id;
    const team = this.member?.team || payload.team || "alpha";
    const { data, error } = await this.client.from("game_events").insert({
      game_id: this.gameId,
      created_by: userId,
      team,
      visibility,
      event_type: type,
      payload
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateProfile({ displayName, team }) {
    this.requireGame();
    const { error } = await this.client.from("game_members").update({
      display_name: displayName,
      team,
      last_seen: new Date().toISOString()
    }).eq("game_id", this.gameId).eq("user_id", this.session.user.id);
    if (error) throw new Error(error.message);
    this.member = { ...this.member, display_name: displayName, team };
    if (this.channel) {
      await this.channel.track({
        displayName,
        team,
        onlineAt: new Date().toISOString()
      });
    }
  }

  async heartbeat() {
    if (!this.client || !this.gameId || !this.session) return;
    await this.client.from("game_members").update({ last_seen: new Date().toISOString() }).eq("game_id", this.gameId).eq("user_id", this.session.user.id);
  }

  async upsertPosition({ lat, lng, accuracy, altitude, sharingWith = "team", displayName, team }) {
    this.requireGame();
    const { error } = await this.client.from("positions").upsert({
      game_id: this.gameId,
      user_id: this.session.user.id,
      team: team || this.member?.team || "alpha",
      display_name: displayName || this.member?.display_name || "Player",
      lat,
      lng,
      accuracy,
      altitude,
      sharing_with: sharingWith,
      recorded_at: new Date().toISOString()
    }, { onConflict: "game_id,user_id" });
    if (error) throw new Error(error.message);
  }

  async removePosition() {
    if (!this.client || !this.gameId || !this.session) return;
    const { error } = await this.client.from("positions").delete().eq("game_id", this.gameId).eq("user_id", this.session.user.id);
    if (error) throw new Error(error.message);
  }

  async uploadEvidence(file, questionId) {
    this.requireGame();
    const path = `${this.gameId}/${questionId}/${this.session.user.id}/${Date.now()}.jpg`;
    const { error } = await this.client.storage.from("game-evidence").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) throw new Error(error.message);
    return path;
  }

  async signedEvidenceUrl(path, expiresIn = 24 * 60 * 60) {
    this.requireClient();
    if (!path) return null;
    const { data, error } = await this.client.storage.from("game-evidence").createSignedUrl(path, expiresIn);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  async subscribe(gameId) {
    this.requireClient();
    if (this.channel) await this.client.removeChannel(this.channel);
    this.gameId = gameId;
    this.channel = this.client.channel(`hideline:${gameId}`, { config: { presence: { key: this.session.user.id } } });
    const emitRefresh = (table, payload) => this.dispatchEvent(new CustomEvent("remote-change", { detail: { table, payload } }));
    this.channel.on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => emitRefresh("games", payload));
    for (const table of ["game_members", "game_events", "team_states", "positions"]) {
      this.channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `game_id=eq.${gameId}` }, (payload) => emitRefresh(table, payload));
    }
    this.channel.on("presence", { event: "sync" }, () => {
      this.dispatchEvent(new CustomEvent("presence", { detail: this.channel.presenceState() }));
    });
    await new Promise((resolve, reject) => {
      this.channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this.channel.track({ displayName: this.member?.display_name || "Player", team: this.member?.team || "alpha", onlineAt: new Date().toISOString() });
          resolve();
        }
        if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) reject(new Error(`Realtime channel ${status.toLowerCase().replaceAll("_", " ")}.`));
      });
    });
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => this.heartbeat().catch(() => {}), 45_000);
  }

  async leave() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    if (this.client && this.channel) await this.client.removeChannel(this.channel);
    this.channel = null;
    this.gameId = null;
    this.member = null;
  }

  requireClient() {
    if (!this.client || !this.session) throw new Error("Connected Mode is not configured or signed in.");
  }

  requireGame() {
    this.requireClient();
    if (!this.gameId) throw new Error("Join or create a connected game first.");
  }
}
