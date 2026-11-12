/**
 * Renders the Flash Report tab and all three sub-tabs (Master Table, Additional Info, Report Output)
 * using semantic classes without static inline styles.
 */
export function renderFlashReportTemplate() {
  return `
    <div id="tab-flash" class="tab-pane hidden">
      <div class="msg-head subtab-header-bar flex-shrink-0">
        <div class="segmented-control seg-transparent" id="flash-subtab-seg">
          <button class="mode-btn seg-btn active" data-subtarget="subtab-fr-master">Master Table</button>
          <button class="mode-btn seg-btn" data-subtarget="subtab-fr-info">Additional Info</button>
          <button class="mode-btn seg-btn" data-subtarget="subtab-fr-output">Report Output</button>
        </div>
        <div class="flex-row gap-8">
          <span id="fr-header-summary" class="fr-header-summary">0 MC Impact • 0 Site Down</span>
        </div>
      </div>

      <div id="subtab-fr-master" class="fr-subtab-pane flex-1-col gap-8">
        <div class="t-card fr-input-card card-flush-top flex-col">
          <div class="t-card-head">
            <span class="t-card-title">Input Flash Report Master Table</span>
            <div class="flex-row gap-6">
              <div class="segmented-control fr-seg-pill" id="fr-region-seg">
                <button class="tbtn active fr-reg-btn" data-reg="ALL">Central Java (ALL)</button>
                <button class="tbtn fr-reg-btn" data-reg="CJN">CJN</button>
                <button class="tbtn fr-reg-btn" data-reg="CJS">CJS</button>
              </div>
              <div class="segmented-control fr-seg-pill" id="fr-impact-seg" title="Filter kategori impact (Default: Fully Down / Site Down)">
                <button class="tbtn active fr-imp-btn" data-imp="FULLY">Fully Down Only</button>
                <button class="tbtn fr-imp-btn" data-imp="ALL">All</button>
              </div>
              <button class="tbtn-a btn-compact" id="btn-fr-load-main">Load dari Master Data</button>
              <button class="tbtn-clr" id="btn-fr-clear">Clear</button>
            </div>
          </div>
          <textarea id="fr-txt-master" class="data-ta fr-textarea flex-1" placeholder="Paste TSV data Master Table di sini (fleksibel: CJN, CJS, atau keduanya)..."></textarea>
          <div class="act-bar flex-between fr-act-bar">
            <button class="tbtn-p" id="btn-fr-process">Process Flash Data</button>
            <span id="fr-master-status" class="fr-status-msg">Belum ada data di-load.</span>
          </div>
        </div>

        <div class="fr-stats-grid">
          <div class="fr-stat-box">
            <div class="fr-stat-num text-primary-1" id="fr-stat-total">0</div>
            <div class="fr-stat-label">Total Rows</div>
          </div>
          <div class="fr-stat-box">
            <div class="fr-stat-num text-accent" id="fr-stat-mc">0</div>
            <div class="fr-stat-label">MC Impact</div>
          </div>
          <div class="fr-stat-box">
            <div class="fr-stat-num text-amb" id="fr-stat-2g">0</div>
            <div class="fr-stat-label">2G Down</div>
          </div>
          <div class="fr-stat-box">
            <div class="fr-stat-num text-red" id="fr-stat-4g">0</div>
            <div class="fr-stat-label">4G Down</div>
          </div>
          <div class="fr-stat-box">
            <div class="fr-stat-num text-grn" id="fr-stat-matched">0</div>
            <div class="fr-stat-label">Matched Remarks</div>
          </div>
        </div>

        <div class="t-card fr-table-card flex-1-col card-flush-top">
          <div class="t-card-head">
            <span class="t-card-title">Processed Master Table Data</span>
            <span id="fr-tbl-count" class="text-meta-sm ml-auto">0 sites</span>
          </div>
          <div class="scroll-y flex-1">
            <table class="dt">
              <thead>
                <tr>
                  <th class="col-w-35">#</th>
                  <th class="col-w-60">Wilayah</th>
                  <th class="col-w-140">MC Cluster</th>
                  <th class="col-w-100">Site ID</th>
                  <th class="col-w-180">Site Name</th>
                  <th class="col-w-60">Net</th>
                  <th class="col-w-120">Impact</th>
                  <th>Remark</th>
                  <th class="col-w-100 text-center">Position PG</th>
                </tr>
              </thead>
              <tbody id="fr-master-tbody">
                <tr>
                  <td colspan="9" class="text-center text-subtle fr-empty-cell">Belum ada data master diproses.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="subtab-fr-info" class="fr-subtab-pane hidden flex-1-col gap-10 scroll-y">
        <div class="fr-info-cards-grid">
          <div class="t-card fr-info-card">
            <div class="fr-card-heading">DG Status</div>
            <div class="flex-row gap-10">
              <div class="flex-1">
                <label class="fr-field-label">Running:</label>
                <input type="number" id="fr-dg-running" class="fi w-full" value="0" min="0">
              </div>
              <span class="fr-inline-sep">of</span>
              <div class="flex-1">
                <label class="fr-field-label">Total DG:</label>
                <input type="number" id="fr-dg-total" class="fi w-full" value="0" min="0">
              </div>
              <div class="fr-inline-suffix">running</div>
            </div>
            <div class="fr-dg-preview-row">Hasil: <span id="lbl-dg-preview" class="text-accent font-semibold">0 of 0 running</span></div>
          </div>

          <div class="t-card fr-info-card">
            <div class="flex-between mb-10">
              <div class="fr-card-heading mb-0">Site Down (2G &amp; 4G)</div>
              <button class="tbtn-a btn-xs-compact" id="btn-fr-sync-sitedown">Sync Master</button>
            </div>
            <div class="grid-2 gap-10">
              <div>
                <label class="fr-field-label">2G Down:</label>
                <input type="number" id="fr-input-2g" class="fi w-full" value="0" min="0">
              </div>
              <div>
                <label class="fr-field-label">4G Down:</label>
                <input type="number" id="fr-input-4g" class="fi w-full" value="0" min="0">
              </div>
            </div>
          </div>

          <div class="t-card fr-info-card">
            <div class="fr-card-heading">PG Status</div>
            <div class="fr-pg-status-grid">
              <div>
                <label class="fr-field-label-xs">Team Move:</label>
                <input type="text" id="fr-team-move" class="fi w-full" value="" placeholder="Cth: 1102 Cluster">
              </div>
              <div>
                <label class="fr-field-label-xs">PG Completed:</label>
                <input type="number" id="fr-pg-completed" class="fi w-full" value="" placeholder="0" min="0">
              </div>
              <div>
                <label class="fr-field-label-xs">PG Installed:</label>
                <input type="number" id="fr-pg-installed" class="fi w-full" value="" placeholder="0" min="0">
              </div>
              <div>
                <label class="fr-field-label-xs">PG Movement:</label>
                <input type="number" id="fr-pg-movement" class="fi w-full" value="" placeholder="0" min="0">
              </div>
            </div>
          </div>
        </div>

        <div class="t-card fr-manual-card flex-1-col">
          <div class="t-card-head">
            <span class="t-card-title">Tambah Manual Position PG</span>
            <span class="fr-hint-xs">Site Name otomatis diambil dari Database aktif</span>
          </div>
          <div class="fr-manual-form-bar">
            <div class="fr-manual-site-wrap">
              <label class="fr-field-label-muted">Site ID:</label>
              <input type="text" id="fr-manual-site-id" class="fi w-full fi-sm" placeholder="Input Site ID (cth: 14SKH0073)">
            </div>
            <div class="flex-1">
              <label class="fr-field-label-muted">Remark:</label>
              <input type="text" id="fr-manual-remark" class="fi w-full fi-sm" placeholder="Input Remark (cth: Team onsite site still block access...)">
            </div>
            <div class="fr-manual-btn-wrap">
              <button class="tbtn-p btn-action-sm nowrap" id="btn-fr-add-manual">+ Tambah ke Position PG</button>
            </div>
          </div>
          <div class="scroll-y flex-1 fr-manual-scroll">
            <table class="dt">
              <thead>
                <tr>
                  <th class="col-w-35">#</th>
                  <th class="col-w-70">Wilayah</th>
                  <th class="col-w-140">Cluster / FM</th>
                  <th class="col-w-100">Site ID</th>
                  <th class="col-w-180">Site Name</th>
                  <th>Remark</th>
                  <th class="col-w-70 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody id="fr-manual-tbody">
                <tr>
                  <td colspan="7" class="text-center text-subtle fr-empty-sm">Belum ada data manual ditambahkan.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="subtab-fr-output" class="fr-subtab-pane hidden flex-1-col gap-8">
        <div class="t-card fr-output-card flex-1-col">
          <div class="t-card-head flex-shrink-0">
            <span class="t-card-title">Preview Output Flash Report</span>
            <div class="flex-row gap-8">
              <div class="flex-row gap-4">
                <span class="fr-toolbar-label">Jam:</span>
                <input type="text" id="fr-time-input" class="fi fr-time-field" value="21:00">
              </div>
              <div class="flex-row gap-4">
                <span class="fr-toolbar-label">Wilayah:</span>
                <input type="text" id="fr-title-input" class="fi fr-title-field" value="Central Java">
              </div>
              <div class="flex-row gap-4">
                <span class="fr-toolbar-label">MC Delimiter:</span>
                <select id="fr-mc-format" class="fi fr-select-sm">
                  <option value="compact">Compact (No Space)</option>
                  <option value="newline">Baris Baru (\\n)</option>
                  <option value="space">Spasi</option>
                  <option value="comma">Koma (, )</option>
                </select>
              </div>
              <button class="tbtn-p btn-action-sm" id="btn-fr-generate">Generate</button>
              <button class="cbtn ca btn-action-sm" id="btn-fr-copy">Copy Text</button>
            </div>
          </div>
          <textarea id="fr-preview-box" class="f-prev fr-preview-area flex-1" readonly placeholder="Klik 'Generate' untuk menghasilkan Flash Report..."></textarea>
          <div class="fr-output-footer flex-between">
            <span id="fr-preview-char-count" class="fr-footer-meta">0 characters | 0 lines</span>
            <span class="fr-footer-meta">Siap dibagikan ke WhatsApp</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

