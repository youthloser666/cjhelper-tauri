/**
 * Renders the WhatsApp Broadcast tab (`#tab-wa`) markup with zero inline style attributes.
 */
export function renderWhatsAppBroadcastTab() {
  return `
    <div id="tab-wa" class="tab-pane hidden">
      <div class="bc-grid">
        <div class="t-card flex-1-col">
          <div class="t-card-head">
            <span class="t-card-title">Broadcast WhatsApp</span>
            <div id="wa-region-seg" class="wa-region-controls">
              <button type="button" class="pill active wa-pill-sm" data-val="CJN">CJN</button>
              <button type="button" class="pill wa-pill-sm" data-val="CJS">CJS</button>
              <span class="wa-status-wrap">
                <div class="srv-dot srv-off" id="srv-dot-indicator"></div>
                <span id="wa-status-text" class="wa-status-label">DISCONNECTED</span>
              </span>
              <button type="button" class="tbtn wa-btn-sm" id="btn-wa-status">Check Status</button>
              <button type="button" class="tbtn-a wa-btn-sm" id="btn-wa-start">Start Server</button>
              <button type="button" class="tbtn-clr wa-btn-reset" id="btn-wa-reset">Reset WA</button>
            </div>
          </div>

          <div class="wa-preview-bar">
            <span class="wa-preview-title">Message Preview</span>
            <div class="flex-row gap-10">
              <label class="wa-netdrone-label">
                <input type="checkbox" id="chk-wa-enable-netdrone" class="chk-13">
                <span>Include Netdrone</span>
              </label>
              <button type="button" class="tbtn-a wa-btn-gen" id="btn-gen-wa">Generate Share WA</button>
            </div>
          </div>

          <textarea id="txt-wa-preview" class="bc-msg wa-preview-textarea"
            placeholder="Click 'Generate' to create message..."></textarea>

          <div class="wa-preview-footer">
            <span id="wa-char-count" class="wa-meta-xs">0 characters | 0 lines</span>
            <button type="button" class="cbtn ca" id="btn-copy-wa">Copy Text</button>
          </div>
        </div>

        <div class="flex-col gap-8">
          <div class="t-card flex-1">
            <div class="t-card-head">
              <span class="t-card-title">Broadcast List</span>
              <span id="wa-target-count" class="wa-meta-xs">0 groups selected</span>
            </div>
            <div class="wa-targets-scroll">
              <table class="dt w-full">
                <tbody id="wa-targets-tbody"></tbody>
              </table>
            </div>
            <div class="wa-send-footer">
              <button type="button" class="tbtn-p w-full" id="btn-wa-send" disabled>SEND BROADCAST</button>
            </div>
          </div>

          <div class="t-card wa-history-card">
            <div class="t-card-head">
              <span class="t-card-title">History</span>
              <span id="wa-bc-log-date-main" class="wa-meta-xs"></span>
            </div>
            <textarea id="wa-bc-log-box-main" class="wa-history-box" readonly>No broadcast history for today.</textarea>
          </div>
        </div>
      </div>
    </div>
  `;
}

