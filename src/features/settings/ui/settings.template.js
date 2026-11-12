/**
 * Renders the Others (`#tab-others`) container, Formatting Editor subtab (`#subtab-fmt`),
 * injected Database/WA subtabs, and System & Updates subtab (`#subtab-system`) with zero inline styles.
 */
export function renderOthersTab({ databaseSubtabsMarkup = '' } = {}) {
  return `
    <div id="tab-others" class="tab-pane hidden">
      <div class="others-shell">
        <div class="others-subnav" id="others-subnav">
          <button type="button" id="subbtn-fmt" class="tb active">Format Config</button>
          <button type="button" id="subbtn-wa-mgmt" class="tb">WA Groups</button>
          <button type="button" id="subbtn-wa-te" class="tb">TE Contacts</button>
          <button type="button" id="subbtn-db-edit" class="tb">Edit Database</button>
          <button type="button" id="subbtn-system" class="tb">System &amp; Updates</button>
        </div>

        <div class="others-subtabs-body">
          <!-- 1. Format Config Sub-tab -->
          <div id="subtab-fmt" class="subtab-pane subtab-pane-scroll">
            <div class="msg-head msg-head-card fmt-toolbar-row">
              <div class="flex-row gap-10">
                <span class="others-title">Message &amp; Broadcast Formatter</span>
                <div id="fmt-target-seg" class="segmented-control">
                  <button type="button" class="seg-btn active" data-val="msg">Messages (PM)</button>
                  <button type="button" class="seg-btn" data-val="bc">Broadcast (Share WA)</button>
                </div>
              </div>
              <div class="flex-row gap-6">
                <span id="fmt-status-msg" class="fmt-status-msg"></span>
                <button type="button" id="btn-fmt-reset" class="tbtn-clr">Reset Default</button>
                <button type="button" id="btn-fmt-save" class="tbtn-p">Save Format</button>
              </div>
            </div>

            <div class="fmt-grid">
              <div class="ib">
                <div class="ib-h">Template Rules</div>
                <div class="fmt-form-stack">
                  <div class="fmt-row">
                    <label for="fmt-line" class="fmt-row-label">Entry Line:</label>
                    <input type="text" id="fmt-line" class="fi flex-1">
                    <div class="fmt-row-hint">Per-site row line</div>
                  </div>
                  <div class="fmt-row">
                    <label for="fmt-remark" class="fmt-row-label">Remark Template:</label>
                    <input type="text" id="fmt-remark" class="fi flex-1">
                    <div class="fmt-row-hint">Appended when remark exists</div>
                  </div>
                  <div class="fmt-row">
                    <label for="fmt-hdr" class="fmt-row-label">Header Template:</label>
                    <input type="text" id="fmt-hdr" class="fi flex-1">
                    <div class="fmt-row-hint">Group/broadcast header</div>
                  </div>
                  <div class="fmt-row">
                    <label for="fmt-lbl-sd" class="fmt-row-label">Site Down Label:</label>
                    <input type="text" id="fmt-lbl-sd" class="fi flex-1">
                    <div class="fmt-row-hint">Fully down section title</div>
                  </div>
                  <div class="fmt-row">
                    <label for="fmt-lbl-cd" class="fmt-row-label">Cell Down Label:</label>
                    <input type="text" id="fmt-lbl-cd" class="fi flex-1">
                    <div class="fmt-row-hint">Partial cell section title</div>
                  </div>
                  <div class="fmt-row">
                    <label for="fmt-lbl-bcch" class="fmt-row-label">BCCH Label:</label>
                    <input type="text" id="fmt-lbl-bcch" class="fi flex-1">
                    <div class="fmt-row-hint">BCCH section header</div>
                  </div>
                  <div class="fmt-row">
                    <label for="fmt-key-bcch" class="fmt-row-label">BCCH Keyword:</label>
                    <input type="text" id="fmt-key-bcch" class="fi flex-1">
                    <div class="fmt-row-hint">REMARK keyword for BCCH</div>
                  </div>
                  <div class="fmt-row">
                    <label for="fmt-icon-down" class="fmt-row-label">Icon character:</label>
                    <input type="text" id="fmt-icon-down" class="fi flex-1">
                    <div class="fmt-row-hint">Icon when {icon} is used</div>
                  </div>
                  <div class="fmt-row">
                    <div class="fmt-row-label">Spacing:</div>
                    <label class="fmt-spacing-label">
                      <input type="checkbox" id="fmt-spacing-chk"> Add blank line between entries
                    </label>
                    <div class="fmt-row-hint"></div>
                  </div>
                </div>
              </div>

              <div class="ib">
                <div class="ib-h">Live Output Preview</div>
                <div class="fmt-preview-card">
                  <pre id="fmt-preview-box" class="fmt-preview-pre"></pre>
                  <div class="fmt-token-help">
                    Available placeholders: <code>{icon}</code>, <code>{type}</code>, <code>{cluster}</code>,
                    <code>{pic}</code>, <code>{rts}</code>, <code>{sitename}</code>, <code>{old}</code>,
                    <code>{new}</code>, <code>{time}</code>, <code>{category}</code>, <code>{remark}</code>,
                    <code>{region}</code>, <code>{date}</code>, <code>{jam}</code>, <code>{total_sd}</code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          ${databaseSubtabsMarkup}

          <!-- System & Updates Sub-tab -->
          <div id="subtab-system" class="subtab-pane subtab-pane-scroll hidden">
            <div class="msg-head msg-head-card">
              <span class="others-title">System &amp; Updates</span>
            </div>

            <div class="ib system-hero-card">
              <div class="system-badge-logo">CJ</div>
              <h3 class="system-version-title">
                CJHelper Version <span id="app-version-display">2.0.4</span>
              </h3>
              <p class="system-version-subtitle">
                Ensure you are using the latest version for the newest features and bug fixes.
              </p>

              <div id="update-status-container" class="update-status-pill">
                <span id="update-status-text" class="update-status-text update-status-text--neutral">
                  Click button below to check for updates
                </span>
              </div>

              <div class="update-actions-row">
                <button type="button" id="btn-check-update" class="tbtn-p btn-update-action">
                  Check Updates Now
                </button>
                <button type="button" id="btn-install-update" class="tbtn-load btn-update-action hidden">
                  Download &amp; Install
                </button>
              </div>

              <div id="update-progress-bar-container" class="update-progress-wrap hidden">
                <div class="update-progress-meta">
                  <span>Downloading...</span>
                  <span id="update-progress-percent">0%</span>
                </div>
                <div class="update-progress-track">
                  <div id="update-progress-fill" class="update-progress-fill"></div>
                </div>
              </div>
            </div>

            <div class="ib">
              <div class="ib-h">Application Information</div>
              <div class="system-info-body">
                • Name: CJHelper Tauri<br>
                • Framework: Tauri 2.0 (Rust + JS)<br>
                • Features: Data Processing, WA Broadcast, Maps Integration, DB Management<br>
                • Developer: youthloser666
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

