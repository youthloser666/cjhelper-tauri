function renderFilterCategorySection({
  categoryKey,
  badgeClass,
  badgeText,
  title,
  countId,
  checkboxId,
  checked = true,
  selectAllId,
  tbodyId,
}) {
  return `
    <div class="filter-cat-card">
      <div class="flex-between">
        <div class="flex-row gap-8 cursor-pointer" id="toggle-expand-${categoryKey}">
          <span class="badge ${badgeClass} fr-badge-xs">${badgeText}</span>
          <span class="filter-cat-title">${title}</span>
          <span class="filter-cat-expand" id="icon-expand-${categoryKey}">▼ Details</span>
        </div>
        <div class="flex-row gap-10">
          <span id="${countId}" class="filter-cat-cnt">0 items</span>
          <input type="checkbox" id="${checkboxId}" class="checkbox chk-16" ${checked ? 'checked' : ''}>
        </div>
      </div>
      <div id="list-container-${categoryKey}" class="filter-list-container">
        <table class="dt filter-site-table">
          <thead>
            <tr>
              <th class="col-w-26 text-center"><input type="checkbox" id="${selectAllId}" checked></th>
              <th class="col-w-85">Site ID</th>
              <th class="col-w-110">Cluster</th>
              <th>Site Name</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody id="${tbodyId}"></tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Renders the floating broadcast progress toast overlay (`#wa-bc-progress-container`).
 */
export function renderFloatingBroadcastProgress() {
  return `
    <div id="wa-bc-progress-container" class="floating-bc-progress">
      <div class="flex-between">
        <div class="flex-row gap-8">
          <span class="bc-pulse-dot" id="wa-bc-pulse"></span>
          <span class="wa-bc-title">Broadcast Progress</span>
        </div>
        <div class="flex-row gap-8">
          <span id="wa-bc-progress-percent" class="wa-bc-percent">0%</span>
          <button id="btn-close-bc-floating" type="button" class="btn-floating-close" title="Tutup">✕</button>
        </div>
      </div>
      <div class="wa-bc-track">
        <div id="wa-bc-progress-fill" class="wa-bc-fill"></div>
      </div>
      <div class="flex-between">
        <span id="wa-bc-progress-status" class="wa-bc-status">Preparing broadcast...</span>
      </div>
    </div>
  `;
}

/**
 * Renders the WhatsApp QR, Blast-TE, Filter, and TE Message Preview modals.
 */
export function renderWhatsAppModals() {
  return `
    <!-- WA Log & QR Modal -->
    <div id="wa-qr-modal" class="modal">
      <div class="modal-card-wa-qr">
        <div class="modal-header-row">
          <h3 class="modal-title-15"><span>WhatsApp Server Status</span></h3>
          <span id="wa-modal-status-badge" class="wa-status-badge">DISCONNECTED</span>
        </div>

        <div id="wa-qr-wrapper" class="wa-qr-wrapper">
          <p class="wa-qr-caption">Please scan the QR Code below using your WhatsApp app:</p>
          <div id="wa-qr-container" class="wa-qr-box">
            <img id="wa-qr-img" class="wa-qr-img" src="" alt="QR Code">
          </div>
        </div>

        <div class="wa-logs-section">
          <div class="wa-logs-head">
            <span>Server Activity Logs</span>
            <span class="wa-logs-realtime">Real-time</span>
          </div>
          <div id="wa-server-logs-container" class="wa-logs-terminal">
            <pre id="wa-server-logs" class="wa-logs-pre">Starting WhatsApp server...</pre>
          </div>
        </div>

        <div class="wa-modal-footer-row">
          <button type="button" class="tbtn-clr btn-modal-flex" id="btn-close-wa-qr">Close</button>
          <button type="button" class="tbtn-clr btn-modal-reset-wa" id="btn-modal-wa-reset"
            title="Hapus sesi lama dan minta QR code baru">
            <span>🔄 Reset / Scan Ulang</span>
          </button>
        </div>
      </div>
    </div>

    <!-- WA Blast TE Modal -->
    <div id="wa-blast-te-modal" class="modal">
      <div class="modal-card-blast-te">
        <h3 class="modal-h3-blast">Direct WA Blast to TE</h3>
        <p class="modal-desc-12">
          System detected TEs with down sites. Select TEs to send direct WhatsApp messages to.
        </p>

        <div id="wa-blast-te-progress-container" class="blast-te-progress-box hidden">
          <div class="blast-te-progress-head">
            <span id="wa-blast-te-progress-status">Sending messages...</span>
            <span id="wa-blast-te-progress-percent">0%</span>
          </div>
          <div class="blast-te-progress-track">
            <div id="wa-blast-te-progress-fill" class="blast-te-progress-fill"></div>
          </div>
        </div>

        <div class="blast-te-table-wrap">
          <table class="dt w-full">
            <thead>
              <tr>
                <th class="col-w-30 text-center"><input type="checkbox" id="chk-wa-blast-te-select-all" checked></th>
                <th>TE Name</th>
                <th>WhatsApp Phone</th>
                <th class="col-w-70 text-center">Site Down</th>
                <th class="col-w-70 text-center">Preview</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="wa-blast-te-tbody"></tbody>
          </table>
        </div>

        <div class="flex-between gap-10">
          <div class="blast-te-delay-box">
            <span>Delay (ms):</span>
            <input type="number" id="num-wa-blast-te-delay" class="sinput blast-te-delay-input" value="2000">
          </div>
          <div class="flex-row gap-8">
            <button type="button" class="tbtn-clr btn-blast-cancel" id="btn-close-wa-blast-te">Cancel</button>
            <button type="button" class="tbtn-p btn-blast-send" id="btn-execute-wa-blast-te">Send Blast</button>
          </div>
        </div>
      </div>
    </div>

    <!-- WA Blast Filter Settings Modal -->
    <div id="wa-blast-filter-modal" class="modal">
      <div class="modal-card-blast-filter">
        <div class="modal-header-bordered">
          <h3 class="modal-title-accent"><span>Direct WA Blast TE Filters</span></h3>
          <button type="button" class="tbtn-clr modal-close-xs" id="btn-close-wa-blast-filter">✕</button>
        </div>

        <p class="filter-modal-sub">
          Select alarm types &amp; check specific sites (sorted by Cluster) for Direct WA Blast TE.
        </p>

        <div class="filter-modal-scroll">
          <div class="filter-toggles-grid">
            <label class="filter-toggle-card">
              <div>
                <div class="filter-toggle-title">Hardcoded Remark Trigger Filter</div>
                <div class="filter-toggle-sub">fu team, follow up team, plan ts today, empty</div>
              </div>
              <input type="checkbox" id="chk-filter-remark-trigger" class="checkbox chk-16" checked>
            </label>

            <label class="filter-toggle-card">
              <div class="flex-row gap-6">
                <span class="badge ba badge-enva-purple">ENVA</span>
                <div>
                  <div class="filter-toggle-title">ENVA Alarm</div>
                  <div class="filter-toggle-sub">Huawei, Nokia, Neteco, Power</div>
                </div>
              </div>
              <div class="flex-row gap-6">
                <span id="cnt-filter-enva" class="filter-cnt-label">0 items</span>
                <input type="checkbox" id="chk-filter-enva" class="checkbox chk-16">
              </div>
            </label>

            <label class="filter-toggle-card">
              <div class="flex-row gap-6">
                <span class="badge br badge-stolen-red">STOLLEN</span>
                <div>
                  <div class="filter-toggle-title">Stolen Battery &amp; Cable</div>
                  <div class="filter-toggle-sub">Battery &amp; Cable Stollen Indication</div>
                </div>
              </div>
              <div class="flex-row gap-6">
                <span id="cnt-filter-stolen" class="filter-cnt-label">0 items</span>
                <input type="checkbox" id="chk-filter-stolen" class="checkbox chk-16">
              </div>
            </label>
          </div>

          <div class="filter-section-heading">Alarm Type Filter &amp; Site Data Details (Sorted by Cluster):</div>

          ${renderFilterCategorySection({
            categoryKey: 'sitedown',
            badgeClass: 'br',
            badgeText: 'SITEDOWN',
            title: 'Site Fully Down',
            countId: 'cnt-filter-sitedown',
            checkboxId: 'chk-filter-sitedown',
            selectAllId: 'chk-sitedown-select-all',
            tbodyId: 'tbody-filter-sitedown',
          })}

          ${renderFilterCategorySection({
            categoryKey: 'celldown',
            badgeClass: 'bb',
            badgeText: 'CELLDOWN',
            title: 'Cells Down',
            countId: 'cnt-filter-celldown',
            checkboxId: 'chk-filter-celldown',
            selectAllId: 'chk-celldown-select-all',
            tbodyId: 'tbody-filter-celldown',
          })}

          ${renderFilterCategorySection({
            categoryKey: 'bcch',
            badgeClass: 'ba',
            badgeText: 'BCCH',
            title: 'BCCH Missing Nokia',
            countId: 'cnt-filter-bcch',
            checkboxId: 'chk-filter-bcch',
            selectAllId: 'chk-bcch-select-all',
            tbodyId: 'tbody-filter-bcch',
          })}
        </div>

        <div class="wa-modal-footer-row">
          <button type="button" class="tbtn-p btn-filter-save" id="btn-save-wa-blast-filter">Save Filter</button>
        </div>
      </div>
    </div>

    <!-- WA Blast Message Preview Modal -->
    <div id="wa-blast-preview-modal" class="modal modal-overlay-top">
      <div class="modal-card-blast-preview">
        <div class="modal-header-bordered">
          <h3 class="modal-title-accent"><span>Direct TE Message Preview</span></h3>
          <button type="button" class="tbtn-clr modal-close-xs" id="btn-close-wa-blast-preview">✕</button>
        </div>

        <div class="preview-target-row">
          Target: <span id="lbl-preview-te-name" class="text-grn">—</span>
          <span id="lbl-preview-te-phone" class="preview-te-phone">—</span>
        </div>

        <div class="preview-msg-wrap">
          <textarea id="txt-preview-te-msg" class="data-ta preview-msg-textarea" readonly></textarea>
        </div>

        <div class="wa-modal-footer-row">
          <button type="button" class="cbtn ca btn-modal-flex" id="btn-copy-preview-te-msg">Copy Message</button>
          <button type="button" class="tbtn-clr btn-preview-done" id="btn-done-preview-te">Close</button>
        </div>
      </div>
    </div>
  `;
}

