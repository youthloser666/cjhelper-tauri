const NAVIGATION_TABS = [
  { targetId: 'tab-dashboard', label: 'Dashboard', isDefaultActive: true },
  { targetId: 'tab-input', label: 'Data' },
  { targetId: 'tab-flash', label: 'Flash Report' },
  { targetId: 'tab-status', label: 'Status' },
  { targetId: 'tab-pm', label: 'Messages' },
  { targetId: 'tab-wa', label: 'Broadcast' },
  { targetId: 'tab-db', label: 'Database' },
  { targetId: 'tab-maps', label: 'Maps' },
  { targetId: 'tab-others', label: 'Others' },
];

/**
 * Renders the top navigation shell, content container, and modal mount host.
 */
export function renderAppShellTemplate({ tabsMarkup = '', modalsMarkup = '' } = {}) {
  const navButtonsHtml = NAVIGATION_TABS
    .map((tab) => {
      const activeClass = tab.isDefaultActive ? ' active' : '';
      return `<button class="tnav nav-btn${activeClass}" data-target="${tab.targetId}">${tab.label}</button>`;
    })
    .join('\n        ');

  return `
    <div id="app">
      <header class="topbar" id="app-titlebar" data-tauri-drag-region>
        <div class="topbar-brand" data-tauri-drag-region>
          <span class="brand-mark" aria-hidden="true"></span>
          <span class="logo-text">CJHelper</span>
        </div>
        <nav class="tnav-wrap" id="nav-menu" aria-label="Primary">
          ${navButtonsHtml}
        </nav>
        <div class="topbar-right" data-tauri-drag-region>
          <span class="datetime" id="clock" data-no-drag>—</span>
          <button type="button" class="tbtn" id="btn-theme" data-no-drag title="Toggle Theme" aria-label="Toggle theme">◐</button>
          <button type="button" class="tbtn-a" id="btn-refresh" data-no-drag title="Refresh">Refresh</button>
          <div class="topbar-divider" aria-hidden="true"></div>
          <div class="win-controls" data-no-drag aria-label="Window controls">
            <button type="button" class="win-btn" id="btn-win-min" data-no-drag title="Minimize" aria-label="Minimize window">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="win-btn" id="btn-win-max" data-no-drag data-maximized="false" title="Maximize" aria-label="Maximize window">
              <svg class="win-icon-max" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
              <svg class="win-icon-restore" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M3 3V1.75C3 1.47 3.22 1.25 3.5 1.25H8.25C8.53 1.25 8.75 1.47 8.75 1.75V6.5C8.75 6.78 8.53 7 8.25 7H7" stroke="currentColor" stroke-width="1.2"/><rect x="1.25" y="3" width="5.75" height="5.75" rx="0.8" stroke="currentColor" stroke-width="1.2"/></svg>
            </button>
            <button type="button" class="win-btn win-btn-close" id="btn-win-close" data-no-drag title="Close" aria-label="Close window">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
      </header>

      <div class="main-body">
        <main class="content">
          ${tabsMarkup}
        </main>
      </div>
    </div>
    ${modalsMarkup}
  `;
}

