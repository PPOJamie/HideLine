import { VIEW_META, VIEWS } from "../core/constants.js";
import { escapeHtml, initials } from "../core/format.js";
import { icon } from "./icons.js";

const NAV_ITEMS = [
  { id: VIEWS.PLAY, label: "Play", icon: "play" },
  { id: VIEWS.MAP, label: "Map", icon: "map" },
  { id: VIEWS.QUESTIONS, label: "Ask", icon: "questions" },
  { id: VIEWS.TOOLS, label: "Toolkit", icon: "tools" },
  { id: VIEWS.RULES, label: "Rules", icon: "rules" }
];

function navButtons(view, mobile = false) {
  return NAV_ITEMS.map((item) => `
    <button class="nav-button" type="button" data-action="navigate" data-view="${item.id}" ${view === item.id ? 'aria-current="page"' : ""}>
      ${icon(item.icon)}<span>${item.label}</span>
    </button>
  `).join("");
}

export function renderShell(state, content) {
  const view = state.ui.view;
  const meta = VIEW_META[view] || VIEW_META.play;
  const connection = state.connection;
  const connected = connection.mode === "connected" && connection.status === "online";
  const connectionLabel = connected ? `Room ${escapeHtml(connection.roomCode || "")}` : state.game ? "Local game" : "Not connected";
  const statusClass = connection.status === "online" ? "online" : connection.status === "syncing" ? "syncing" : connection.status === "error" ? "error" : "";
  const gameSubtitle = state.game ? `${escapeHtml(state.game.name)} · Round ${state.game.round}` : meta.subtitle;
  return `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Primary navigation">
        <div class="brand">
          <img src="./assets/icon.svg" width="44" height="44" alt="" />
          <div class="brand-copy"><strong>HideLine</strong><span>London companion</span></div>
        </div>
        <nav class="side-nav">${navButtons(view)}</nav>
        <div class="sidebar-footer">
          <button class="nav-button" type="button" data-action="open-modal" data-modal="settings">${icon("settings")}<span>Settings</span></button>
          <div class="connection-card">
            <div class="connection-row"><strong>${connectionLabel}</strong><span class="connection-dot ${statusClass}"></span></div>
            <small>${connected ? "Live state is shared with game members." : "Use Connected Mode to link other devices."}</small>
          </div>
        </div>
      </aside>
      <div class="main-column">
        <header class="topbar">
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
        <main id="main-content" class="content" tabindex="-1">${content}</main>
      </div>
      <nav class="mobile-nav" aria-label="Primary navigation">${navButtons(view, true)}</nav>
    </div>
    <dialog id="app-modal" class="modal"></dialog>
    <div id="toast-region" class="toast-region" aria-live="assertive" aria-atomic="true"></div>
  `;
}
