import { VIEW_META, VIEWS } from "../core/constants.js";
import { escapeHtml, initials } from "../core/format.js";
import { icon } from "./icons.js";

const NAV_ITEMS = [
  { id: VIEWS.PLAY, label: "Game", icon: "play", activeViews: [VIEWS.PLAY] },
  { id: VIEWS.QUESTIONS, label: "Questions", icon: "questions", activeViews: [VIEWS.QUESTIONS] },
  { id: VIEWS.MAP, label: "Map", icon: "map", activeViews: [VIEWS.MAP] },
  { id: VIEWS.TOOLS, label: "More", icon: "menu", activeViews: [VIEWS.TOOLS, VIEWS.RULES] }
];

function navButtons(view) {
  return NAV_ITEMS.map((item) => `
    <button class="nav-button" type="button" data-action="navigate" data-view="${item.id}" ${item.activeViews.includes(view) ? 'aria-current="page"' : ""}>
      ${icon(item.icon)}<span>${item.label}</span>
    </button>
  `).join("");
}

export function renderShell(state, content) {
  const view = state.ui.view;
  const meta = VIEW_META[view] || VIEW_META.play;
  const connection = state.connection;
  const connected = connection.mode === "connected" && connection.status === "online";
  const connectionLabel = connected ? `Room ${escapeHtml(connection.roomCode || "")}` : state.game ? "This device" : "Not in a game";
  const statusClass = connection.status === "online" ? "online" : connection.status === "syncing" ? "syncing" : connection.status === "error" ? "error" : "";
  const gameSubtitle = state.game ? `${escapeHtml(state.game.name)} · Round ${state.game.round}` : meta.subtitle;
  return `
    <div class="app-shell simple-shell">
      <aside class="sidebar" aria-label="Primary navigation">
        <div class="brand">
          <img src="./assets/icon.svg" width="44" height="44" alt="" />
          <div class="brand-copy"><strong>HideLine</strong><span>Game day companion</span></div>
        </div>
        <nav class="side-nav">${navButtons(view)}</nav>
        <div class="sidebar-footer">
          <button class="nav-button" type="button" data-action="navigate" data-view="rules">${icon("rules")}<span>Quick rules</span></button>
          <button class="nav-button" type="button" data-action="open-modal" data-modal="settings">${icon("settings")}<span>Settings</span></button>
          <div class="connection-card compact-connection">
            <div class="connection-row"><strong>${connectionLabel}</strong><span class="connection-dot ${statusClass}"></span></div>
            <small>${connected ? "Live sync on" : state.game ? "Local mode" : "Create or join a game"}</small>
          </div>
        </div>
      </aside>
      <div class="main-column">
        <header class="topbar simple-topbar">
          <div class="topbar-title">
            <h1>${meta.title}</h1>
            <p>${gameSubtitle}</p>
          </div>
          <div class="topbar-actions">
            ${state.ui.installPromptAvailable ? `<button class="button button-soft button-small" type="button" data-action="install-app">${icon("download")}<span class="desktop-only">Install</span></button>` : ""}
            <button class="profile-chip" type="button" data-action="open-modal" data-modal="profile" aria-label="Edit profile">
              <span class="avatar">${escapeHtml(initials(state.profile.name))}</span><span>${escapeHtml(state.profile.name)}</span>
            </button>
          </div>
        </header>
        <main id="main-content" class="content simple-content" tabindex="-1">${content}</main>
      </div>
      <nav class="mobile-nav simple-mobile-nav" aria-label="Primary navigation">${navButtons(view)}</nav>
    </div>
    <dialog id="app-modal" class="modal"></dialog>
    <dialog id="coordinate-picker-modal" class="modal coordinate-picker-modal"></dialog>
    <div id="toast-region" class="toast-region" aria-live="assertive" aria-atomic="true"></div>
  `;
}
