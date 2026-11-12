/**
 * Renders the Dashboard workspace tab markup without inline styling.
 */
export function renderDashboardTemplate() {
  return `
    <div id="tab-dashboard" class="tab-pane active dash-pane">
      <div class="dash-toolbar">
        <div class="flex-row gap-10">
          <span class="dash-label">Region</span>
          <div class="segmented-control dash-seg-wrap" id="dash-region-filter" role="group" aria-label="Region filter">
            <button type="button" class="pill active seg-btn" data-region="ALL" data-val="ALL">ALL</button>
            <button type="button" class="pill seg-btn" data-region="CJN" data-val="CJN">CJN</button>
            <button type="button" class="pill seg-btn" data-region="CJS" data-val="CJS">CJS</button>
          </div>
        </div>
        <div class="dash-actions-bar">
          <button type="button" class="tbtn-p tbtn-sm" id="btn-load-db">Load Excel DB</button>
          <button type="button" class="tbtn-clr tbtn-sm" id="btn-dash-import-contact">Import TE Contacts</button>
          <button type="button" class="tbtn-clr tbtn-sm" id="btn-dash-import-mplane" title="Import file Nokia MRBTS info (.xlsb / .xlsx) untuk data Mplane IP Address">Import Nokia MPlane</button>
          <button type="button" class="tbtn-clr tbtn-sm" id="btn-dash-handover-te" title="Pergantian TE massal berdasarkan nama TE atau cluster">Handover TE</button>
          <button type="button" class="tbtn-clr tbtn-sm" id="btn-dash-handover-site" title="Pindah kepemilikan site/BTS dari TE lama ke TE baru">Handover Site / BTS</button>
          <button type="button" class="tbtn-clr tbtn-sm" id="btn-dash-load-json" title="Muat file .json perubahan site yang pernah disimpan">Load Changes (.json)</button>
          <button type="button" class="tbtn-clr tbtn-sm" id="btn-dash-save-json" title="Simpan data perubahan site/BTS ke file .json">Save Changes (.json)</button>
        </div>
      </div>

      <div class="dash-grid-main">
        <section class="t-card">
          <div class="t-card-head">
            <span class="t-card-title">Master Data</span>
            <span class="dash-card-meta">Processed Snapshot</span>
          </div>
          <div class="dash-card-body">
            <div class="dash-hero-row">
              <div class="dash-hero-tile dash-hero-tile--down">
                <div class="dash-hero-value text-red" id="dash-down">0</div>
                <div class="dash-hero-label text-red">Site Down</div>
                <div class="dash-hero-sub">vs active snapshot</div>
              </div>
              <div class="dash-hero-tile dash-hero-tile--up">
                <div class="dash-hero-value text-grn" id="dash-up">0</div>
                <div class="dash-hero-label text-grn">Site Up</div>
                <div class="dash-hero-sub">recovery detected</div>
              </div>
            </div>

            <div class="dash-stats-row">
              <div class="dash-stat-tile">
                <div class="dash-stat-value" id="dash-master">0</div>
                <div class="dash-stat-label">Master Rows</div>
                <div class="dash-stat-sub">processed data</div>
              </div>
              <div class="dash-stat-tile">
                <div class="dash-stat-value" id="dash-db">0</div>
                <div class="dash-stat-label">DB Rows</div>
                <div id="lbl-dash-db-filename" class="dash-stat-sub-emph text-muted-2 text-ellipsis" title="Not loaded">Not loaded</div>
              </div>
              <button type="button" class="dash-stat-tile dash-stat-tile--interactive cursor-pointer" id="dash-changes-card" title="Klik untuk kelola / lihat perubahan site">
                <div class="dash-stat-value-row">
                  <span class="dash-stat-value text-accent" id="dash-changes-count">0</span>
                  <span class="dash-stat-link-arrow" aria-hidden="true">→</span>
                </div>
                <div class="dash-stat-label">Site Overrides</div>
                <div id="lbl-dash-changes-filename" class="dash-stat-sub-emph text-muted-3 text-ellipsis" title="0 site diubah">0 diubah</div>
              </button>
            </div>
          </div>
        </section>

        <section class="t-card">
          <div class="t-card-head">
            <span class="t-card-title">TE &amp; WA Contacts</span>
            <span id="lbl-dash-contact-status" class="dash-card-meta-active">Active Contact DB</span>
          </div>
          <div class="dash-card-body">
            <div class="dash-hero-row dash-hero-row--single">
              <div class="dash-hero-tile dash-hero-tile--accent">
                <div class="dash-hero-value text-accent" id="dash-contact-total">0</div>
                <div class="dash-hero-label text-accent">Total TE Contacts</div>
                <div class="dash-hero-sub">registered in contact database</div>
              </div>
            </div>

            <div class="dash-stats-row">
              <div class="dash-stat-tile">
                <div class="dash-stat-value text-grn" id="dash-contact-valid">0</div>
                <div class="dash-stat-label">WA Set</div>
                <div class="dash-stat-sub">ready for DM</div>
              </div>
              <div class="dash-stat-tile">
                <div class="dash-stat-value text-amb" id="dash-contact-unset">0</div>
                <div class="dash-stat-label">WA Unset</div>
                <div class="dash-stat-sub">needs info</div>
              </div>
              <div class="dash-stat-tile">
                <div class="dash-stat-value" id="dash-contact-clusters">0</div>
                <div class="dash-stat-label">Clusters</div>
                <div class="dash-stat-sub">coverage area</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

