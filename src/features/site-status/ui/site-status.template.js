/**
 * Renders the Site Status workspace tab without static inline styles.
 */
export function renderSiteStatusTemplate() {
  return `
    <div id="tab-status" class="tab-pane hidden">
      <div class="t-card flex-1-col card-flush-top">
        <div class="t-card-head">
          <div class="flex-row gap-10">
            <span class="st-count-down">DOWN: <span id="lbl-down-count">0</span></span>
            <span class="st-count-up">UP: <span id="lbl-up-count">0</span></span>
          </div>
        </div>
        <div class="filter-bar">
          <div class="segmented-control seg-transparent" id="st-filter-status">
            <button class="pill active seg-btn" data-val="ALL">ALL</button>
            <button class="pill seg-btn" data-val="DOWN">DOWN</button>
            <button class="pill seg-btn" data-val="UP">UP</button>
          </div>
          <input class="sinput" id="st-search" placeholder="Cluster / Site name..." />
          <button class="tbtn-clr" id="st-search-reset">Reset</button>
          <div class="sort-grp">Sort Duration:
            <div class="segmented-control seg-sort-transparent" id="st-filter-sort">
              <button class="srt seg-btn" data-val="desc">Longest</button>
              <button class="srt seg-btn" data-val="asc">Newest</button>
              <button class="srt seg-btn active" data-val="none">Default</button>
            </div>
          </div>
        </div>
        <div class="scroll-y flex-1">
          <table class="dt">
            <thead>
              <tr>
                <th>Status</th>
                <th>New Site</th>
                <th>Site Name</th>
                <th>Cluster</th>
                <th>Impact</th>
                <th>RTS</th>
                <th>Start Time</th>
                <th>Aging</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody id="status-tbody"></tbody>
          </table>
        </div>
        <div class="copy-bar">
          <button class="cbtn ca" id="btn-st-copy-sel">Copy Selected</button>
          <button class="cbtn cd" id="btn-st-copy-down">Copy DOWN</button>
          <button class="cbtn cu" id="btn-st-copy-up">Copy UP</button>
          <button class="cbtn ca" id="btn-st-copy-all">Copy All</button>
          <span id="st-copy-info" class="st-copy-hint ml-auto">Shift+click range | Ctrl+click multi | Ctrl+C copy</span>
        </div>
      </div>
    </div>
  `;
}

