function renderLookupField(label, id, fullWidth = false) {
  return `
    <div class="ir${fullWidth ? ' ir-full' : ''}">
      <div class="il">${label}</div>
      <div class="iv em" id="${id}">—</div>
    </div>
  `;
}

function renderEditorField(label, id, disabled = false) {
  return `
    <div class="ff no-border-flush">
      <div class="fl fl-100">${label}</div>
      <input id="${id}" class="fi"${disabled ? ' disabled' : ''}>
    </div>
  `;
}

/**
 * Renders the Database Lookup tab (`#tab-db`) markup.
 */
export function renderDatabaseLookupTab() {
  const siteInfoFields = [
    ['Site ID (New)', 'db-f-site-id-new'],
    ['Old Site ID', 'db-f-old-site-id'],
    ['Site Name', 'db-f-site-name'],
    ['Vendor', 'db-f-vendor'],
    ['Host Name', 'db-f-host-name'],
    ['FM Office', 'db-f-fm-office'],
    ['Area', 'db-f-area'],
    ['TLP', 'db-f-tlp'],
    ['Cluster (MC)', 'db-f-cluster'],
    ['Longitude', 'db-f-long'],
    ['Latitude', 'db-f-lat'],
    ['IP Mplane BTS', 'db-f-ip-mplane-bts'],
    ['Mplane IP Address', 'db-f-mplane-ip-address'],
    ['Netact MRBTS', 'db-f-netact-mrbts'],
  ];

  return `
    <div id="tab-db" class="tab-pane hidden">
      <div class="t-card flex-1">
        <div class="t-card-head">
          <span class="t-card-title">Database Lookup</span>
          <div class="flex-row gap-5">
            <button type="button" class="cbtn ml-6" id="btn-db-import-mplane"
              title="Import file Nokia MRBTS info (.xlsb / .xlsx) untuk Mplane IP">📁 Import MPlane</button>
            <button type="button" class="cbtn ml-4" id="btn-db-lookup-handover"
              title="Buka modal handover untuk site yang sedang dilihat">🔄 Handover Site Ini</button>
            <button type="button" class="cbtn ca ml-4" id="btn-db-copy-all">Copy All</button>
          </div>
        </div>

        <div class="db-search-bar">
          <span class="db-search-label">New Site ID:</span>
          <input class="sinput db-search-input" id="db-search-input" placeholder="Type Site ID...">
          <button type="button" class="tbtn-a db-search-btn" id="btn-db-search">Check</button>
          <button type="button" class="tbtn-clr" id="btn-db-clear">Clear</button>
          <span id="db-search-status" class="db-search-status"></span>
        </div>

        <div class="db-scroll-body">
          <div class="ib">
            <div class="ib-h">Site Info</div>
            <div class="ig">
              ${siteInfoFields.map(([lbl, id]) => renderLookupField(lbl, id)).join('')}
            </div>
          </div>

          <div class="ib">
            <div class="ib-h">RTS</div>
            <div class="ig">
              ${renderLookupField('RTS Name', 'db-f-rts-name')}
              ${renderLookupField('RTS New', 'db-f-rts-new')}
              ${renderLookupField('RTS Phone', 'db-f-rts-phone', true)}
            </div>
          </div>

          <div class="ib">
            <div class="ib-h">TE Information</div>
            <div class="ig">
              ${renderLookupField('TE Name', 'db-f-te-name')}
              ${renderLookupField('TE Phone', 'db-f-te-phone')}
              ${renderLookupField('TE Email', 'db-f-te-email', true)}
            </div>
          </div>

          <div class="ib">
            <div class="ib-h">CME Information</div>
            <div class="ig">
              ${renderLookupField('CME Name', 'db-f-cme-name')}
              ${renderLookupField('CME Phone', 'db-f-cme-phone')}
              ${renderLookupField('CME Email', 'db-f-cme-email', true)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the Broadcast Utils, TE Contacts, and Edit Database subtabs under `#tab-others`.
 */
export function renderOthersDatabaseSubtabs() {
  const siteEditorFields = [
    ['Site ID MSH:', 'dbe-site-id-msh', true],
    ['Longitude:', 'dbe-lon'],
    ['Site Name:', 'dbe-site-name'],
    ['Latitude:', 'dbe-lat'],
    ['Old Site ID:', 'dbe-old-site-id'],
    ['TLP:', 'dbe-tlp'],
    ['Cluster (MC):', 'dbe-cluster'],
    ['Site Class:', 'dbe-site-class'],
    ['Area:', 'dbe-area'],
    ['Hub Type:', 'dbe-hub-type'],
    ['FM Office:', 'dbe-fm-office'],
    ['Address:', 'dbe-address'],
    ['Vendor:', 'dbe-vendor'],
    ['Host Name:', 'dbe-host-name'],
  ];

  const rtsEditorFields = [
    ['RTS Name:', 'dbe-rts-name'],
    ['RTS Email:', 'dbe-rts-email'],
    ['RTS Phone:', 'dbe-rts-phone'],
    ['RTS NEW:', 'dbe-rts-new'],
  ];

  return `
    <!-- 2. Broadcast Utilities (WA Group Management) Sub-tab -->
    <div id="subtab-wa-mgmt" class="subtab-pane hidden">
      <div class="msg-head msg-head-card">
        <span class="others-title">Broadcast Utilities</span>
        <span class="others-subtitle">Check groups to include in broadcast list. WA must be connected.</span>
      </div>

      <div class="ff ff-card-bar">
        <div class="fl fl-auto-bold">Search Group:</div>
        <input type="text" id="wa-group-search" class="fi" placeholder="Search WA group name...">
        <button type="button" id="btn-wa-clear-search" class="tbtn-clr">Clear</button>
        <span id="wa-search-count" class="wa-search-count"></span>
      </div>

      <div class="ib ib-scroll-card">
        <table class="dt w-full">
          <thead>
            <tr>
              <th class="col-w-50">Icon</th>
              <th>Group Name</th>
            </tr>
          </thead>
          <tbody id="wa-groups-tbody"></tbody>
        </table>
      </div>

      <div class="msg-head msg-head-card flex-between">
        <span id="wa-groups-status" class="status-msg-grn"></span>
        <div class="flex-row gap-5">
          <button type="button" id="btn-wa-refresh-groups" class="tbtn">Refresh from WA</button>
          <button type="button" id="btn-wa-save-groups" class="tbtn-p">Save Selection</button>
        </div>
      </div>

      <div class="ib wa-log-card">
        <div class="ib-h flex-between">
          <span>Today's Broadcast History</span>
          <span class="wa-log-date" id="wa-bc-log-date"></span>
        </div>
        <textarea id="wa-bc-log-box" class="data-ta wa-log-textarea" readonly>No broadcast history for today.</textarea>
      </div>
    </div>

    <!-- 5. TE Contacts Sub-tab -->
    <div id="subtab-wa-te" class="subtab-pane hidden">
      <div class="msg-head msg-head-card">
        <span class="others-title">TE Contacts Database</span>
        <span class="others-subtitle">Manage TE WhatsApp contact numbers here. Saved in wa_te_contacts.json.</span>
      </div>

      <div class="te-form-card">
        <div class="flex-row gap-10 flex-wrap">
          <span class="te-form-label">Add Contact:</span>
          <input type="text" id="wa-te-input-name" class="fi te-input-sm" placeholder="TE Name...">
          <input type="text" id="wa-te-input-cluster" class="fi te-input-sm" placeholder="Cluster/Area...">
          <input type="text" id="wa-te-input-phone" class="fi te-input-sm" placeholder="WA Phone (628...)...">
          <button type="button" id="btn-wa-te-add" class="tbtn-p btn-te-add">Add</button>
        </div>
        <div class="te-divider"></div>
        <div class="flex-row gap-10 flex-wrap">
          <span class="te-form-label">Search Contact:</span>
          <input type="text" id="wa-te-search" class="fi flex-1" placeholder="Type name or cluster to filter...">
          <button type="button" id="btn-wa-te-clear-search" class="tbtn-clr btn-te-clear">Clear</button>
          <button type="button" id="btn-wa-te-import" class="tbtn-load btn-te-import">Import Excel (.xlsx)</button>
          <button type="button" id="btn-wa-te-handover" class="tbtn-load btn-te-handover">Handover TE</button>
        </div>
      </div>

      <div class="ib ib-scroll-card">
        <table class="dt w-full">
          <thead>
            <tr>
              <th>TE Name</th>
              <th>Cluster/Area</th>
              <th>WhatsApp Phone</th>
              <th class="col-w-80 text-center">Action</th>
            </tr>
          </thead>
          <tbody id="wa-te-tbody"></tbody>
        </table>
      </div>

      <div class="msg-head msg-head-card flex-between">
        <span id="wa-te-status-lbl" class="status-msg-grn"></span>
        <div class="flex-row gap-5">
          <button type="button" id="btn-wa-te-save" class="tbtn-p">Save Changes</button>
        </div>
      </div>
    </div>

    <!-- 3. Edit Database Sub-tab -->
    <div id="subtab-db-edit" class="subtab-pane subtab-pane-scroll hidden">
      <div class="msg-head msg-head-card">
        <span class="others-title">Edit Database</span>
        <span id="db-edit-status-header" class="db-edit-header-status"></span>
        <button type="button" id="btn-db-undo" class="tbtn">Undo</button>
        <button type="button" id="btn-dbe-load-json" class="tbtn-clr ml-5"
          title="Muat perubahan site dari file .json">Load JSON</button>
        <button type="button" id="btn-dbe-save-json" class="tbtn-clr ml-5"
          title="Simpan data yang diedit ke file .json">Save JSON</button>
        <button type="button" id="btn-db-export" class="tbtn-load ml-5"
          title="Export seluruh database ke file Excel baru">Export Excel</button>
      </div>

      <div class="ff ff-card-bar">
        <div class="fl fl-auto-bold">Site ID / Name:</div>
        <input type="text" id="db-edit-search-inp" class="fi db-edit-search-inp" placeholder="Enter SITE ID...">
        <button type="button" id="btn-db-edit-search" class="tbtn-p">Search</button>
        <button type="button" id="btn-db-edit-clear" class="tbtn-clr">Clear</button>
        <span id="db-edit-search-status" class="db-edit-search-status"></span>
      </div>

      <div id="db-edit-form" class="hidden db-edit-form">
        <div class="ib">
          <div class="ib-h">Site Info</div>
          <div class="ig ig-compact">
            ${siteEditorFields.map(([lbl, id, dis]) => renderEditorField(lbl, id, dis)).join('')}
          </div>
        </div>

        <div class="ib">
          <div class="ib-h">RTS Info</div>
          <div class="ig ig-compact">
            ${rtsEditorFields.map(([lbl, id]) => renderEditorField(lbl, id)).join('')}
          </div>
        </div>

        <div class="grid-2 gap-7">
          <div class="ib">
            <div class="ib-h">TE Info</div>
            <div class="dbe-col-stack">
              ${renderEditorField('TE Name:', 'dbe-te-name')}
              ${renderEditorField('TE Phone:', 'dbe-te-phone')}
              ${renderEditorField('TE Email:', 'dbe-te-email')}
            </div>
          </div>

          <div class="ib">
            <div class="ib-h">CME Info</div>
            <div class="dbe-col-stack">
              ${renderEditorField('CME Name:', 'dbe-cme-name')}
              ${renderEditorField('CME Phone:', 'dbe-cme-phone')}
              ${renderEditorField('CME Email:', 'dbe-cme-email')}
            </div>
          </div>
        </div>

        <button type="button" id="btn-db-edit-save" class="tbtn-p btn-db-edit-save">Save Changes</button>
      </div>
    </div>
  `;
}

