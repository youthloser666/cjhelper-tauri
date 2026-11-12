/**
 * Renders the Data Input workspace tab with Master Table, Pivot Data, and Netdrone Data sub-tabs.
 */
export function renderDataInputTemplate() {
  return `
    <div id="tab-input" class="tab-pane hidden">
      <div class="msg-head subtab-header-bar">
        <div class="segmented-control seg-transparent" id="datatable-subtab-seg">
          <button class="mode-btn seg-btn active" data-subtarget="subtab-dt-master" data-val="subtab-dt-master">Master Table</button>
          <button class="mode-btn seg-btn" data-subtarget="subtab-dt-pivot" data-val="subtab-dt-pivot">Pivot Data</button>
          <button class="mode-btn seg-btn" data-subtarget="subtab-dt-netdrone" data-val="subtab-dt-netdrone">Netdrone Data</button>
        </div>
      </div>

      <div id="subtab-dt-master" class="dt-subtab-pane flex-1-col">
        <div class="t-card flex-1-col card-flush-top">
          <div class="t-card-head">
            <span class="t-card-title">Input Master Data Table</span>
            <div class="flex-row gap-5">
              <button class="tbtn-clr" id="btn-reset-snap">Reset</button>
              <button class="tbtn-a" id="btn-manual-snap">Manual Snapshot</button>
            </div>
          </div>
          <div class="snap-bar">Snapshot: <span class="snap-tag" id="lbl-snapshot">None — hourly auto backup</span></div>
          <textarea id="txt-master" class="data-ta flex-1" placeholder="Paste TSV data here..."></textarea>
          <div class="act-bar flex-between">
            <div class="flex-row gap-6">
              <button class="tbtn-p" id="btn-process">Process</button>
              <button class="tbtn-clr" id="btn-clear">Clear</button>
            </div>
            <span class="status-ok status-bar-text" id="status-bar">No data.</span>
          </div>
        </div>
      </div>

      <div id="subtab-dt-pivot" class="dt-subtab-pane hidden flex-1-col">
        <div class="t-card flex-1-col card-flush-top">
          <div class="t-card-head">
            <span class="t-card-title">Input Pivot Data</span>
            <div class="flex-row gap-5">
              <button class="tbtn-clr" id="btn-reset-pivot">Reset</button>
            </div>
          </div>
          <textarea id="txt-pivot" class="data-ta flex-1" placeholder="Paste Pivot data (TSV) here..."></textarea>
          <div class="act-bar">
            <button class="tbtn-p" id="btn-process-pivot">Process Pivot</button>
            <button class="tbtn-clr" id="btn-clear-pivot">Clear</button>
          </div>
        </div>

        <div class="t-card flex-col card-pivot-table">
          <div class="t-card-head">
            <span class="t-card-title">Processed Pivot Data</span>
          </div>
          <div class="scroll-y flex-1">
            <table class="dt">
              <thead>
                <tr>
                  <th>Monitoring</th>
                  <th>System</th>
                  <th>Cluster</th>
                  <th>New ID</th>
                  <th>Site Name</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>TE Name</th>
                </tr>
              </thead>
              <tbody id="pivot-tbody">
                <tr>
                  <td colspan="8" class="text-center text-subtle table-empty-cell">No processed pivot data.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="subtab-dt-netdrone" class="dt-subtab-pane hidden flex-1-col gap-8">
        <div class="t-card flex-col card-netdrone-input">
          <div class="t-card-head">
            <span class="t-card-title">Input Netdrone Data</span>
            <div class="flex-row gap-8">
              <button class="tbtn-p btn-netdrone-process" id="btn-process-netdrone" disabled>Process Netdrone</button>
              <button class="tbtn-clr" id="btn-clear-netdrone">Clear</button>
            </div>
          </div>
          <textarea id="txt-netdrone" class="data-ta netdrone-ta flex-1" placeholder="Paste Netdrone data (TSV) here..."></textarea>
          <div class="act-bar act-bar-subtle flex-between">
            <span id="lbl-netdrone-hint" class="text-meta-sm">Ready for Netdrone (TSV) data. Duplicate sites in Master Table will be skipped.</span>
          </div>
        </div>

        <div class="t-card flex-1-col card-flush-top">
          <div class="t-card-head">
            <span class="t-card-title">Processed Netdrone Data</span>
            <span id="lbl-netdrone-summary" class="text-meta-sm ml-auto">0 entries processed</span>
          </div>
          <div class="scroll-y flex-1">
            <table class="dt">
              <thead>
                <tr>
                  <th class="col-w-30">#</th>
                  <th class="col-w-100">Site ID</th>
                  <th class="col-w-180">Site Name</th>
                  <th class="col-w-90">Vendor</th>
                  <th class="col-w-150">Alarm / Impact</th>
                  <th class="col-w-120">Cluster (DB)</th>
                  <th class="col-w-140">TE / FME (DB)</th>
                  <th>Status Match</th>
                </tr>
              </thead>
              <tbody id="netdrone-tbody">
                <tr>
                  <td colspan="8" class="text-center text-subtle table-empty-cell">No processed Netdrone data.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

