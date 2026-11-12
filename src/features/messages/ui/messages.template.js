/**
 * Renders the Messages (PM) tab with mode selector, filters, preview box, and group tree table.
 */
export function renderMessagesTemplate() {
  return `
    <div id="tab-pm" class="tab-pane hidden">
      <div class="t-card flex-1-col card-flush-top">
        <div class="msg-head">
          <span id="pm-total-lbl" class="pm-total-label">Total: 0 CLUSTER</span>
          <span class="pm-mode-label">Mode:</span>
          <div class="segmented-control seg-transparent" id="pm-mode-seg">
            <button class="mode-btn seg-btn active" data-val="cluster">Cluster</button>
            <button class="mode-btn seg-btn" data-val="rts">RTS</button>
          </div>
          <button class="tbtn" id="btn-pm-collapse">Collapse All</button>
          <button class="tbtn" id="btn-pm-expand">Expand All</button>
          <button class="tbtn pm-remark-btn" id="btn-pm-remark">Remark: ON</button>
          <button class="cbtn ca" id="btn-pm-copy-sel">Copy Selected</button>
          <button class="cbtn ca" id="btn-pm-copy-all">Copy All</button>
          <button class="tbtn-p pm-blast-btn" id="btn-pm-wa-blast">WA Blast TE</button>
          <button class="tbtn pm-filter-btn" id="btn-pm-blast-filter">Blast Filters</button>
        </div>
        <div class="ff">
          <div class="fl">Data Filter:</div>
          <input class="fi" id="pm-f-cl" placeholder="Cluster..." />
          <input class="fi" id="pm-f-ns" placeholder="New Site..." />
          <input class="fi" id="pm-f-rem" placeholder="Remark..." />
          <button class="tbtn-clr" id="btn-pm-reset">Reset Filter</button>
        </div>
        <textarea id="pm-preview-text" class="f-prev" readonly placeholder="Message preview..."></textarea>
        <div class="scroll-y flex-1">
          <table class="dt">
            <thead>
              <tr>
                <th class="col-w-120">Type</th>
                <th class="col-w-160">CLUSTER</th>
                <th class="col-w-140">TE Name</th>
                <th class="col-w-180">SITE NAME</th>
                <th class="col-w-80">OLD</th>
                <th class="col-w-100">NEW SITE</th>
                <th class="col-w-130">Start Time</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody id="pm-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

