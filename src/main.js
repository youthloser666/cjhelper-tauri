const tauriCore = window.__TAURI__ ? window.__TAURI__.core : null;
const invoke = tauriCore ? tauriCore.invoke : null;
let checkFn = null;
let pivotData = [];
let netdroneData = [];
if (window.__TAURI__) {
  if (window.__TAURI__.updater && typeof window.__TAURI__.updater.check === 'function') {
    checkFn = window.__TAURI__.updater.check;
  } else if (window.__TAURI__.plugins && window.__TAURI__.plugins.updater && typeof window.__TAURI__.plugins.updater.check === 'function') {
    checkFn = window.__TAURI__.plugins.updater.check;
  }
}
const check = checkFn;
const getVersion = window.__TAURI__ && window.__TAURI__.app ? window.__TAURI__.app.getVersion : null;

// Theme logic
const btnTheme = document.getElementById('btn-theme');
btnTheme.addEventListener('click', () => {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  btnTheme.textContent = isLight ? '◑' : '◐';
  if (typeof updateMapTheme === 'function') {
    updateMapTheme(isLight);
  }
});

// Clock update
setInterval(() => {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}, 1000);

// Tab Navigation
const navBtns = document.querySelectorAll('.nav-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.add('hidden'));

    btn.classList.add('active');
    const targetId = btn.dataset.target;
    const targetElem = document.getElementById(targetId);
    if (targetElem) targetElem.classList.remove('hidden');

    // Auto-generate WA Broadcast message when navigating to Broadcast tab to ensure actual data
    if (targetId === 'tab-wa') {
      const btnGenWa = document.getElementById('btn-gen-wa');
      if (btnGenWa) {
        btnGenWa.click();
      }
    }
  });
});

// Data Table Sub-tab Navigation
document.querySelectorAll('#datatable-subtab-seg .seg-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const parent = e.target.closest('#datatable-subtab-seg');
    if (parent) {
      parent.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    }
    e.target.classList.add('active');

    const subtarget = e.target.dataset.subtarget;
    document.querySelectorAll('.dt-subtab-pane').forEach(pane => pane.classList.add('hidden'));
    const targetPane = document.getElementById(subtarget);
    if (targetPane) targetPane.classList.remove('hidden');
  });
});

function resetPivotAndNetdroneData() {
  const txtPivot = document.getElementById('txt-pivot');
  if (txtPivot) txtPivot.value = '';
  pivotData = [];
  localStorage.removeItem('cjhelper_pivot_data');
  localStorage.removeItem('cjhelper_pivot_text');
  const pivotTbody = document.getElementById('pivot-tbody');
  if (pivotTbody) pivotTbody.innerHTML = '<tr><td colspan="8" class="text-center text-subtle" style="padding: 20px;">Belum ada data pivot diproses.</td></tr>';

  const txtNetdrone = document.getElementById('txt-netdrone');
  if (txtNetdrone) txtNetdrone.value = '';
  netdroneData = [];
  localStorage.removeItem('cjhelper_netdrone_data');
  localStorage.removeItem('cjhelper_netdrone_text');
  if (typeof renderNetdroneTable === 'function') renderNetdroneTable();
}

// Tauri Commands - Input & Status
const btnProcess = document.getElementById('btn-process');
const btnClear = document.getElementById('btn-clear');
const txtMaster = document.getElementById('txt-master');
const statusBar = document.getElementById('status-bar');

const dashMaster = document.getElementById('dash-master');
const dashUp = document.getElementById('dash-up');
const dashDown = document.getElementById('dash-down');

const lblUpCount = document.getElementById('lbl-up-count');
const lblDownCount = document.getElementById('lbl-down-count');
const statusTbody = document.getElementById('status-tbody');

let statusData = [];
let lastSelectedIndex = -1;
let activeRegionFilter = 'ALL'; // 'ALL', 'CJN', 'CJS'

function getSiteRegion(s) {
  if (!s) return 'CJN';
  const text = `${s.cluster || ''} ${s.site_name || ''} ${s.remark || ''} ${s.pic || ''}`.toUpperCase();
  if (text.includes('CJS') || text.includes('SOUTH')) return 'CJS';
  if (text.includes('CJN') || text.includes('NORTH')) return 'CJN';

  const cjnKeywords = ["SEMARANG", "DEMAK", "KUDUS", "PATI", "JEPARA", "GROBOGAN", "BLORA", "REMBANG", "PEKALONGAN", "BATANG", "PEMALANG", "TEGAL", "BREBES", "KENDAL"];
  const cjsKeywords = ["SOLO", "SURAKARTA", "BOYOLALI", "SUKOHARJO", "KARANGANYAR", "WONOGIRI", "SRAGEN", "KLATEN", "MAGELANG", "PURWOREJO", "TEMANGGUNG", "WONOSOBO", "KEBUMEN", "BANYUMAS", "PURWOKERTO", "CILACAP", "PURBALINGGA", "BANJARNEGARA"];

  if (cjnKeywords.some(kw => text.includes(kw))) return 'CJN';
  if (cjsKeywords.some(kw => text.includes(kw))) return 'CJS';

  return 'CJN';
}

function renderStatus() {
  const filterStatus = document.querySelector('#st-filter-status .active')?.dataset.val || 'ALL';
  const sortDur = document.querySelector('#st-filter-sort .active')?.dataset.val || 'none';
  const searchStr = document.getElementById('st-search').value.toLowerCase().trim();

  let filtered = statusData;

  if (activeRegionFilter !== 'ALL') {
    filtered = filtered.filter(s => getSiteRegion(s) === activeRegionFilter);
  }

  if (filterStatus !== 'ALL') {
    filtered = filtered.filter(s => s.status === filterStatus);
  }

  if (searchStr) {
    filtered = filtered.filter(s =>
      s.cluster.toLowerCase().includes(searchStr) ||
      s.site_name.toLowerCase().includes(searchStr) ||
      s.new_site.toLowerCase().includes(searchStr)
    );
  }

  if (sortDur !== 'none') {
    filtered = [...filtered].sort((a, b) => {
      if (sortDur === 'desc') return a.start_timestamp - b.start_timestamp;
      return b.start_timestamp - a.start_timestamp;
    });
  } else {
    filtered = [...filtered].sort((a, b) => {
      if (!a.rts) return 1;
      if (!b.rts) return -1;
      return a.rts.localeCompare(b.rts);
    });
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach((s, index) => {
    const tr = document.createElement('tr');
    tr.className = s.status.toLowerCase();
    tr.dataset.index = index;
    tr.dataset.copyStr = `${s.new_site} - ${s.site_name} - ${s.cluster} ${s.icon}`;

    const impactClass = s.impact && s.impact.toLowerCase().includes('fully') ? 'br' : 'bb';
    const agingClass = s.agging && (s.agging.includes('d') || s.agging.includes('day')) ? 'br' : (s.agging && (s.agging.includes('24') || s.agging.includes('8-24'))) ? 'ba' : 'bb';

    tr.innerHTML = `
      <td>${s.icon}</td>
      <td>${s.new_site}</td>
      <td>${s.site_name}</td>
      <td>${s.cluster}</td>
      <td><span class="badge ${impactClass}">${s.impact}</span></td>
      <td>${s.rts}</td>
      <td>${s.start_time}</td>
      <td><span class="badge ${agingClass}">${s.agging}</span></td>
      <td>${s.remark}</td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.shiftKey && lastSelectedIndex !== -1) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const rows = Array.from(statusTbody.children);
        rows.forEach((r, i) => {
          if (i >= start && i <= end) r.classList.add('selected');
        });
        document.getSelection().removeAllRanges();
      } else if (e.ctrlKey) {
        tr.classList.toggle('selected');
        lastSelectedIndex = index;
      } else {
        Array.from(statusTbody.children).forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
        lastSelectedIndex = index;
      }
    });

    fragment.appendChild(tr);
  });

  statusTbody.innerHTML = '';
  statusTbody.appendChild(fragment);
}

// Filter Event Listeners
document.querySelectorAll('.segmented-control .seg-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const parent = e.target.closest('.segmented-control');
    parent.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    renderStatus();
  });
});

document.getElementById('st-search').addEventListener('input', renderStatus);
document.getElementById('st-search-reset').addEventListener('click', () => {
  document.getElementById('st-search').value = '';
  document.querySelectorAll('#st-filter-status .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === 'ALL');
  });
  document.querySelectorAll('#st-filter-sort .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === 'none');
  });
  renderStatus();
});

// Copy Logic
async function flashCopyInfo(msg) {
  const lbl = document.getElementById('st-copy-info');
  const orig = "Shift+klik range | Ctrl+klik multi | Ctrl+C copy";
  lbl.textContent = msg;
  setTimeout(() => {
    lbl.textContent = orig;
  }, 2000);
}

document.getElementById('btn-st-copy-sel').addEventListener('click', async () => {
  const selected = Array.from(statusTbody.querySelectorAll('tr.selected'))
    .map(tr => tr.dataset.copyStr);
  if (selected.length === 0) return alert("Pilih baris dulu.");
  await navigator.clipboard.writeText(selected.join('\n'));
  flashCopyInfo(`Copied ${selected.length} item!`);
});

document.getElementById('btn-st-copy-down').addEventListener('click', async () => {
  const downs = statusData.filter(s => s.status === 'DOWN')
    .map(s => `${s.new_site} - ${s.site_name} - ${s.cluster} ${s.icon}`);
  if (downs.length === 0) return;
  await navigator.clipboard.writeText(downs.join('\n'));
  flashCopyInfo(`Copied ${downs.length}!`);
});

document.getElementById('btn-st-copy-up').addEventListener('click', async () => {
  const ups = statusData.filter(s => s.status === 'UP')
    .map(s => `${s.new_site} - ${s.site_name} - ${s.cluster} ${s.icon}`);
  if (ups.length === 0) return;
  await navigator.clipboard.writeText(ups.join('\n'));
  flashCopyInfo(`Copied ${ups.length}!`);
});

document.getElementById('btn-st-copy-all').addEventListener('click', async () => {
  const all = statusData.map(s => `${s.new_site} - ${s.site_name} - ${s.cluster} ${s.icon}`);
  if (all.length === 0) return;
  await navigator.clipboard.writeText(all.join('\n'));
  alert(`Copied ${all.length} baris.`);
});

// Ctrl+C Listener for table body
document.addEventListener('keydown', async (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    // Check if we are focusing inputs to not steal normal copy
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    const selected = Array.from(statusTbody.querySelectorAll('tr.selected')).map(tr => tr.dataset.copyStr);
    if (selected.length > 0) {
      await navigator.clipboard.writeText(selected.join('\n'));
      flashCopyInfo(`Copied ${selected.length} item!`);
    }
  }
});

async function checkStatus() {
  try {
    statusData = await invoke('check_site_status');
    const regionSites = activeRegionFilter === 'ALL' 
      ? statusData 
      : statusData.filter(s => getSiteRegion(s) === activeRegionFilter);

    let upCount = 0;
    let downCount = 0;

    regionSites.forEach(s => {
      if (s.status === 'UP') upCount++;
      else downCount++;
    });

    dashUp.textContent = upCount;
    dashDown.textContent = downCount;
    lblUpCount.textContent = upCount;
    lblDownCount.textContent = downCount;

    renderStatus();
    if (typeof renderPM === 'function') renderPM();

    // Auto generate WA Broadcast Preview
    if (typeof generateShareWA === 'function') {
      const waText = generateShareWA(statusData);
      const txtWaPreview = document.getElementById('txt-wa-preview');
      if (txtWaPreview) {
        txtWaPreview.value = waText;
        if (typeof updateWaCharCount === 'function') updateWaCharCount();
      }
    }
  } catch (err) {
    console.error(err);
  }
}

btnProcess.addEventListener('click', async () => {
  const text = txtMaster.value.trim();
  if (!text) {
    statusBar.textContent = "Data kosong.";
    return;
  }

  // Reset Data Pivot & Data Netdrone per user specification
  resetPivotAndNetdroneData();

  statusBar.textContent = "Memproses data...";
  try {
    const res = await invoke('parse_pasted_table', { text });
    dashMaster.textContent = res.count;

    if (res.status === "UNCHANGED") {
      statusBar.textContent = `⚠️ Data sama — ✅ snapshot dipertahankan. (${res.count} baris, ${new Date().toLocaleTimeString('id-ID')})`;
    } else if (res.status === "UPDATED_DETAILS") {
      statusBar.textContent = `✅ Details updated — snapshot maintained. (${res.count} rows, ${new Date().toLocaleTimeString('id-ID')})`;
    } else if (res.status === "NEW_BASELINE") {
      document.getElementById('lbl-snapshot').textContent = `Baseline: ${res.count} rows (first run)`;
      statusBar.textContent = `Done! Data: ${res.count} rows processed.`;
    } else if (res.status === "UPDATED") {
      document.getElementById('lbl-snapshot').textContent = `Snapshot ${res.count} rows — saved at ${new Date().toLocaleTimeString('id-ID')}`;
      statusBar.textContent = `Done! Data: ${res.count} rows processed.`;
    } else {
      statusBar.textContent = `Done! Data is empty or format not recognized.`;
    }

    await checkStatus();
  } catch (err) {
    statusBar.textContent = "Error: " + err;
  }
});

const btnLoadDb = document.getElementById('btn-load-db');
if (btnLoadDb) {
  btnLoadDb.addEventListener('click', async () => {
    try {
      const selectedPath = await invoke('pick_db_file');
      if (selectedPath) {
        const fileName = selectedPath.split(/[\\/]/).pop();
        const lblDash = document.getElementById('lbl-dash-db-filename');
        if (lblDash) {
          lblDash.textContent = `⏳ Memuat & memproses ${fileName}...`;
          lblDash.style.color = "var(--amb)";
        }
        
        const lblCek = document.getElementById('lbl-cek-db');
        if (lblCek) {
          lblCek.textContent = `⏳ Memuat & memproses file Excel ${fileName}...`;
          lblCek.className = "text-info text-sm";
        }

        await new Promise(r => setTimeout(r, 60));

        const count = await invoke('load_db_excel', { path: selectedPath });
        document.getElementById('dash-db').textContent = count;

        if (typeof SiteChangesManager !== 'undefined' && Object.keys(SiteChangesManager.siteOverrides).length > 0) {
          await SiteChangesManager.applyToMemory(false, true);
        }

        if (lblDash) {
          lblDash.textContent = `📁 ${fileName} (${count} baris)`;
          lblDash.style.color = "var(--accent-lit)";
        }
        if (lblCek) {
          lblCek.textContent = `DB Loaded: ${fileName} (${count} baris)`;
          lblCek.className = "text-success text-sm";
        }
      } else {
        const lblDash = document.getElementById('lbl-dash-db-filename');
        if (lblDash && lblDash.textContent.includes('Memuat')) lblDash.textContent = "Belum di-load";
      }
    } catch (err) {
      const lblDash = document.getElementById('lbl-dash-db-filename');
      if (lblDash) {
        lblDash.textContent = "❌ Gagal memuat DB";
        lblDash.style.color = "var(--red)";
      }
      console.error(err);
    }
  });
}

const btnDashImportContact = document.getElementById('btn-dash-import-contact');
if (btnDashImportContact) {
  btnDashImportContact.addEventListener('click', async () => {
    try {
      const selectedPath = await invoke('pick_db_file');
      if (selectedPath) {
        const fileName = selectedPath.split(/[\\/]/).pop();
        const lblStatus = document.getElementById('lbl-dash-contact-status');
        if (lblStatus) {
          lblStatus.textContent = `⏳ Memuat & memproses ${fileName}...`;
          lblStatus.style.color = "var(--amb)";
        }

        await new Promise(r => setTimeout(r, 60));

        const count = await invoke('load_te_contacts_excel', { path: selectedPath });

        if (lblStatus) {
          lblStatus.textContent = `📁 ${fileName} (${count} kontak)`;
          lblStatus.style.color = "var(--grn)";
        }

        await loadWaTeContacts();
        if (typeof renderWaTeContactsTable === 'function') {
          renderWaTeContactsTable(typeof waTeSearch !== 'undefined' && waTeSearch ? waTeSearch.value : "");
        }
      }
    } catch (err) {
      alert("Gagal mengimpor Excel TE: " + err);
      const lblStatus = document.getElementById('lbl-dash-contact-status');
      if (lblStatus) {
        lblStatus.textContent = "❌ Gagal mengimpor Excel";
        lblStatus.style.color = "var(--red)";
      }
    }
  });
}

document.getElementById('btn-reset-snap').addEventListener('click', async () => {
  try {
    await invoke('reset_snapshot');
    await invoke('clear_data');
    txtMaster.value = '';
    dashMaster.textContent = '0';
    resetPivotAndNetdroneData();
    document.getElementById('lbl-snapshot').textContent = `Direset — proses berikutnya akan dipakai sebagai baseline`;
    document.getElementById('lbl-snapshot').className = "text-warning ml-2";
    statusBar.textContent = `Snapshot dan data master direset.`;
    await checkStatus();
  } catch (err) {
    statusBar.textContent = "Error: " + err;
  }
});

btnClear.addEventListener('click', async () => {
  txtMaster.value = '';
  await invoke('clear_data');
  dashMaster.textContent = '0';
  resetPivotAndNetdroneData();
  statusBar.textContent = 'Data di-clear.';
});

document.getElementById('btn-manual-snap').addEventListener('click', async () => {
  try {
    const count = await invoke('snapshot_data');
    document.getElementById('lbl-snapshot').textContent = `📸 Manual snapshot ${count} baris ✅ ${new Date().toLocaleTimeString('id-ID')}`;
    document.getElementById('lbl-snapshot').className = "text-success ml-2";
    statusBar.textContent = `Manual snapshot: ${count} baris tersimpan.`;
    await checkStatus();
  } catch (err) {
    statusBar.textContent = "Error: " + err;
  }
});

let lastSnapshotHour = -1;
setInterval(async () => {
  const now = new Date();
  if (now.getHours() !== lastSnapshotHour && now.getMinutes() < 2) {
    try {
      const txt = document.getElementById('dash-master').textContent;
      if (txt && parseInt(txt) > 0) {
        const count = await invoke('snapshot_data');
        lastSnapshotHour = now.getHours();
        document.getElementById('lbl-snapshot').textContent = `⏰ Auto-snapshot ${count} baris — jam ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
        document.getElementById('lbl-snapshot').className = "text-info ml-2";
        await checkStatus();
      }
    } catch (e) {
      console.error(e);
    }
  }
}, 60000);

// PM logic moved to end of file (renderPM block)

// WA Broadcast Logic
const btnWaStatus = document.getElementById('btn-wa-status');
const btnWaStart = document.getElementById('btn-wa-start');
const waStatusText = document.getElementById('wa-status-text');

let waRegion = "CJN";
const regionBtns = document.querySelectorAll('#wa-region-seg button');
if (regionBtns) {
  regionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      regionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      waRegion = btn.dataset.val;
    });
  });
}

let waPollInterval = 10000;
let waPollTimeout = null;

async function checkWaStatus() {
  try {
    const status = await invoke('wa_status');
    const st = status?.status || "DISCONNECTED";
    const qr = status?.qr;
    const logs = status?.logs || [];

    // Adaptive interval
    const nextInterval = (st === "QR_READY" || document.getElementById('wa-qr-modal')?.style.display === 'flex') ? 1500 : 10000;
    if (nextInterval !== waPollInterval) {
      waPollInterval = nextInterval;
      startWaPolling();
    }

    // Render Logs in Modal
    const logsPre = document.getElementById('wa-server-logs');
    const logsContainer = document.getElementById('wa-server-logs-container');
    if (logsPre && logs.length > 0) {
      logsPre.textContent = logs.join('\n');
      if (logsContainer) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
      }
    }

    // Update Status Badge in Modal
    const modalBadge = document.getElementById('wa-modal-status-badge');
    if (modalBadge) {
      modalBadge.textContent = st;
      if (st === "CONNECTED") {
        modalBadge.style.background = "rgba(46, 204, 113, 0.2)";
        modalBadge.style.color = "#2ecc71";
      } else if (st === "QR_READY") {
        modalBadge.style.background = "rgba(241, 196, 15, 0.2)";
        modalBadge.style.color = "#f1c40f";
      } else {
        modalBadge.style.background = "rgba(231, 76, 60, 0.2)";
        modalBadge.style.color = "#e74c3c";
      }
    }

    // Main header status indicator
    if (waStatusText) {
      waStatusText.textContent = st;
      if (st === "CONNECTED") {
        waStatusText.style.color = "var(--grn)";
        waStatusText.textContent = "CONNECTED";
        document.getElementById('srv-dot-indicator')?.classList.replace('srv-off', 'srv-on');
      } else if (st === "QR_READY") {
        waStatusText.style.color = "var(--amb)";
        waStatusText.textContent = "SCAN QR";
        document.getElementById('srv-dot-indicator')?.classList.replace('srv-on', 'srv-off');
      } else {
        waStatusText.style.color = "var(--red)";
        document.getElementById('srv-dot-indicator')?.classList.replace('srv-on', 'srv-off');
      }
    }

    // Handle QR code display
    const qrWrapper = document.getElementById('wa-qr-wrapper');
    if (st === "QR_READY" && qr) {
      if (qrWrapper) qrWrapper.style.display = 'flex';
      const qrImg = document.getElementById('wa-qr-img');
      const newSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr)}`;
      if (qrImg && qrImg.src !== newSrc) {
        qrImg.src = newSrc;
      }
    } else {
      if (qrWrapper) qrWrapper.style.display = 'none';
    }

    const sendBtn = document.getElementById('btn-wa-send');
    if (sendBtn) sendBtn.disabled = (st !== "CONNECTED");

  } catch (err) {
    if (waStatusText) {
      waStatusText.textContent = "DISCONNECTED";
      waStatusText.style.color = "var(--red)";
    }
    const indicator = document.getElementById('srv-dot-indicator');
    if (indicator) {
      indicator.classList.remove('srv-on');
      indicator.classList.add('srv-off');
    }
    const sendBtn = document.getElementById('btn-wa-send');
    if (sendBtn) sendBtn.disabled = true;
  }
}

function startWaPolling() {
  if (waPollTimeout) clearTimeout(waPollTimeout);
  checkWaStatus().then(() => {
    waPollTimeout = setTimeout(startWaPolling, waPollInterval);
  });
}

function showWaModal() {
  const qrModal = document.getElementById('wa-qr-modal');
  if (qrModal) {
    qrModal.classList.remove('hidden');
    qrModal.style.display = 'flex';
  }
}

document.getElementById('btn-close-wa-qr').addEventListener('click', () => {
  const modal = document.getElementById('wa-qr-modal');
  modal.classList.add('hidden');
  modal.style.display = 'none';
});

if (btnWaStatus) {
  btnWaStatus.addEventListener('click', () => {
    showWaModal();
    checkWaStatus();
  });
}
startWaPolling();

if (btnWaStart) {
  btnWaStart.addEventListener('click', async () => {
    try {
      // 1. Tampilkan modal log & QR secara langsung
      showWaModal();

      const logsPre = document.getElementById('wa-server-logs');
      if (logsPre) logsPre.textContent = "[SYSTEM] Memulai WhatsApp Server...";
      const modalBadge = document.getElementById('wa-modal-status-badge');
      if (modalBadge) {
        modalBadge.textContent = "STARTING...";
        modalBadge.style.background = "rgba(52, 152, 219, 0.2)";
        modalBadge.style.color = "#3498db";
      }

      if (waStatusText) waStatusText.textContent = "Checking...";

      // Check if server is already running
      let isActive = false;
      try {
        const check = await invoke('wa_status');
        if (check && (check.status === "CONNECTED" || check.status === "QR_READY")) {
          isActive = true;
        }
      } catch (e) {
        // Server not running
      }

      if (isActive) {
        if (waStatusText) {
          waStatusText.textContent = "Server already active!";
          waStatusText.className = "text-xs text-success font-bold";
        }
        await checkWaStatus();
        return;
      }

      if (waStatusText) waStatusText.textContent = "Starting...";

      // Fast polling saat start server
      waPollInterval = 1000;
      startWaPolling();

      await invoke('wa_start_server');

      if (waStatusText) {
        waStatusText.textContent = "Server node started!";
        waStatusText.className = "text-xs text-success font-bold";
      }
    } catch (err) {
      if (waStatusText) {
        waStatusText.textContent = "Error: " + err;
        waStatusText.className = "text-xs text-error font-bold";
      }
      const logsPre = document.getElementById('wa-server-logs');
      if (logsPre) logsPre.textContent += `\n[ERROR] Gagal memanggil wa_start_server: ${err}`;
    }
  });
}

const btnWaReset = document.getElementById('btn-wa-reset');
if (btnWaReset) {
  btnWaReset.addEventListener('click', async () => {
    if (!confirm("Apakah Anda yakin ingin me-reset koneksi / logout WhatsApp? Session akan dihapus dan Anda perlu melakukan scan QR code kembali.")) return;

    try {
      if (waStatusText) waStatusText.textContent = "Resetting...";
      const oldText = btnWaReset.innerHTML;
      btnWaReset.disabled = true;
      btnWaReset.innerHTML = "⏳ ...";

      await invoke('wa_logout');

      if (waStatusText) {
        waStatusText.textContent = "LOGGED OUT";
        waStatusText.style.color = "var(--red)";
      }

      alert("WhatsApp session berhasil di-logout / reset!");
      btnWaReset.innerHTML = oldText;
      btnWaReset.disabled = false;

      // Auto-poll status
      await checkWaStatus();
    } catch (err) {
      alert("Gagal me-reset WA: " + err);
      if (btnWaReset) {
        btnWaReset.innerHTML = "Reset WA";
        btnWaReset.disabled = false;
      }
    }
  });
}

const btnGenWa = document.getElementById('btn-gen-wa');
const txtWaPreview = document.getElementById('txt-wa-preview');

function generateShareWA(statuses) {
  if (!statuses || statuses.length === 0) return "Belum ada data Master.";

  let now = new Date();
  if (now.getMinutes() >= 30) {
    now.setHours(now.getHours() + 1);
    now.setMinutes(0, 0, 0);
  } else {
    now.setMinutes(0, 0, 0);
  }

  // Ganjil (Odd) = Hide Remark, Genap (Even) = Show Remark
  let showRemark = (now.getHours() % 2 === 0);

  const ds = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(/ /g, '-');
  const ts = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');

  const regionLabel = (typeof waRegion !== 'undefined' ? waRegion : 'CJN');

  // Python uses specific sorting
  const natSort = (arr) => {
    return arr.sort((a, b) => (a.rts || "").localeCompare(b.rts || "", undefined, { numeric: true, sensitivity: 'base' }));
  };

  const downs = statuses.filter(s => s.status === 'DOWN');

  const chkWaEnableNetdrone = document.getElementById('chk-wa-enable-netdrone');
  const netdroneEnabled = chkWaEnableNetdrone ? chkWaEnableNetdrone.checked : false;
  if (netdroneEnabled && typeof netdroneData !== 'undefined' && netdroneData && netdroneData.length > 0) {
    netdroneData.filter(d => !d.skipped && d.matchedDb).forEach(nr => {
      const siteObj = {
        status: 'DOWN',
        impact: 'Full Sitedown',
        new_site: nr.siteId,
        old_site: "",
        site_name: nr.siteName,
        cluster: nr.cluster || "",
        pic: nr.pic || "",
        rts: nr.rts || "",
        start_time: nr.startTime || "",
        start_timestamp: 0,
        agging: "",
        remark: nr.remark || "",
        category: nr.category || "",
        site_class: nr.siteClass || "",
        vendor: nr.vendor || "",
        is_netdrone: true
      };
      if (regionLabel === 'ALL' || getSiteRegion(siteObj) === regionLabel) {
        downs.push(siteObj);
      }
    });
  }

  const ful = natSort(downs.filter(s => s.is_netdrone || (s.impact && (s.impact.toLowerCase().includes('fully') || s.impact.toLowerCase().includes('sitedown')))));
  const cel = natSort(downs.filter(s => !s.is_netdrone && (!s.impact || (!s.impact.toLowerCase().includes('fully') && !s.impact.toLowerCase().includes('sitedown')))));

  const bcch_kw = (fmtBc.key_bcch || "BCCH").toUpperCase();
  const cel_bcch = cel.filter(s => (s.remark || "").toUpperCase().includes(bcch_kw));
  const cel_normal = cel.filter(s => !((s.remark || "").toUpperCase().includes(bcch_kw)));

  const sec_sd = (fmtBc.lbl_sd || "SITE DOWN :").replace(/:/g, "").trim();
  const sec_cd = (fmtBc.lbl_cd || "CELLS DOWN :").replace(/:/g, "").trim();
  const sec_bcch = (fmtBc.lbl_bcch || "CELL DOWN BCCH Missing NOKIA :").trim();

  const toLines = (items) => {
    return items.map(s => {
      const isFully = s.is_netdrone || (s.impact && (s.impact.toLowerCase().includes('fully') || s.impact.toLowerCase().includes('sitedown')));
      const combined = ((s.category || '') + " " + (s.impact || '')).toUpperCase().replace(/[-_\s]+/g, ' ');
      const isHub = combined.includes('HUB') && (combined.includes('MEDIUM') || combined.includes('BIG'));
      const isCritical = (s.site_class || '').toUpperCase().includes('CRITICAL');
      const icon = (isHub || isCritical) ? "⚠️" : (fmtBc.icon_down || "▶️");

      let entryTime = s.start_time || "";
      if (s.start_timestamp > 0) {
        const d = new Date(s.start_timestamp * 1000);
        entryTime = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()} | ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
      }

      const ctx = {
        icon: icon,
        rts: s.rts || s.pic || "",
        cluster: s.cluster || "",
        new: s.new_site || "",
        sitename: s.site_name || "",
        old: "", // Python broadcast tab explicitly leaves old empty
        time: entryTime,
        remark: s.remark || "",
        category: s.category || "",
        type: isFully ? "SITE DOWN" : "CELLS DOWN",
        pic: s.pic || "",
        te: s.pic || ""
      };

      let ln = (fmtBc.msg_line || "{icon} {rts} / {cluster} /  {new}  / {sitename} / {category} / {time}").replace(/\{(\w+)\}/g, (_, k) => ctx[k] || "");
      if (showRemark && s.remark && !s.is_pivot && (fmtBc.msg_remark || " / {remark}").trim()) {
        ln += (fmtBc.msg_remark || " / {remark}").replace(/\{(\w+)\}/g, (_, k) => ctx[k] || "");
      }
      return ln;
    }).join("\n");
  };

  const parts = [];

  // Header 1: SITE FULLY DOWN
  let hdrTpl = fmtBc.msg_hdr || "*SITE FULLY DOWN {region}  {date} {jam}*\n*TOTAL SITEDOWN : {total_sd}*";
  const hdrText = hdrTpl
    .replace(/{region}/g, regionLabel)
    .replace(/{date}/g, ds)
    .replace(/{jam}/g, ts)
    .replace(/{total_sd}/g, ful.length)
    .replace(/{total_cd}/g, cel_normal.length);
  parts.push(hdrText);
  parts.push("");

  // 1. Stollen Alarms (below header, but above the site down list)
  if (typeof pivotData !== 'undefined' && pivotData.length > 0) {
    const stollenRows = pivotData.filter(r => r.monitoring === 'STOLLEN');
    const stollenSystems = [...new Set(stollenRows.map(r => r.system))];
    stollenSystems.forEach(sys => {
      const sysRows = stollenRows.filter(r => r.system === sys);
      if (sysRows.length > 0) {
        parts.push(`*ALARM STOLLEN BATTERY ${sys} : *`);
        const items = sysRows.map(row => {
          const item = convertPivotRowToSiteItem(row);
          item.category = "STOLEN BATTERY";
          return item;
        });
        parts.push(toLines(items));
        parts.push("");
      }
    });

    const cableStollenRows = pivotData.filter(r => r.monitoring === 'CABLE STOLLEN');
    const cableStollenSystems = [...new Set(cableStollenRows.map(r => r.system))];
    cableStollenSystems.forEach(sys => {
      const sysRows = cableStollenRows.filter(r => r.system === sys);
      if (sysRows.length > 0) {
        parts.push(`*INDIKASI CABLE STOLLEN ${sys}*`);
        const items = sysRows.map(row => {
          const item = convertPivotRowToSiteItem(row);
          item.category = "STOLEN CABLE";
          return item;
        });
        parts.push(toLines(items));
        parts.push("");
      }
    });
  }

  const ful_hw = ful.filter(e => (e.vendor || "").toUpperCase().includes("HUA"));
  const ful_nok = ful.filter(e => (e.vendor || "").toUpperCase().includes("NOK"));
  const ful_oth = ful.filter(e => !(e.vendor || "").toUpperCase().includes("HUA") && !(e.vendor || "").toUpperCase().includes("NOK"));

  if (ful_hw.length > 0) { parts.push(`*${sec_sd} MOCN HUAWEI :: ${ful_hw.length}*`); parts.push(toLines(ful_hw)); parts.push(""); }
  if (ful_nok.length > 0) { parts.push(`*${sec_sd} MOCN NOKIA :: ${ful_nok.length}*`); parts.push(toLines(ful_nok)); parts.push(""); }
  if (ful_oth.length > 0) { parts.push(`*${sec_sd}*`); parts.push(toLines(ful_oth)); parts.push(""); }
  if (ful.length === 0) { parts.push(`*${sec_sd}*`); parts.push("- Nihil -"); parts.push(""); }

  // 2. Append Enva Alarms below Site Down formatted identically using toLines
  if (typeof pivotData !== 'undefined' && pivotData.length > 0) {
    const envaRows = pivotData.filter(r => r.monitoring === 'POWER NOW' || (r.monitoring || '').includes('POWER') || (r.monitoring || '').includes('ENVA'));
    const envaSystems = [...new Set(envaRows.map(r => r.system))];
    envaSystems.forEach(sys => {
      const sysRows = envaRows.filter(r => r.system === sys);
      if (sysRows.length > 0) {
        parts.push(`*ENVA POWER ${sys} : : ${sysRows.length}*`);
        const items = sysRows.map(row => convertPivotRowToSiteItem(row));
        parts.push(toLines(items));
        parts.push("");
      }
    });
  }

  const cel_hw = cel_normal.filter(e => (e.vendor || "").toUpperCase().includes("HUA"));
  const cel_nok = cel_normal.filter(e => (e.vendor || "").toUpperCase().includes("NOK"));
  const cel_oth = cel_normal.filter(e => !(e.vendor || "").toUpperCase().includes("HUA") && !(e.vendor || "").toUpperCase().includes("NOK"));

  if (cel_hw.length > 0) { parts.push(`*${sec_cd} MOCN HUAWEI :: ${cel_hw.length}*`); parts.push(toLines(cel_hw)); parts.push(""); }
  if (cel_nok.length > 0) { parts.push(`*${sec_cd} MOCN NOKIA :: ${cel_nok.length}*`); parts.push(toLines(cel_nok)); parts.push(""); }
  if (cel_oth.length > 0) { parts.push(`*${sec_cd}*`); parts.push(toLines(cel_oth)); parts.push(""); }
  if (cel_normal.length === 0) { parts.push(`*${sec_cd}*`); parts.push("- Nihil -"); parts.push(""); }

  if (cel_bcch.length > 0) {
    parts.push(`*${sec_bcch} (${cel_bcch.length})*`);
    parts.push(toLines(cel_bcch));
  }

  return parts.join("\n").trim();
}
if (btnGenWa) {
  btnGenWa.addEventListener('click', async () => {
    try {
      const statuses = await invoke('check_site_status');
      const waText = generateShareWA(statuses);
      if (txtWaPreview) {
        txtWaPreview.value = waText;
        updateWaCharCount();
      }
    } catch (err) {
      console.error(err);
    }
  });
}

function updateWaCharCount() {
  const preview = document.getElementById('txt-wa-preview');
  if (!preview) return;
  const val = preview.value;
  const chars = val.length;
  const lines = val ? val.split('\n').length : 0;
  const lbl = document.getElementById('wa-char-count');
  if (lbl) lbl.textContent = `${chars} karakter | ${lines} baris`;
}

if (txtWaPreview) txtWaPreview.addEventListener('input', updateWaCharCount);

const btnCopyWa = document.getElementById('btn-copy-wa');
if (btnCopyWa) {
  btnCopyWa.addEventListener('click', () => {
    const preview = document.getElementById('txt-wa-preview');
    if (!preview) return;
    const txt = preview.value;
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    const old = btnCopyWa.textContent;
    btnCopyWa.textContent = "✓ Copied!";
    setTimeout(() => btnCopyWa.textContent = old, 2000);
  });
}

// Broadcast List Rendering (Right Column)
function renderWaTargets() {
  const tbody = document.getElementById('wa-targets-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!savedWaGroups || savedWaGroups.length === 0) {
    tbody.innerHTML = '<tr><td class="text-center text-subtle py-4">Belum ada grup disimpan.<br><small>Atur di Broadcast Utils</small></td></tr>';
    const targetCount = document.getElementById('wa-target-count');
    if (targetCount) targetCount.textContent = "0 grup terpilih";
    return;
  }

  savedWaGroups.forEach(g => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center" style="width: 40px;">
        <input type="checkbox" class="wa-target-chk checkbox" data-id="${g.group_id}" data-name="${g.group_name}" checked>
      </td>
      <td class="text-sm font-bold text-success">${g.group_name}</td>
    `;
    tr.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const chk = tr.querySelector('input');
        chk.checked = !chk.checked;
        updateWaTargetCount();
      }
    });
    tr.querySelector('input').addEventListener('change', updateWaTargetCount);
    tbody.appendChild(tr);
  });
  updateWaTargetCount();
}

function updateWaTargetCount() {
  const count = document.querySelectorAll('.wa-target-chk:checked').length;
  const targetCount = document.getElementById('wa-target-count');
  if (targetCount) targetCount.textContent = `${count} grup terpilih`;
}

// KIRIM BROADCAST
const btnWaSend = document.getElementById('btn-wa-send');
if (btnWaSend) {
  btnWaSend.addEventListener('click', async () => {
    const preview = document.getElementById('txt-wa-preview');
    if (!preview) return;
    const waText = preview.value.trim();
    if (!waText) { alert("Pesan kosong. Generate dulu."); return; }

    const selected = Array.from(document.querySelectorAll('.wa-target-chk:checked')).map(c => ({
      group_id: c.dataset.id,
      group_name: c.dataset.name
    }));

    if (selected.length === 0) { alert("Tidak ada grup yang dicentang."); return; }

    const confirmed = confirm(`Kirim pesan ke ${selected.length} grup?\n\n` + selected.map(g => "• " + g.group_name).join("\n"));
    if (!confirmed) return;

    btnWaSend.disabled = true;
    btnWaSend.textContent = "MENGIRIM...";

    const progressContainer = document.getElementById('wa-bc-progress-container');
    const progressStatus = document.getElementById('wa-bc-progress-status');
    const progressPercent = document.getElementById('wa-bc-progress-percent');
    const progressFill = document.getElementById('wa-bc-progress-fill');
    const progressPulse = document.getElementById('wa-bc-pulse');

    if (progressContainer) {
      progressContainer.style.display = 'flex';
      if (progressFill) progressFill.style.background = 'var(--accent)';
      if (progressPulse) progressPulse.style.background = 'var(--accent)';
    }

    let totalSuccess = 0;
    let totalFailed = 0;

    try {
      for (let i = 0; i < selected.length; i++) {
        const g = selected[i];
        const pct = Math.round(((i + 1) / selected.length) * 100);
        if (progressStatus) progressStatus.textContent = `⏳ Mengirim (${i + 1}/${selected.length}): ${g.group_name}`;
        if (progressPercent) progressPercent.textContent = `${pct}%`;
        if (progressFill) progressFill.style.width = `${pct}%`;

        try {
          const res = await invoke('wa_broadcast', {
            targets: [{ group_id: g.group_id, message: waText }],
            delay_ms: 1500
          });
          totalSuccess += (res.success || 0);
          totalFailed += (res.failed || 0);
        } catch (e) {
          totalFailed++;
          console.error(`Gagal mengirim ke ${g.group_name}:`, e);
        }

        if (i < selected.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (progressStatus) progressStatus.textContent = `✅ Broadcast Selesai: ${totalSuccess}/${selected.length} berhasil!`;
      if (progressPercent) progressPercent.textContent = `100%`;
      if (progressFill) {
        progressFill.style.width = `100%`;
        progressFill.style.background = `var(--grn)`;
      }
      if (progressPulse) progressPulse.style.background = 'var(--grn)';

      // Add to logs
      const groupsArr = selected.map(g => g.group_name);
      addBroadcastLog(totalSuccess, selected.length, groupsArr);

      setTimeout(() => {
        if (progressContainer) progressContainer.style.display = 'none';
        if (progressFill) progressFill.style.background = 'var(--accent)';
        if (progressPulse) progressPulse.style.background = 'var(--accent)';
      }, 7000);

    } catch (err) {
      alert("Error Broadcast: " + err);
    } finally {
      btnWaSend.disabled = false;
      btnWaSend.textContent = "KIRIM BROADCAST";
    }
  });

  document.getElementById('btn-close-bc-floating')?.addEventListener('click', () => {
    const c = document.getElementById('wa-bc-progress-container');
    if (c) c.style.display = 'none';
  });
}

// Database Lookup Logic
const btnDbSearch = document.getElementById('btn-db-search');
const btnDbClear = document.getElementById('btn-db-clear');
const dbSearchInput = document.getElementById('db-search-input');
const dbSearchStatus = document.getElementById('db-search-status');
const btnDbCopyAll = document.getElementById('btn-db-copy-all');

const dbFields = {
  'site-id-new': document.getElementById('db-f-site-id-new'),
  'area': document.getElementById('db-f-area'),
  'site-name': document.getElementById('db-f-site-name'),
  'vendor': document.getElementById('db-f-vendor'),
  'old-site-id': document.getElementById('db-f-old-site-id'),
  'host-name': document.getElementById('db-f-host-name'),
  'long': document.getElementById('db-f-long'),
  'cluster': document.getElementById('db-f-cluster'),
  'fm-office': document.getElementById('db-f-fm-office'),
  'lat': document.getElementById('db-f-lat'),
  'tlp': document.getElementById('db-f-tlp'),
  'rts-name': document.getElementById('db-f-rts-name'),
  'rts-new': document.getElementById('db-f-rts-new'),
  'rts-phone': document.getElementById('db-f-rts-phone'),
  'te-name': document.getElementById('db-f-te-name'),
  'te-phone': document.getElementById('db-f-te-phone'),
  'te-email': document.getElementById('db-f-te-email'),
  'cme-name': document.getElementById('db-f-cme-name'),
  'cme-phone': document.getElementById('db-f-cme-phone'),
  'cme-email': document.getElementById('db-f-cme-email')
};

let lastDbRow = null;

btnDbClear.addEventListener('click', () => {
  dbSearchInput.value = '';
  dbSearchStatus.textContent = '';
  lastDbRow = null;
  Object.values(dbFields).forEach(el => el.textContent = '—');
});

function getDbVal(row, keys) {
  if (!row) return '—';
  // Fallback if needed, but we now use exact keys
  return '—';
}

function buildDbCopyText(row) {
  const get = (k) => row[k] || '—';
  const lines = [
    `Site ID (New): ${get('Site ID (New)')}`,
    `Old Site ID: ${get('Old Site ID')}`,
    `Site Name: ${get('Site Name')}`,
    `Host Name: ${get('Host Name')}`,
    `Cluster (MC): ${get('Cluster (MC)')}`,
    `FM Office: ${get('FM Office')}`,
    `Area: ${get('Area')}`,
    `Vendor: ${get('Vendor')}`,
    `TE Name: ${get('TE Name')}`,
    `TE Phone: ${get('TE Phone')}`,
    `TE Email: ${get('TE Email')}`,
    `Longitude: ${get('Longitude')}`,
    `Latitude: ${get('Latitude')}`,
    `RTS Name: ${get('RTS Name')}`,
    `RTS Phone: ${get('RTS Phone')}`,
    `RTS NEW: ${get('RTS NEW')}`,
    `TLP: ${get('TLP')}`,
    `CME Name: ${get('CME Name')}`,
    `CME Phone: ${get('CME Phone')}`,
    `CME Email: ${get('CME Email')}`,
  ];
  return lines.join('\n');
}

btnDbSearch.addEventListener('click', async () => {
  const sid = dbSearchInput.value.trim();
  if (!sid) return;

  try {
    const row = await invoke('lookup_site', { siteId: sid });
    if (!row) {
      dbSearchStatus.textContent = `Site ${sid} tidak ditemukan di DB!`;
      lastDbRow = null;
      return;
    }

    lastDbRow = row;
    dbSearchStatus.textContent = '';

    // Fill fields
    const get = (k) => row[k] || '—';
    const setVal = (field, val) => {
      const el = dbFields[field];
      if (!el) return;
      const text = val || '—';
      el.textContent = text;
      if (text === '—' || !text) {
        el.classList.add('em');
      } else {
        el.classList.remove('em');
      }
    };

    setVal('site-id-new', get('Site ID (New)'));
    setVal('area', get('Area'));
    setVal('site-name', get('Site Name'));
    setVal('vendor', get('Vendor'));
    setVal('old-site-id', get('Old Site ID'));
    setVal('long', get('Longitude'));
    setVal('cluster', get('Cluster (MC)'));
    setVal('lat', get('Latitude'));
    setVal('host-name', get('Host Name'));
    setVal('fm-office', get('FM Office'));
    setVal('tlp', get('TLP'));

    setVal('rts-name', get('RTS Name'));
    setVal('rts-new', get('RTS NEW'));
    setVal('rts-phone', get('RTS Phone'));

    setVal('te-name', get('TE Name'));
    setVal('te-phone', get('TE Phone'));
    setVal('te-email', get('TE Email'));

    setVal('cme-name', get('CME Name'));
    setVal('cme-phone', get('CME Phone'));
    setVal('cme-email', get('CME Email'));

  } catch (e) {
    dbSearchStatus.textContent = `Error: ${e}`;
  }
});

dbSearchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') btnDbSearch.click();
});

btnDbCopyAll.addEventListener('click', () => {
  if (!lastDbRow) return;
  const text = buildDbCopyText(lastDbRow);
  navigator.clipboard.writeText(text);
  const old = btnDbCopyAll.textContent;
  btnDbCopyAll.textContent = "Copied!";
  setTimeout(() => btnDbCopyAll.textContent = old, 2000);
});

// Auto setup clipboards for fields
Object.values(dbFields).forEach(el => {
  el.addEventListener('click', () => {
    if (el.textContent && el.textContent !== '—') {
      navigator.clipboard.writeText(el.textContent);
      const old = el.style.color;
      el.style.color = 'var(--grn)';
      setTimeout(() => el.style.color = old, 1000);
    }
  });
});

// Maps Integration Logic
let siteMap = null;
let mapTileLayer = null;
let mapTileLayerRef = null;
let mapMarkers = [];
let currentMapTileType = localStorage.getItem('cjhelper_map_tile_type') || 'auto';

function applyMapTiles() {
  if (!siteMap) return;

  const isLight = document.body.classList.contains('light');
  let selected = currentMapTileType;
  if (selected === 'auto') {
    selected = isLight ? 'osm' : 'dark';
  }

  // Remove existing layers
  if (mapTileLayer) {
    try { siteMap.removeLayer(mapTileLayer); } catch (e) {}
    mapTileLayer = null;
  }
  if (mapTileLayerRef) {
    try { siteMap.removeLayer(mapTileLayerRef); } catch (e) {}
    mapTileLayerRef = null;
  }

  const cartoKey = (localStorage.getItem('cjhelper_carto_api_key') || '').trim();

  if (selected === 'satellite') {
    mapTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
      crossOrigin: true
    }).addTo(siteMap);
  } else if (selected === 'osm') {
    mapTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      crossOrigin: true
    }).addTo(siteMap);
  } else if (selected === 'carto' && cartoKey) {
    const sub = isLight ? 'light_all' : 'dark_all';
    mapTileLayer = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${sub}/{z}/{x}/{y}{r}.png?key=${cartoKey}`, {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
      crossOrigin: true
    }).addTo(siteMap);
  } else {
    // Default Clean Dark Map (Esri Canvas Dark Gray + Reference, NO WATERMARK & NO API KEY NEEDED!)
    mapTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; OpenStreetMap contributors',
      maxNativeZoom: 16,
      maxZoom: 19,
      crossOrigin: true
    }).addTo(siteMap);

    mapTileLayerRef = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
      maxNativeZoom: 16,
      maxZoom: 19,
      crossOrigin: true
    }).addTo(siteMap);
  }
}

function initMap() {
  if (siteMap) return;
  siteMap = L.map('map-container').setView([-6.98, 110.42], 8); // Default Central Java
  applyMapTiles();

  // Bind Tile Selector & Key Button
  const selMapTileType = document.getElementById('sel-map-tile-type');
  const btnMapCartoKey = document.getElementById('btn-map-carto-key');

  if (selMapTileType) {
    selMapTileType.value = currentMapTileType;
    selMapTileType.addEventListener('change', (e) => {
      currentMapTileType = e.target.value;
      if (currentMapTileType === 'carto' && !localStorage.getItem('cjhelper_carto_api_key')) {
        if (btnMapCartoKey) btnMapCartoKey.click();
        return;
      }
      localStorage.setItem('cjhelper_map_tile_type', currentMapTileType);
      applyMapTiles();
    });
  }

  if (btnMapCartoKey) {
    btnMapCartoKey.addEventListener('click', () => {
      const curr = localStorage.getItem('cjhelper_carto_api_key') || '';
      const key = prompt("Masukkan CARTO Basemaps API Key Anda (gratis di carto.com/basemaps/apikey):\nKosongkan jika ingin memakai Dark Map bawaan (Esri) tanpa API Key.", curr);
      if (key !== null) {
        if (key.trim()) {
          localStorage.setItem('cjhelper_carto_api_key', key.trim());
          currentMapTileType = 'carto';
          if (selMapTileType) selMapTileType.value = 'carto';
        } else {
          localStorage.removeItem('cjhelper_carto_api_key');
          if (currentMapTileType === 'carto') {
            currentMapTileType = 'auto';
            if (selMapTileType) selMapTileType.value = 'auto';
          }
        }
        localStorage.setItem('cjhelper_map_tile_type', currentMapTileType);
        applyMapTiles();
      }
    });
  }
}

function updateMapTheme(isLight) {
  if (siteMap) {
    applyMapTiles();
  }
}

document.querySelector('[data-target="tab-maps"]').addEventListener('click', () => {
  setTimeout(() => {
    initMap();
    if (siteMap) siteMap.invalidateSize();
  }, 100);
});

document.getElementById('btn-map-clear').addEventListener('click', () => {
  if (!siteMap) return;
  mapMarkers.forEach(m => siteMap.removeLayer(m));
  mapMarkers = [];
});

document.getElementById('btn-map-plot-down').addEventListener('click', async () => {
  try {
    const oldText = document.getElementById('btn-map-plot-down').textContent;
    document.getElementById('btn-map-plot-down').textContent = "Memuat data...";

    const sites = await invoke('get_down_sites_coords');
    if (!sites || sites.length === 0) {
      alert("Tidak ada site DOWN atau koordinat tidak ditemukan di Database.");
      document.getElementById('btn-map-plot-down').textContent = oldText;
      return;
    }

    initMap();
    document.getElementById('btn-map-clear').click();

    const bounds = L.latLngBounds();

    sites.forEach(s => {
      const isFully = s.impact && s.impact.toLowerCase().includes('fully');
      const isBcch = s.remark && s.remark.toUpperCase().includes('BCCH');

      let typeLabel = "CELLS DOWN";
      let color = '#eab308'; // yellow

      if (isFully) {
        typeLabel = "SITE DOWN";
        color = '#ef4444'; // red
      } else if (isBcch) {
        color = '#f97316'; // orange for BCCH
      }

      const markerHtml = `
        <div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>
      `;

      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: markerHtml,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const m = L.marker([s.lat, s.lon], { icon }).addTo(siteMap);

      const safeSiteName = (s.site_name || '').replace(/'/g, "\\'");
      m.bindPopup(`
        <div style="color: #333; font-family: Inter, sans-serif; min-width: 200px;">
          <h3 style="margin: 0 0 5px 0; color: ${color};">${s.site_id}</h3>
          <strong>${s.site_name}</strong><br/>
          <span style="display: inline-block; padding: 2px 6px; margin: 4px 0; background-color: ${color}; color: white; border-radius: 4px; font-weight: bold; font-size: 11px;">${typeLabel}</span><br/>
          Cluster: ${s.cluster}<br/>
          RTS: ${s.rts}<br/>
          Sejak: ${s.start_time}<br/>
          <hr style="margin: 5px 0;" />
          <em style="font-size: 12px;">${s.remark || 'No remark'}</em>
          <div style="margin-top: 8px;">
            <button class="tbtn-p" style="width:100%;font-size:11px;padding:4px 8px;cursor:pointer;border:none;border-radius:4px;background:var(--accent);color:white;font-weight:600;" onclick="window.openStreetViewPopup(${s.lat}, ${s.lon}, '${s.site_id} - ${safeSiteName}')">Street View</button>
          </div>
        </div>
      `);

      mapMarkers.push(m);
      bounds.extend([s.lat, s.lon]);
    });

    if (mapMarkers.length > 0) {
      siteMap.fitBounds(bounds, { padding: [50, 50] });
    }

    document.getElementById('btn-map-plot-down').textContent = oldText;
  } catch (err) {
    console.error(err);
    alert("Gagal plot map: " + err);
    document.getElementById('btn-map-plot-down').textContent = "Plot DOWN Sites";
  }
});


// Formatting Logic
const defaultFmt = {
  msgLine: "{icon} {type} {cluster} {sitename} {time}",
  msgRemark: "{remark}",
  msgHdr: "{cluster} {pic} {rts}",

  msgLineBc: "{icon} {rts} / {cluster} /  {new}  / {sitename} / {category} / {time}",
  msgRemarkBc: " / {remark}",
  msgHdrBc: "*SITE FULLY DOWN {region}  {date} {jam}*\n*TOTAL SITEDOWN : {total_sd}*",

  iconDown: "▶️",
  lblSd: "*SITE DOWN :*",
  lblCd: "*CELLS DOWN :*",
  lblBcch: "*CELL DOWN BCCH Missing NOKIA :*",
  keyBcch: "BCCH",
  spacing: false,

  lblSdBc: "SITE DOWN",
  lblCdBc: "CELLS DOWN",
  section_bcch: "CELL DOWN BCCH Missing NOKIA"
};



// WA Management Logic
let waGroups = [];
let savedWaGroups = [];
let selectedGroupIds = new Set();
let broadcastLogs = [];

async function loadWaConfig() {
  try {
    const cfg = await invoke('get_wa_config');
    savedWaGroups = cfg.saved_groups || [];
    selectedGroupIds = new Set(savedWaGroups.map(g => g.group_id));
  } catch (e) {
    console.warn("WA Config not loaded", e);
  }
}

function renderWaGroups(filter = "") {
  const tbody = document.getElementById('wa-groups-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let visible = 0;
  waGroups.filter(g => !filter || g.name.toLowerCase().includes(filter.toLowerCase())).forEach(g => {
    visible++;
    const tr = document.createElement('tr');
    const isChecked = selectedGroupIds.has(g.id);

    tr.innerHTML = `
      <td class="text-center" style="width: 50px;">
        <input type="checkbox" class="wa-grp-chk checkbox" data-id="${g.id}" data-name="${g.name}" ${isChecked ? 'checked' : ''}>
      </td>
      <td class="${isChecked ? 'text-success' : 'text-subtle'} font-bold">${g.name}</td>
    `;

    const chk = tr.querySelector('input');
    const toggleCheck = (checked) => {
      chk.checked = checked;
      const td = tr.querySelector('td:nth-child(2)');
      if (checked) {
        selectedGroupIds.add(g.id);
        td.classList.replace('text-subtle', 'text-success');
      } else {
        selectedGroupIds.delete(g.id);
        td.classList.replace('text-success', 'text-subtle');
      }
      updateWaSearchCount(visible, filter);
    };

    tr.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        toggleCheck(!chk.checked);
      }
    });

    chk.addEventListener('change', (e) => {
      toggleCheck(e.target.checked);
    });

    tbody.appendChild(tr);
  });

  updateWaSearchCount(visible, filter);
}

function updateWaSearchCount(visibleCount = 0, filter = "") {
  const countEl = document.getElementById('wa-search-count');
  if (!countEl) return;
  const selCount = selectedGroupIds.size;
  countEl.textContent = filter ? `${visibleCount}/${waGroups.length} (${selCount} terpilih)` : `${selCount} terpilih`;
}

document.getElementById('btn-wa-refresh-groups').addEventListener('click', async () => {
  try {
    const btn = document.getElementById('btn-wa-refresh-groups');
    const oldT = btn.textContent;
    btn.textContent = "Memuat...";

    const status = await invoke('wa_groups');
    waGroups = status.groups || [];
    selectedGroupIds = new Set(savedWaGroups.map(g => g.group_id));
    renderWaGroups(document.getElementById('wa-group-search').value);

    btn.textContent = oldT;
  } catch (e) {
    alert("Gagal memuat grup: " + e);
    document.getElementById('btn-wa-refresh-groups').textContent = "Refresh dari WA";
  }
});

document.getElementById('wa-group-search').addEventListener('input', (e) => {
  renderWaGroups(e.target.value);
});

document.getElementById('btn-wa-clear-search').addEventListener('click', () => {
  document.getElementById('wa-group-search').value = "";
  renderWaGroups();
});

document.getElementById('btn-wa-save-groups').addEventListener('click', async () => {
  const toSave = waGroups
    .filter(g => selectedGroupIds.has(g.id))
    .map(g => ({
      group_id: g.id,
      group_name: g.name
    }));

  try {
    await invoke('save_wa_groups', { savedGroups: toSave });
    savedWaGroups = toSave;
    renderWaTargets();
    const lbl = document.getElementById('wa-groups-status');
    lbl.textContent = `✅ ${toSave.length} grup disimpan`;
    setTimeout(() => lbl.textContent = '', 3000);
  } catch (e) {
    alert("Gagal menyimpan grup: " + e);
  }
});

// Broadcast Log feature
function loadBroadcastLogs() {
  const d = new Date().toLocaleDateString('id-ID');
  document.getElementById('wa-bc-log-date').textContent = `📋 ${d}`;
  const saved = JSON.parse(localStorage.getItem('cjhelper_bc_logs') || 'null');
  if (saved && saved.date === d) {
    broadcastLogs = saved.logs;
  } else {
    broadcastLogs = [];
  }
  renderBroadcastLogs(); updateMainBroadcastLogs();
}

function addBroadcastLog(success, total, groupsArr) {
  const t = new Date().toLocaleTimeString('id-ID');
  broadcastLogs.push({ time: t, success, total, groups: groupsArr });
  localStorage.setItem('cjhelper_bc_logs', JSON.stringify({ date: new Date().toLocaleDateString('id-ID'), logs: broadcastLogs }));
  renderBroadcastLogs();
}

function renderBroadcastLogs() {
  const box = document.getElementById('wa-bc-log-box');
  if (!broadcastLogs || broadcastLogs.length === 0) {
    box.value = "Belum ada broadcast hari ini.";
  } else {
    let txt = "";
    [...broadcastLogs].reverse().forEach(l => {
      const icon = l.success === l.total ? "✅" : "⚠️";
      const groupsStr = Array.isArray(l.groups) ? l.groups.join(", ") : l.groups;
      txt += `[${l.time}]  ${icon}  ${l.success}/${l.total} berhasil  →  ${groupsStr}\n`;
    });
    box.value = txt;
  }
}

// Initial WA Config Load
loadWaConfig().then(() => { renderWaGroups(); renderWaTargets(); });
loadBroadcastLogs(); if (typeof updateMainBroadcastLogs === 'function') updateMainBroadcastLogs();

// Edit Database Logic
const dbEditInputs = {
  site_id: document.getElementById('dbe-site-id-msh'),
  lon: document.getElementById('dbe-lon'),
  site_name: document.getElementById('dbe-site-name'),
  lat: document.getElementById('dbe-lat'),
  old_site_id: document.getElementById('dbe-old-site-id'),
  tlp: document.getElementById('dbe-tlp'),
  cluster: document.getElementById('dbe-cluster'),
  site_class: document.getElementById('dbe-site-class'),
  area: document.getElementById('dbe-area'),
  hub_type: document.getElementById('dbe-hub-type'),
  fm_office: document.getElementById('dbe-fm-office'),
  address: document.getElementById('dbe-address'),
  vendor: document.getElementById('dbe-vendor'),
  host_name: document.getElementById('dbe-host-name'),

  rts_name: document.getElementById('dbe-rts-name'),
  rts_email: document.getElementById('dbe-rts-email'),
  rts_phone: document.getElementById('dbe-rts-phone'),
  rts_new: document.getElementById('dbe-rts-new'),

  te_name: document.getElementById('dbe-te-name'),
  te_phone: document.getElementById('dbe-te-phone'),
  te_email: document.getElementById('dbe-te-email'),

  cme_name: document.getElementById('dbe-cme-name'),
  cme_phone: document.getElementById('dbe-cme-phone'),
  cme_email: document.getElementById('dbe-cme-email')
};

let currentEditSiteId = null;

document.getElementById('btn-db-edit-search').addEventListener('click', async () => {
  const sid = document.getElementById('db-edit-search-inp').value.trim();
  if (!sid) return;

  try {
    const row = await invoke('lookup_site', { siteId: sid });
    if (!row) {
      document.getElementById('db-edit-search-status').textContent = "❌ Site tidak ditemukan";
      document.getElementById('db-edit-search-status').className = "text-sm text-error ml-2";
      document.getElementById('db-edit-form').classList.add('hidden');
      return;
    }

    currentEditSiteId = sid;
    document.getElementById('db-edit-search-status').textContent = "✅ Ketemu";
    document.getElementById('db-edit-search-status').className = "text-sm text-success ml-2";

    // Fill values based on loose matching like in lookup_site
    dbEditInputs.site_id.value = getDbVal(row, ['SITE', 'ID', 'MSH']) !== '—' ? getDbVal(row, ['SITE', 'ID', 'MSH']) : sid;
    dbEditInputs.site_name.value = getDbVal(row, ['SITE', 'NAME']) !== '—' ? getDbVal(row, ['SITE', 'NAME']) : '';
    dbEditInputs.old_site_id.value = getDbVal(row, ['OLD', 'SITE']) !== '—' ? getDbVal(row, ['OLD', 'SITE']) : '';
    dbEditInputs.cluster.value = getDbVal(row, ['CLUSTER']) !== '—' ? getDbVal(row, ['CLUSTER']) : '';
    dbEditInputs.area.value = getDbVal(row, ['AREA']) !== '—' ? getDbVal(row, ['AREA']) : '';
    dbEditInputs.rts_name.value = getDbVal(row, ['RTS', 'NAME']) !== '—' ? getDbVal(row, ['RTS', 'NAME']) : '';
    dbEditInputs.rts_new.value = getDbVal(row, ['RTS', 'NEW']) !== '—' ? getDbVal(row, ['RTS', 'NEW']) : '';
    dbEditInputs.lat.value = getDbVal(row, ['LAT']) !== '—' ? getDbVal(row, ['LAT']) : '';
    dbEditInputs.lon.value = getDbVal(row, ['LONG']) !== '—' ? getDbVal(row, ['LONG']) : '';

    dbEditInputs.tlp.value = getDbVal(row, ['TLP']) !== '—' ? getDbVal(row, ['TLP']) : '';
    dbEditInputs.site_class.value = getDbVal(row, ['SITE', 'CLASS']) !== '—' ? getDbVal(row, ['SITE', 'CLASS']) : '';
    dbEditInputs.hub_type.value = getDbVal(row, ['HUB', 'TYPE']) !== '—' ? getDbVal(row, ['HUB', 'TYPE']) : '';
    dbEditInputs.fm_office.value = getDbVal(row, ['FM', 'OFFICE']) !== '—' ? getDbVal(row, ['FM', 'OFFICE']) : '';
    dbEditInputs.address.value = getDbVal(row, ['ADDRESS']) !== '—' ? getDbVal(row, ['ADDRESS']) : '';
    dbEditInputs.vendor.value = getDbVal(row, ['VENDOR']) !== '—' ? getDbVal(row, ['VENDOR']) : '';
    dbEditInputs.host_name.value = getDbVal(row, ['HOST', 'NAME']) !== '—' ? getDbVal(row, ['HOST', 'NAME']) : '';

    dbEditInputs.rts_email.value = getDbVal(row, ['RTS', 'EMAIL']) !== '—' ? getDbVal(row, ['RTS', 'EMAIL']) : '';
    dbEditInputs.rts_phone.value = getDbVal(row, ['RTS', 'PHONE']) !== '—' ? getDbVal(row, ['RTS', 'PHONE']) : '';

    dbEditInputs.te_name.value = getDbVal(row, ['TE', 'NAME']) !== '—' ? getDbVal(row, ['TE', 'NAME']) : '';
    dbEditInputs.te_phone.value = getDbVal(row, ['TE', 'PHONE']) !== '—' ? getDbVal(row, ['TE', 'PHONE']) : '';
    dbEditInputs.te_email.value = getDbVal(row, ['TE', 'EMAIL']) !== '—' ? getDbVal(row, ['TE', 'EMAIL']) : '';

    dbEditInputs.cme_name.value = getDbVal(row, ['CME', 'NAME']) !== '—' ? getDbVal(row, ['CME', 'NAME']) : '';
    dbEditInputs.cme_phone.value = getDbVal(row, ['CME', 'PHONE']) !== '—' ? getDbVal(row, ['CME', 'PHONE']) : '';
    dbEditInputs.cme_email.value = getDbVal(row, ['CME', 'EMAIL']) !== '—' ? getDbVal(row, ['CME', 'EMAIL']) : '';

    document.getElementById('db-edit-form').classList.remove('hidden');
    document.getElementById('db-edit-form').classList.add('flex');
  } catch (e) {
    document.getElementById('db-edit-search-status').textContent = "❌ Error: " + e;
    document.getElementById('db-edit-search-status').className = "text-sm text-error ml-2";
  }
});

document.getElementById('btn-db-edit-clear').addEventListener('click', () => {
  document.getElementById('db-edit-search-inp').value = "";
  document.getElementById('db-edit-form').classList.add('hidden');
  document.getElementById('db-edit-search-status').textContent = "";
  currentEditSiteId = null;
});

document.getElementById('btn-db-edit-save').addEventListener('click', async () => {
  if (!currentEditSiteId) return;

  const editData = {
    site_id: currentEditSiteId,
    site_name: dbEditInputs.site_name.value,
    old_site_id: dbEditInputs.old_site_id.value,
    cluster: dbEditInputs.cluster.value,
    area: dbEditInputs.area.value,
    rts_name: dbEditInputs.rts_name.value,
    rts_new: dbEditInputs.rts_new.value,
    lat: dbEditInputs.lat.value,
    lon: dbEditInputs.lon.value,

    tlp: dbEditInputs.tlp.value,
    site_class: dbEditInputs.site_class.value,
    hub_type: dbEditInputs.hub_type.value,
    fm_office: dbEditInputs.fm_office.value,
    address: dbEditInputs.address.value,
    vendor: dbEditInputs.vendor.value,
    host_name: dbEditInputs.host_name.value,

    rts_email: dbEditInputs.rts_email.value,
    rts_phone: dbEditInputs.rts_phone.value,

    te_name: dbEditInputs.te_name.value,
    te_phone: dbEditInputs.te_phone.value,
    te_email: dbEditInputs.te_email.value,

    cme_name: dbEditInputs.cme_name.value,
    cme_phone: dbEditInputs.cme_phone.value,
    cme_email: dbEditInputs.cme_email.value
  };

  try {
    await invoke('update_site_db', { editData });
    syncTeContactFromSite(editData);
    if (typeof SiteChangesManager !== 'undefined') {
      SiteChangesManager.recordSiteEdit(editData.site_id, editData);
    }
    const btn = document.getElementById('btn-db-edit-save');
    const oldT = btn.textContent;
    btn.textContent = "✅ Tersimpan di Memory!";
    btn.classList.replace('btn-primary', 'btn-success');
    document.getElementById('db-edit-status-header').textContent = "⚠️ Belum Diekspor ke Excel";
    setTimeout(() => {
      btn.textContent = oldT;
      btn.classList.replace('btn-success', 'btn-primary');
    }, 2000);
  } catch (e) {
    alert("Gagal update DB: " + e);
  }
});

document.getElementById('btn-db-export').addEventListener('click', async () => {
  try {
    const btn = document.getElementById('btn-db-export');
    const oldT = btn.textContent;
    btn.textContent = "Menyimpan...";
    const res = await invoke('export_db');
    alert(res);
    btn.textContent = oldT;
    document.getElementById('db-edit-status-header').textContent = "✅ Excel Diekspor";
  } catch (e) {
    alert("Gagal export DB: " + e);
    document.getElementById('btn-db-export').textContent = "Export DB (Save As)";
  }
});

// ==========================================
// PM (MESSAGES) TAB LOGIC
// ==========================================
const pmTbody = document.getElementById('pm-tbody');
const pmPreview = document.getElementById('pm-preview-text');

let pmDataGroups = [];
let pmMode = 'cluster';
let pmShowRemark = true;
let pmLastSelectedIndex = -1;
let pmCollapsedSet = new Set();

// --- FORMATTING LOGIC ---
const defaultFmtMsg = {
  msg_line: "{icon} {type} / {cluster} | {sitename} | {old} | {new} | {category} | {time}",
  msg_remark: "    ↳ {remark}",
  msg_hdr: "{cluster}  |  RTS: {rts}",
  lbl_sd: "SITE DOWN :",
  lbl_cd: "CELLS DOWN :",
  lbl_bcch: "CELL DOWN BCCH Missing NOKIA :",
  key_bcch: "BCCH",
  icon_down: "▶️",
  spacing: false
};

const defaultFmtBc = {
  msg_line: "{icon} {rts} / {cluster} /  {new}  / {sitename} / {category} / {time}",
  msg_remark: " / {remark}",
  msg_hdr: "*SITE FULLY DOWN {region}  {date} {jam}*\n*TOTAL SITEDOWN : {total_sd}*",
  lbl_sd: "SITE DOWN :",
  lbl_cd: "CELLS DOWN :",
  lbl_bcch: "CELL DOWN BCCH Missing NOKIA :",
  key_bcch: "BCCH",
  icon_down: "▶️",
  spacing: false
};

let fmtMsg = defaultFmtMsg;
try {
  const saved = localStorage.getItem('fmtMsg');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.msgLine && !parsed.msg_line) parsed.msg_line = parsed.msgLine;
    if (parsed.msgRemark && !parsed.msg_remark) parsed.msg_remark = parsed.msgRemark;
    if (parsed.msgHdr && !parsed.msg_hdr) parsed.msg_hdr = parsed.msgHdr;
    if (parsed.iconDown && !parsed.icon_down) parsed.icon_down = parsed.iconDown;
    if (parsed.lblSd && !parsed.lbl_sd) parsed.lbl_sd = parsed.lblSd;
    if (parsed.lblCd && !parsed.lbl_cd) parsed.lbl_cd = parsed.lblCd;
    if (parsed.lblBcch && !parsed.lbl_bcch) parsed.lbl_bcch = parsed.lblBcch;
    if (parsed.keyBcch && !parsed.key_bcch) parsed.key_bcch = parsed.keyBcch;

    fmtMsg = Object.assign({}, defaultFmtMsg, parsed);
  }
} catch (e) {
  console.warn("Failed to parse fmtMsg from localStorage", e);
}

let fmtBc = defaultFmtBc;
try {
  const saved = localStorage.getItem('fmtBc');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.msgLineBc && !parsed.msg_line) parsed.msg_line = parsed.msgLineBc;
    if (parsed.msgRemarkBc && !parsed.msg_remark) parsed.msg_remark = parsed.msgRemarkBc;
    if (parsed.msgHdrBc && !parsed.msg_hdr) parsed.msg_hdr = parsed.msgHdrBc;
    if (parsed.iconDown && !parsed.icon_down) parsed.icon_down = parsed.iconDown;
    if (parsed.lblSdBc && !parsed.lbl_sd) parsed.lbl_sd = parsed.lblSdBc;
    if (parsed.lblCdBc && !parsed.lbl_cd) parsed.lbl_cd = parsed.lblCdBc;
    if (parsed.section_bcch && !parsed.lbl_bcch) parsed.lbl_bcch = parsed.section_bcch;
    if (parsed.keyBcch && !parsed.key_bcch) parsed.key_bcch = parsed.keyBcch;

    fmtBc = Object.assign({}, defaultFmtBc, parsed);
  }
} catch (e) {
  console.warn("Failed to parse fmtBc from localStorage", e);
}

let currentFmtMode = 'msg'; // 'msg' or 'bc'

function getActiveFmt() {
  return currentFmtMode === 'msg' ? fmtMsg : fmtBc;
}

function loadFmtToUI() {
  const f = getActiveFmt();
  document.getElementById('fmt-msg-line').value = f.msg_line;
  document.getElementById('fmt-msg-remark').value = f.msg_remark;
  document.getElementById('fmt-msg-hdr').value = f.msg_hdr;
  document.getElementById('fmt-lbl-sd').value = f.lbl_sd;
  document.getElementById('fmt-lbl-cd').value = f.lbl_cd;
  document.getElementById('fmt-lbl-bcch').value = f.lbl_bcch;
  document.getElementById('fmt-key-bcch').value = f.key_bcch;
  document.getElementById('fmt-icon-down').value = f.icon_down;
  document.getElementById('fmt-spacing-chk').checked = f.spacing;

  // Update hints based on mode
  const hdrHint = document.querySelector('#fmt-msg-hdr + .fh');
  if (hdrHint) {
    hdrHint.textContent = currentFmtMode === 'msg' ? '{cluster} {pic} {rts}' : '{region} {date} {jam} {total_sd} {total_cd}';
  }
  const lineHint = document.querySelector('#fmt-msg-line + .fh');
  if (lineHint) {
    lineHint.textContent = currentFmtMode === 'msg' ? '{icon} {type} {cluster} {sitename} {time} {old} {new} {category}' : '{icon} {rts} {cluster} {new} {sitename} {category} {time}';
  }

  document.getElementById('fmt-tab-msg').classList.toggle('active', currentFmtMode === 'msg');
  document.getElementById('fmt-tab-bc').classList.toggle('active', currentFmtMode === 'bc');

  updateFmtPreview();
}

function saveFmtFromUI() {
  const f = getActiveFmt();
  f.msg_line = document.getElementById('fmt-msg-line').value;
  f.msg_remark = document.getElementById('fmt-msg-remark').value;
  f.msg_hdr = document.getElementById('fmt-msg-hdr').value;
  f.lbl_sd = document.getElementById('fmt-lbl-sd').value;
  f.lbl_cd = document.getElementById('fmt-lbl-cd').value;
  f.lbl_bcch = document.getElementById('fmt-lbl-bcch').value;
  f.key_bcch = document.getElementById('fmt-key-bcch').value;
  f.icon_down = document.getElementById('fmt-icon-down').value;
  f.spacing = document.getElementById('fmt-spacing-chk').checked;

  if (currentFmtMode === 'msg') localStorage.setItem('fmtMsg', JSON.stringify(f));
  else localStorage.setItem('fmtBc', JSON.stringify(f));

  // Auto re-render PM Tab so it reflects instantly if they switch back!
  if (currentFmtMode === 'msg') renderPM();
}

document.getElementById('fmt-tab-msg')?.addEventListener('click', () => { currentFmtMode = 'msg'; loadFmtToUI(); });
document.getElementById('fmt-tab-bc')?.addEventListener('click', () => { currentFmtMode = 'bc'; loadFmtToUI(); });

document.getElementById('btn-fmt-save')?.addEventListener('click', () => {
  saveFmtFromUI();
  updateFmtPreview();
});

document.getElementById('btn-fmt-reset')?.addEventListener('click', () => {
  if (!confirm('Kembalikan ke setting default?')) return;
  if (currentFmtMode === 'msg') localStorage.removeItem('fmtMsg');
  else localStorage.removeItem('fmtBc');
  location.reload();
});

function formatSingleLine(s, fmtObj, showRemarkOverride) {
  const isFully = s.is_netdrone || (s.impact && (s.impact.toLowerCase().includes('fully') || s.impact.toLowerCase().includes('sitedown')));
  const typeRaw = isFully ? "SITE DOWN" : "CELLS DOWN";
  const combined = (s.category + " " + s.impact).toUpperCase().replace(/[-_\s]+/g, ' ');
  const isHub = combined.includes('HUB') && (combined.includes('MEDIUM') || combined.includes('BIG'));
  const isCritical = s.site_class.toUpperCase().includes('CRITICAL');

  // Always use custom icon from formatting unless it's critical/hub
  let iconChar = (isHub || isCritical) ? "⚠️ " : (fmtObj.icon_down + " ");

  let timeStr = s.start_time;
  if (s.start_timestamp > 0) {
    const d = new Date(s.start_timestamp * 1000);
    timeStr = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()} | ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }

  const ctx = { icon: iconChar.trim(), type: typeRaw, cluster: s.cluster, sitename: s.site_name, old: s.old_site, new: s.new_site, time: timeStr, remark: s.remark, category: s.category, rts: s.rts, pic: s.pic, te: s.pic };

  let line = fmtObj.msg_line.replace(/\{(\w+)\}/g, (_, k) => ctx[k] || "");

  const showRem = showRemarkOverride !== undefined ? showRemarkOverride : true;
  if (showRem && fmtObj.msg_remark.trim() && s.remark.trim()) {
    line += "\n" + fmtObj.msg_remark.replace(/\{(\w+)\}/g, (_, k) => ctx[k] || "");
  }

  const isBcch = s.remark.toUpperCase().includes(fmtObj.key_bcch);
  const typeIcon = (isHub || isCritical) ? (isFully ? "⚠️ SITEDOWN" : "⚠️ CELLDOWN") : (isFully ? "▶ SITEDOWN" : "▶ CELLDOWN");
  return { waLine: line, typeRaw, typeIcon, isFully, isBcch, time: timeStr };
}

function generateGroupText(g, useBcFormat = false) {
  const f = useBcFormat ? fmtBc : fmtMsg;
  const ctx = { cluster: g.cluster, rts: g.rts, pic: g.pic, te: g.pic };
  let headerStr = f.msg_hdr.replace(/\{(\w+)\}/g, (_, k) => ctx[k] || "");
  if (pmMode === 'rts' && !useBcFormat) {
    const n_cl = g.cluster ? g.cluster.split(', ').length : 0;
    const n_sd = g.fully.length;
    const n_cd = g.cell.length;
    headerStr = `RTS : ${g.rts} (${n_cl} cluster: ${g.cluster}) | SD: ${n_sd} | CD: ${n_cd}`;
  }

  let lines = [headerStr, ""];

  const spacer = f.spacing ? "\n" : "";

  if (g.fully.length > 0) {
    lines.push(f.lbl_sd);
    g.fully.forEach(i => { lines.push(i.waLine); if (spacer) lines.push(""); });
    if (!spacer) lines.push("");
  }
  if (g.cell.length > 0) {
    lines.push(f.lbl_cd);
    g.cell.forEach(i => { lines.push(i.waLine); if (spacer) lines.push(""); });
    if (!spacer) lines.push("");
  }
  if (g.cellBcch.length > 0) {
    lines.push(f.lbl_bcch);
    g.cellBcch.forEach(i => { lines.push(i.waLine); if (spacer) lines.push(""); });
    if (!spacer) lines.push("");
  }

  return lines.join("\n").trim();
}

function updateFmtPreview() {
  const f = getActiveFmt();
  const box = document.getElementById('fmt-preview-box');
  if (!box) return;

  const dummyGroup = {
    cluster: "Kendal Selatan", rts: "KALIPUTIH_MT", pic: "PIC_NAME",
    fully: [
      formatSingleLine({ impact: "fully", category: "BIG HUB SITE", site_class: "STANDARD", start_time: "23:00", cluster: "Kendal Selatan", site_name: "14KND045", old_site: "14KND0091", new_site: "14KND0091", remark: "priority 14KND0029", rts: "KALIPUTIH_MT", pic: "PIC_NAME" }, f)
    ],
    cell: [
      formatSingleLine({ impact: "cell", category: "STANDARD", site_class: "STANDARD", start_time: "21:00", cluster: "Semarang Barat", site_name: "11SMG011", old_site: "11SMG0031", new_site: "11SMG0031", remark: "team otw eta 60 menit", rts: "KALIPUTIH_MT", pic: "PIC_NAME" }, f)
    ],
    cellBcch: [
      formatSingleLine({ impact: "cell", category: "STANDARD", site_class: "STANDARD", start_time: "20:00", cluster: "Semarang Barat", site_name: "11SMG012", old_site: "11SMG0032", new_site: "11SMG0032", remark: "BCCH Missing", rts: "KALIPUTIH_MT", pic: "PIC_NAME" }, f)
    ]
  };

  box.value = generateGroupText(dummyGroup, currentFmtMode === 'bc');
}

// Ensure formatting UI is initialized
setTimeout(loadFmtToUI, 500);
// --- END FORMATTING LOGIC ---


function processPMData() {
  const clFilter = document.getElementById('pm-f-cl').value.toLowerCase();
  const nsFilter = document.getElementById('pm-f-ns').value.toLowerCase();
  const remFilter = document.getElementById('pm-f-rem').value.toLowerCase();

  let downSites = statusData.filter(s => s.status === 'DOWN');

  if (typeof netdroneData !== 'undefined' && netdroneData && netdroneData.length > 0) {
    netdroneData.filter(d => !d.skipped && d.matchedDb).forEach(nr => {
      const siteObj = {
        status: 'DOWN',
        impact: 'Full Sitedown',
        new_site: nr.siteId,
        old_site: "",
        site_name: nr.siteName,
        cluster: nr.cluster || 'UNKNOWN',
        pic: nr.pic || "",
        rts: nr.rts || "",
        start_time: nr.startTime || "",
        agging: "",
        remark: nr.remark || "",
        category: nr.category || "",
        site_class: nr.siteClass || "",
        vendor: nr.vendor || "",
        te_phone: nr.tePhone || "",
        is_netdrone: true
      };
      if (typeof activeRegionFilter === 'undefined' || activeRegionFilter === 'ALL' || getSiteRegion(siteObj) === activeRegionFilter) {
        downSites.push(siteObj);
      }
    });
  }

  let rawMap = {};

  if (pmMode === 'cluster') {
    downSites.forEach(s => {
      const rawPic = (s.pic || s.te_name || "").trim();
      const isUntitled = !rawPic || rawPic === "—" || rawPic === "-" || rawPic === "0" || rawPic.toLowerCase() === "nan" || rawPic.toLowerCase().includes("untitled") || rawPic.toLowerCase() === "unknown te" || rawPic.toLowerCase() === "te unknown" || rawPic.toLowerCase() === "null";
      const pic = isUntitled ? `TE UNKNOWN (${s.cluster || 'UNKNOWN'})` : rawPic;
      const key = pic;

      if (!rawMap[key]) {
        rawMap[key] = {
          pic: pic,
          te: pic,
          rts: s.rts || "",
          clusters: new Set(),
          entries: []
        };
      }

      if (s.cluster) rawMap[key].clusters.add(s.cluster);
      const fmt = formatSingleLine(s, fmtMsg, pmShowRemark);
      rawMap[key].entries.push({ ...s, ...fmt });

      if (!rawMap[key].rts && s.rts) rawMap[key].rts = s.rts;
    });

    for (let k in rawMap) {
      const sortedCls = Array.from(rawMap[k].clusters).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      rawMap[k].cluster = sortedCls.join(", ") || "UNKNOWN";
    }
  } else {
    downSites.forEach(s => {
      const rts = s.rts || "(Tanpa RTS)";
      const pic = s.pic || "";
      const key = rts;

      if (!rawMap[key]) {
        rawMap[key] = {
          rts,
          pic: pic,
          te: pic,
          cluster: "",
          clusters: new Set(),
          entries: []
        };
      }

      if (!rawMap[key].pic && pic) {
        rawMap[key].pic = pic;
        rawMap[key].te = pic;
      }

      rawMap[key].clusters.add(s.cluster);
      const fmt = formatSingleLine(s, fmtMsg, pmShowRemark);
      rawMap[key].entries.push({ ...s, ...fmt });
    });
    for (let k in rawMap) {
      const sortedCls = Array.from(rawMap[k].clusters).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      rawMap[k].cluster = sortedCls.join(", ");
    }
  }

  pmDataGroups = [];
  for (let key in rawMap) {
    const g = rawMap[key];
    if (clFilter && !g.cluster.toLowerCase().includes(clFilter)) continue;
    let entries = g.entries;
    if (nsFilter || remFilter) {
      entries = entries.filter(e => {
        if (nsFilter && !e.new_site.toLowerCase().includes(nsFilter)) return false;
        if (remFilter && !e.remark.toLowerCase().includes(remFilter)) return false;
        return true;
      });
      if (entries.length === 0) continue;
    }
    const fully = entries.filter(e => e.isFully);
    const cellBcch = entries.filter(e => !e.isFully && e.isBcch);
    const cell = entries.filter(e => !e.isFully && !e.isBcch);
    const hdr = pmMode === 'cluster'
      ? (g.pic ? `${g.cluster}  |  ${g.pic}  |  RTS: ${g.rts}` : `${g.cluster}  |  RTS: ${g.rts}`)
      : `RTS: ${g.rts}`;

    pmDataGroups.push({
      key,
      cluster: g.cluster,
      pic: g.pic,
      te: g.pic,
      rts: g.rts || "",
      header: hdr,
      fully,
      cell,
      cellBcch,
      allEntries: [...fully, ...cell, ...cellBcch]
    });
  }
  pmDataGroups.sort((a, b) => a.header.localeCompare(b.header));
}


function renderPM() {
  if (!pmTbody) return;
  processPMData();
  document.getElementById('pm-total-lbl').textContent = `Total: ${pmDataGroups.length} ${pmMode === 'cluster' ? 'CLUSTER' : 'RTS'}`;
  pmTbody.innerHTML = '';
  pmLastSelectedIndex = -1;

  pmDataGroups.forEach((g, gIdx) => {
    const isCollapsed = pmCollapsedSet.has(g.key);
    const trH = document.createElement('tr');
    trH.className = 'group-header';
    trH.dataset.gkey = g.key;
    trH.dataset.gidx = gIdx;
    trH.dataset.groupMsg = 'true';

    // Separate arrow cell (for collapse/expand) from header text (for select/copy)
    const arrowTd = document.createElement('td');
    arrowTd.style.width = '30px';
    arrowTd.style.cursor = 'pointer';
    arrowTd.style.textAlign = 'center';
    arrowTd.style.userSelect = 'none';
    arrowTd.textContent = isCollapsed ? '▶' : '▼';
    arrowTd.title = isCollapsed ? 'Expand' : 'Collapse';

    // Arrow click → toggle collapse/expand only
    arrowTd.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isCollapsed) pmCollapsedSet.delete(g.key); else pmCollapsedSet.add(g.key);
      renderPM();
    });

    const headerTd = document.createElement('td');
    headerTd.colSpan = 7;
    headerTd.textContent = `GROUP  ${g.header}  (${g.allEntries.length} sites)`;
    headerTd.style.cursor = 'pointer';

    trH.appendChild(arrowTd);
    trH.appendChild(headerTd);

    // Header text click → select header + show full group preview (for copying)
    trH.addEventListener('click', (e) => {
      if (e.target === arrowTd) return; // already handled
      e.stopPropagation();
      // Select this header
      const allDataRows = Array.from(pmTbody.querySelectorAll('tr:not(.group-header)'));
      if (!e.ctrlKey && !e.shiftKey) {
        allDataRows.forEach(r => r.classList.remove('selected'));
        pmTbody.querySelectorAll('.group-header').forEach(h => h.classList.remove('selected'));
      }
      trH.classList.toggle('selected');
      pmPreview.value = generateGroupText(g, false);
    });
    pmTbody.appendChild(trH);

    if (!isCollapsed) {
      const allItems = [...g.fully, ...g.cell, ...g.cellBcch];
      allItems.forEach((item) => {
        const tr = document.createElement('tr');
        tr.dataset.waLine = item.waLine;
        tr.dataset.gidx = gIdx;
        tr.style.cursor = 'pointer';
        const typeBadgeClass = item.isFully ? 'br' : (item.isBcch ? 'ba' : 'bb');
        tr.innerHTML = `
          <td><span class="badge ${typeBadgeClass}">${item.typeIcon}</span></td>
          <td>${item.cluster}</td>
          <td>${item.pic || ""}</td>
          <td>${item.site_name}</td>
          <td>${item.old_site || ""}</td>
          <td>${item.new_site}</td>
          <td>${item.time}</td>
          <td>${item.remark}</td>
        `;

        tr.addEventListener('click', (e) => {
          e.stopPropagation();
          const allDataRows = Array.from(pmTbody.querySelectorAll('tr:not(.group-header)'));
          const thisIdx = allDataRows.indexOf(tr);

          if (e.shiftKey && pmLastSelectedIndex !== -1) {
            const start = Math.min(pmLastSelectedIndex, thisIdx);
            const end = Math.max(pmLastSelectedIndex, thisIdx);
            allDataRows.forEach((r, i) => { if (i >= start && i <= end) r.classList.add('selected'); });
            document.getSelection().removeAllRanges();
          } else if (e.ctrlKey) {
            tr.classList.toggle('selected');
            pmLastSelectedIndex = thisIdx;
          } else {
            allDataRows.forEach(r => r.classList.remove('selected'));
            pmTbody.querySelectorAll('.group-header').forEach(h => h.classList.remove('selected'));
            tr.classList.add('selected');
            pmLastSelectedIndex = thisIdx;
          }
          pmPreview.value = item.waLine;
        });
        pmTbody.appendChild(tr);
      });
    }
  });
}

function getSelectedPMLines() {
  const selected = Array.from(pmTbody.querySelectorAll('tr.selected'));
  const lines = [];
  selected.forEach(tr => {
    if (tr.classList.contains('group-header')) {
      const gIdx = parseInt(tr.dataset.gidx);
      if (pmDataGroups[gIdx]) lines.push(generateGroupText(pmDataGroups[gIdx]));
    } else {
      lines.push(tr.dataset.waLine);
    }
  });
  return lines;
}

function flashPMCopy(msg) {
  const lbl = document.getElementById('pm-total-lbl');
  if (!lbl) return;
  const orig = lbl.textContent;
  lbl.textContent = msg;
  setTimeout(() => lbl.textContent = orig, 2000);
}

// Mode segmented control
document.querySelectorAll('#pm-mode-seg .seg-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('#pm-mode-seg .seg-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    pmMode = e.target.dataset.val;
    pmCollapsedSet.clear();
    renderPM();
  });
});

['pm-f-cl', 'pm-f-ns', 'pm-f-rem'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', renderPM);
});

const bReset = document.getElementById('btn-pm-reset');
if (bReset) {
  bReset.addEventListener('click', () => {
    ['pm-f-cl', 'pm-f-ns', 'pm-f-rem'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    renderPM();
  });
}

const bCollapse = document.getElementById('btn-pm-collapse');
if (bCollapse) {
  bCollapse.addEventListener('click', () => {
    pmDataGroups.forEach(g => pmCollapsedSet.add(g.key));
    renderPM();
  });
}

const bExpand = document.getElementById('btn-pm-expand');
if (bExpand) {
  bExpand.addEventListener('click', () => {
    pmCollapsedSet.clear();
    renderPM();
  });
}

const bRemark = document.getElementById('btn-pm-remark');
if (bRemark) {
  bRemark.addEventListener('click', (e) => {
    pmShowRemark = !pmShowRemark;
    e.target.textContent = `Remark: ${pmShowRemark ? 'ON' : 'OFF'}`;
    e.target.className = "tbtn";
    e.target.style.marginLeft = "auto";
    e.target.style.fontWeight = "bold";
    e.target.style.color = pmShowRemark ? "var(--accent-lit)" : "var(--txt-3)";
    renderPM();
  });
}

// Ctrl+C keyboard shortcut
document.addEventListener('keydown', (e) => {
  const pmTab = document.getElementById('tab-pm');
  if (pmTab && pmTab.classList.contains('hidden')) return;
  if (e.ctrlKey && e.key === 'c') {
    const lines = getSelectedPMLines();
    if (lines.length > 0) {
      e.preventDefault();
      const text = lines.some(l => l.includes('\n')) ? lines.join('\n\n') : lines.join('\n');
      navigator.clipboard.writeText(text);
      flashPMCopy(`Copied ${lines.length} item!`);
    }
  }
});

document.getElementById('btn-pm-copy-sel').addEventListener('click', async () => {
  const lines = getSelectedPMLines();
  if (lines.length === 0) return alert("Pilih baris dulu.");
  const text = lines.some(l => l.includes('\n')) ? lines.join('\n\n') : lines.join('\n');
  await navigator.clipboard.writeText(text);
  flashPMCopy(`Copied ${lines.length} item!`);
});

document.getElementById('btn-pm-copy-all').addEventListener('click', async () => {
  if (pmDataGroups.length === 0) return;
  await navigator.clipboard.writeText(pmDataGroups.map(g => generateGroupText(g, false)).join('\n\n'));
  flashPMCopy(`Copied ${pmDataGroups.length} groups!`);
});


function updateMainBroadcastLogs() {
  const d = new Date().toLocaleDateString('id-ID');
  document.getElementById('wa-bc-log-date-main').textContent = `📋 ${d}`;
  const box = document.getElementById('wa-bc-log-box-main');
  if (!broadcastLogs || broadcastLogs.length === 0) {
    box.value = "Belum ada broadcast hari ini.";
  } else {
    let txt = "";
    [...broadcastLogs].reverse().forEach(l => {
      const icon = l.success === l.total ? "✅" : "⚠️";
      const groupsStr = Array.isArray(l.groups) ? l.groups.join(", ") : l.groups;
      txt += `[${l.time}]  ${icon}  ${l.success}/${l.total} berhasil  →  ${groupsStr}\n`;
    });
    box.value = txt;
  }
}
// Database Edit Logic
const btnDbEditSearch = document.getElementById('btn-db-edit-search');
const btnDbEditClear = document.getElementById('btn-db-edit-clear');
const btnDbEditSave = document.getElementById('btn-db-edit-save');
const btnDbExport = document.getElementById('btn-db-export');
const btnDbUndo = document.getElementById('btn-db-undo');
const inpDbSearch = document.getElementById('db-edit-search-inp');
const lblDbSearchStatus = document.getElementById('db-edit-search-status');
const lblDbEditStatus = document.getElementById('db-edit-status-header');
const dbEditForm = document.getElementById('db-edit-form');

let dbCurrentSiteData = null;

if (btnDbEditSearch) {
  btnDbEditSearch.addEventListener('click', async () => {
    const val = inpDbSearch.value.trim();
    if (!val) return;

    lblDbSearchStatus.textContent = 'Mencari...';
    try {
      const data = await invoke('lookup_site', { siteId: val });
      if (data) {
        dbCurrentSiteData = data;
        lblDbSearchStatus.textContent = 'Site ditemukan!';
        lblDbSearchStatus.style.color = 'var(--grn)';
        dbEditForm.classList.remove('hidden');
        populateDbForm(data);
      } else {
        lblDbSearchStatus.textContent = 'Site tidak ditemukan.';
        lblDbSearchStatus.style.color = 'var(--red)';
        dbEditForm.classList.add('hidden');
      }
    } catch (e) {
      lblDbSearchStatus.textContent = 'Error: ' + e;
      lblDbSearchStatus.style.color = 'var(--red)';
    }
  });

  inpDbSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnDbEditSearch.click();
  });

  btnDbEditClear.addEventListener('click', () => {
    inpDbSearch.value = '';
    lblDbSearchStatus.textContent = '';
    dbEditForm.classList.add('hidden');
    dbCurrentSiteData = null;
  });

  function populateDbForm(data) {
    const setVal = (id, key) => {
      const el = document.getElementById(id);
      if (el) el.value = data[key] || '';
    };

    setVal('dbe-site-id-msh', 'Site ID (New)');
    setVal('dbe-lon', 'Longitude');
    setVal('dbe-site-name', 'Site Name');
    setVal('dbe-lat', 'Latitude');
    setVal('dbe-old-site-id', 'Old Site ID');
    setVal('dbe-tlp', 'TLP');
    setVal('dbe-cluster', 'Cluster (MC)');
    setVal('dbe-site-class', 'Site Class');
    setVal('dbe-area', 'Area');
    setVal('dbe-hub-type', 'Hub Type');
    setVal('dbe-fm-office', 'FM Office');
    setVal('dbe-address', 'Address');
    setVal('dbe-vendor', 'Vendor');
    setVal('dbe-host-name', 'Host Name');

    setVal('dbe-rts-name', 'RTS Name');
    setVal('dbe-rts-email', 'RTS Email');
    setVal('dbe-rts-phone', 'RTS Phone');
    setVal('dbe-rts-new', 'RTS NEW');

    setVal('dbe-te-name', 'TE Name');
    setVal('dbe-te-phone', 'TE Phone');
    setVal('dbe-te-email', 'TE Email');

    setVal('dbe-cme-name', 'CME Name');
    setVal('dbe-cme-phone', 'CME Phone');
    setVal('dbe-cme-email', 'CME Email');
  }

  btnDbUndo.addEventListener('click', () => {
    if (dbCurrentSiteData) {
      populateDbForm(dbCurrentSiteData);
      lblDbEditStatus.textContent = 'Perubahan dibatalkan.';
      lblDbEditStatus.style.color = 'var(--amb)';
      setTimeout(() => lblDbEditStatus.textContent = '', 2000);
    }
  });

  btnDbEditSave.addEventListener('click', async () => {
    if (!dbCurrentSiteData) return;
    const getVal = id => document.getElementById(id).value.trim();

    const editData = {
      site_id: getVal('dbe-site-id-msh'),
      lon: getVal('dbe-lon'),
      site_name: getVal('dbe-site-name'),
      lat: getVal('dbe-lat'),
      old_site_id: getVal('dbe-old-site-id'),
      tlp: getVal('dbe-tlp'),
      cluster: getVal('dbe-cluster'),
      site_class: getVal('dbe-site-class'),
      area: getVal('dbe-area'),
      hub_type: getVal('dbe-hub-type'),
      fm_office: getVal('dbe-fm-office'),
      address: getVal('dbe-address'),
      vendor: getVal('dbe-vendor'),
      host_name: getVal('dbe-host-name'),
      rts_name: getVal('dbe-rts-name'),
      rts_email: getVal('dbe-rts-email'),
      rts_phone: getVal('dbe-rts-phone'),
      rts_new: getVal('dbe-rts-new'),
      te_name: getVal('dbe-te-name'),
      te_phone: getVal('dbe-te-phone'),
      te_email: getVal('dbe-te-email'),
      cme_name: getVal('dbe-cme-name'),
      cme_phone: getVal('dbe-cme-phone'),
      cme_email: getVal('dbe-cme-email')
    };

    try {
      await invoke('update_site_db', { editData });
      syncTeContactFromSite(editData);
      if (typeof SiteChangesManager !== 'undefined') {
        SiteChangesManager.recordSiteEdit(editData.site_id, editData);
      }
      lblDbEditStatus.textContent = '✅ Berhasil disimpan sementara ke memory.';
      lblDbEditStatus.style.color = 'var(--grn)';
      setTimeout(() => lblDbEditStatus.textContent = '', 3000);
    } catch (e) {
      lblDbEditStatus.textContent = '❌ Gagal: ' + e;
      lblDbEditStatus.style.color = 'var(--red)';
    }
  });

  btnDbExport.addEventListener('click', async () => {
    try {
      const msg = await invoke('export_db');
      lblDbEditStatus.textContent = '✅ ' + msg;
      lblDbEditStatus.style.color = 'var(--grn)';
      setTimeout(() => lblDbEditStatus.textContent = '', 4000);
    } catch (e) {
      lblDbEditStatus.textContent = '❌ Export gagal: ' + e;
      lblDbEditStatus.style.color = 'var(--red)';
    }
  });
}



// Main Database Lookup Logic



const mapSiteInput = document.getElementById('map-site-input');
const btnMapSearch = document.getElementById('btn-map-search');
const btnMapStreet = document.getElementById('btn-map-street');

if (btnMapSearch) {
  btnMapSearch.addEventListener('click', async () => {
    const val = mapSiteInput.value.trim();
    if (!val) return alert('Masukkan Site ID, Koordinat, atau Alamat!');

    btnMapSearch.textContent = 'Mencari...';

    try {
      let lat = 0;
      let lon = 0;
      let title = val;
      let isSite = false;

      // 1. Check if it's a Coordinate "lat, lon"
      const coordMatch = val.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);

      if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lon = parseFloat(coordMatch[3]);
      } else {
        // 2. Try looking up as Site ID
        const row = await invoke('lookup_site', { siteId: val });
        if (row) {
          isSite = true;
          lat = parseFloat(row['Latitude']);
          lon = parseFloat(row['Longitude']);
          title = row['Site Name'] || val;
        } else {
          // 3. Fallback to Address Geocoding (Nominatim)
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}`);
          const data = await res.json();

          if (data && data.length > 0) {
            lat = parseFloat(data[0].lat);
            lon = parseFloat(data[0].lon);
            title = data[0].display_name;
          } else {
            btnMapSearch.textContent = 'Cari';
            return alert(`'${val}' tidak ditemukan sebagai Site ID, Koordinat, maupun Alamat.`);
          }
        }
      }

      if (isNaN(lat) || isNaN(lon) || lat === 0) {
        btnMapSearch.textContent = 'Cari';
        return alert(`Koordinat tidak valid.`);
      }

      initMap();

      // Clear previous if any
      mapMarkers.forEach(m => siteMap.removeLayer(m));
      mapMarkers = [];

      // Plot the target
      const markerColor = isSite ? '#eab308' : '#3b82f6';
      const markerHtml = `
        <div style="background-color: ${markerColor}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>
      `;
      const icon = L.divIcon({ className: 'custom-div-icon', html: markerHtml, iconSize: [16, 16], iconAnchor: [8, 8] });

      const safeTargetTitle = (title || '').replace(/'/g, "\\'");
      const targetMarker = L.marker([lat, lon], { icon }).addTo(siteMap)
        .bindPopup(`
          <div style="font-family:var(--ui);min-width:180px;font-size:12px;">
            <b>${isSite ? 'BTS Site' : 'Lokasi Pelanggan'}</b><br>${title}
            <div style="margin-top:8px;">
              <button class="tbtn-p" style="width:100%;font-size:11px;padding:4px 8px;cursor:pointer;border:none;border-radius:4px;background:var(--accent);color:white;font-weight:600;" onclick="window.openStreetViewPopup(${lat}, ${lon}, '${safeTargetTitle}')">Street View</button>
            </div>
          </div>
        `).openPopup();
      mapMarkers.push(targetMarker);

      if (!isSite) {
        // Draw 3KM Radius
        const circle = L.circle([lat, lon], { radius: 3000, color: '#3b82f6', fillOpacity: 0.1, weight: 1 }).addTo(siteMap);
        mapMarkers.push(circle);

        // Find Nearest Sites
        const nearest = await invoke('find_nearest_sites', { lat, lon, limit: 5 });

        const panel = document.getElementById('map-nearest-panel');
        const list = document.getElementById('map-nearest-list');
        list.innerHTML = '';

        if (nearest && nearest.length > 0) {
          const bounds = L.latLngBounds([[lat, lon]]);

          nearest.forEach((s, idx) => {
            // Check if DOWN
            const downData = statusData.find(st => st.new_site === s.site_id && st.status === 'DOWN');
            const isDown = !!downData;
            const btsColor = isDown ? '#ef4444' : '#22c55e';

            const remarkHtml = isDown ? `<br><span style="color:#ef4444;font-size:10.5px;"><b>[${downData.start_time}]</b> ${downData.remark}</span>` : '';

            // Add to map
            const sIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: ${btsColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
              iconSize: [12, 12], iconAnchor: [6, 6]
            });
            const safeNearestName = (s.site_name || '').replace(/'/g, "\\'");
            const m = L.marker([s.lat, s.lon], { icon: sIcon }).addTo(siteMap)
              .bindPopup(`
                <div style="font-family:var(--ui);font-size:12px;min-width:180px;">
                  <b>${s.site_id}</b><br>${s.site_name}<br>Jarak: ${s.distance_km.toFixed(2)} KM${remarkHtml}
                  <div style="margin-top:8px;">
                    <button class="tbtn-p" style="width:100%;font-size:11px;padding:4px 8px;cursor:pointer;border:none;border-radius:4px;background:var(--accent);color:white;font-weight:600;" onclick="window.openStreetViewPopup(${s.lat}, ${s.lon}, '${s.site_id} - ${safeNearestName}')">Street View</button>
                  </div>
                </div>
              `);
            mapMarkers.push(m);
            bounds.extend([s.lat, s.lon]);

            // Draw line
            const polyline = L.polyline([[lat, lon], [s.lat, s.lon]], { color: btsColor, weight: 2, dashArray: '5, 5', opacity: 0.6 }).addTo(siteMap);
            mapMarkers.push(polyline);

            // Add to Panel
            const div = document.createElement('div');
            div.style.padding = '6px';
            div.style.background = 'var(--bg-base)';
            div.style.borderRadius = 'var(--r)';
            div.style.border = '1px solid var(--bdr)';

            const panelRemark = isDown ? `<div style="margin-top:3px;font-size:10px;color:var(--red);line-height:1.2;"><b>[${downData.start_time}]</b> ${downData.remark}</div>` : '';

            div.innerHTML = `
                    <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                       <strong style="color:var(--accent-lit);cursor:pointer;" onclick="mapSiteInput.value='${s.site_id}';btnMapSearch.click();">${idx + 1}. ${s.site_id}</strong>
                       <span style="color:${btsColor};font-weight:bold;">${isDown ? 'DOWN' : 'UP'}</span>
                    </div>
                    <div>${s.site_name}</div>
                    <div style="color:var(--txt-3);margin-top:2px;">Jarak: ${s.distance_km.toFixed(2)} KM</div>
                    ${panelRemark}
                 `;
            list.appendChild(div);
          });

          siteMap.fitBounds(bounds, { padding: [50, 50] });
          panel.classList.remove('hidden');
        }
      } else {
        document.getElementById('map-nearest-panel')?.classList.add('hidden');
        siteMap.flyTo([lat, lon], 17);
      }

    } catch (e) {
      alert(`Error: ${e}`);
    } finally {
      btnMapSearch.textContent = 'Cari';
    }
  });

  document.getElementById('btn-close-nearest')?.addEventListener('click', () => {
    document.getElementById('map-nearest-panel').classList.add('hidden');
  });

  mapSiteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnMapSearch.click();
  });

  // ==========================================
  // STREET VIEW MODAL CONTROLLER
  // ==========================================
  let currentStreetViewCoords = { lat: 0, lon: 0, title: '' };
  let currentStreetViewMode = 'pano'; // 'pano' | 'sat'

  const modalStreetView = document.getElementById('modal-street-view');
  const iframeStreetView = document.getElementById('iframe-street-view');
  const streetViewTitle = document.getElementById('street-view-title');
  const streetViewCoords = document.getElementById('street-view-coords');
  const streetViewLoader = document.getElementById('street-view-loader');
  const btnCloseStreetView = document.getElementById('btn-close-street-view');
  const btnStreetModePano = document.getElementById('btn-street-mode-pano');
  const btnStreetModeSat = document.getElementById('btn-street-mode-sat');
  const btnStreetOpenBrowser = document.getElementById('btn-street-open-browser');
  const btnCopyStreetCoords = document.getElementById('btn-copy-street-coords');

  function updateStreetViewIframeSrc() {
    const { lat, lon } = currentStreetViewCoords;
    if (!lat || !lon || !iframeStreetView) return;

    if (streetViewLoader) {
      streetViewLoader.style.display = 'flex';
      streetViewLoader.style.opacity = '1';
    }

    if (currentStreetViewMode === 'pano') {
      iframeStreetView.src = `https://www.google.com/maps/embed?origin=mfe&pb=!6m6!1m5!2m2!1d${lat}!2d${lon}!4f-0!5f1`;
      if (btnStreetModePano && btnStreetModeSat) {
        btnStreetModePano.className = 'tbtn-p';
        btnStreetModePano.style.background = '';
        btnStreetModePano.style.border = '';
        btnStreetModeSat.className = 'tbtn';
        btnStreetModeSat.style.background = 'transparent';
        btnStreetModeSat.style.border = 'none';
      }
    } else {
      // Satellite / 3D mode
      iframeStreetView.src = `https://maps.google.com/maps?q=${lat},${lon}&t=k&z=19&output=embed`;
      if (btnStreetModePano && btnStreetModeSat) {
        btnStreetModeSat.className = 'tbtn-p';
        btnStreetModeSat.style.background = '';
        btnStreetModeSat.style.border = '';
        btnStreetModePano.className = 'tbtn';
        btnStreetModePano.style.background = 'transparent';
        btnStreetModePano.style.border = 'none';
      }
    }
  }

  if (iframeStreetView) {
    iframeStreetView.addEventListener('load', () => {
      if (streetViewLoader) {
        streetViewLoader.style.opacity = '0';
        setTimeout(() => {
          if (streetViewLoader.style.opacity === '0') {
            streetViewLoader.style.display = 'none';
          }
        }, 300);
      }
    });
  }

  function openStreetViewModal(lat, lon, title) {
    if (!modalStreetView) return;

    currentStreetViewCoords = {
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      title: title || `${parseFloat(lat).toFixed(6)}, ${parseFloat(lon).toFixed(6)}`
    };
    currentStreetViewMode = 'pano';

    if (streetViewTitle) streetViewTitle.textContent = currentStreetViewCoords.title;
    if (streetViewCoords) streetViewCoords.textContent = `${currentStreetViewCoords.lat.toFixed(6)}, ${currentStreetViewCoords.lon.toFixed(6)}`;

    updateStreetViewIframeSrc();

    modalStreetView.classList.remove('hidden');
    modalStreetView.style.display = 'flex';
  }

  function closeStreetViewModal() {
    if (!modalStreetView) return;
    modalStreetView.classList.add('hidden');
    modalStreetView.style.display = 'none';
    if (iframeStreetView) {
      iframeStreetView.src = 'about:blank';
    }
  }

  // Global access for map marker popups
  window.openStreetViewPopup = (lat, lon, title) => {
    openStreetViewModal(lat, lon, title);
  };

  if (btnStreetModePano) {
    btnStreetModePano.addEventListener('click', () => {
      if (currentStreetViewMode !== 'pano') {
        currentStreetViewMode = 'pano';
        updateStreetViewIframeSrc();
      }
    });
  }

  if (btnStreetModeSat) {
    btnStreetModeSat.addEventListener('click', () => {
      if (currentStreetViewMode !== 'sat') {
        currentStreetViewMode = 'sat';
        updateStreetViewIframeSrc();
      }
    });
  }

  if (btnStreetOpenBrowser) {
    btnStreetOpenBrowser.addEventListener('click', async () => {
      const { lat, lon } = currentStreetViewCoords;
      if (!lat || !lon) return;
      const url = `http://maps.google.com/maps?q=&layer=c&cbll=${lat},${lon}`;
      try {
        await invoke('open_url', { url });
      } catch (err) {
        alert("Gagal membuka browser: " + err);
      }
    });
  }

  if (btnCopyStreetCoords) {
    btnCopyStreetCoords.addEventListener('click', () => {
      const { lat, lon } = currentStreetViewCoords;
      navigator.clipboard.writeText(`${lat}, ${lon}`);
      const old = btnCopyStreetCoords.textContent;
      btnCopyStreetCoords.textContent = '✓';
      setTimeout(() => { if (btnCopyStreetCoords) btnCopyStreetCoords.textContent = old; }, 1500);
    });
  }

  if (btnCloseStreetView) {
    btnCloseStreetView.addEventListener('click', closeStreetViewModal);
  }

  if (modalStreetView) {
    modalStreetView.addEventListener('click', (e) => {
      if (e.target === modalStreetView) closeStreetViewModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStreetView && modalStreetView.style.display !== 'none' && !modalStreetView.classList.contains('hidden')) {
      closeStreetViewModal();
    }
  });

  if (btnMapStreet) {
    btnMapStreet.addEventListener('click', async () => {
      const val = mapSiteInput.value.trim();
      if (!val) return alert('Masukkan Site ID atau Koordinat terlebih dahulu!');

      try {
        let lat = 0;
        let lon = 0;
        let title = val;

        // 1. Check if it's a Coordinate "lat, lon"
        const coordMatch = val.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
        if (coordMatch) {
          lat = parseFloat(coordMatch[1]);
          lon = parseFloat(coordMatch[3]);
        } else {
          // 2. Try looking up as Site ID
          const row = await invoke('lookup_site', { siteId: val });
          if (row) {
            lat = parseFloat(row['Latitude']);
            lon = parseFloat(row['Longitude']);
            title = `${val} - ${row['Site Name'] || ''}`;
          } else {
            // 3. Fallback to geocoding
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}`);
            const data = await res.json();
            if (data && data.length > 0) {
              lat = parseFloat(data[0].lat);
              lon = parseFloat(data[0].lon);
              title = data[0].display_name;
            } else {
              return alert(`'${val}' tidak ditemukan sebagai Site ID, Koordinat, maupun Alamat.`);
            }
          }
        }

        if (isNaN(lat) || isNaN(lon) || lat === 0) {
          return alert(`Koordinat untuk '${val}' tidak valid atau kosong.`);
        }

        openStreetViewModal(lat, lon, title);
      } catch (e) {
        alert(`Error: ${e}`);
      }
    });
  }

  const btnMapScreenshot = document.getElementById('btn-map-screenshot');
  if (btnMapScreenshot) {
    btnMapScreenshot.addEventListener('click', async () => {
      const mapElem = document.querySelector('.map-wrap') || document.getElementById('map-container');
      if (!mapElem) return alert('Elemen peta tidak ditemukan!');

      const oldText = btnMapScreenshot.innerHTML;
      btnMapScreenshot.disabled = true;
      btnMapScreenshot.innerHTML = 'Capturing...';

      let clone = null;

      try {
        // Wait 100ms to settle popup animations
        await new Promise(r => setTimeout(r, 100));

        // 1. Create a deep clone of the map element
        clone = mapElem.cloneNode(true);

        // 2. Position it off-screen so there is absolutely ZERO visual flicker/blink on the user's screen!
        clone.style.position = 'absolute';
        clone.style.left = '-9999px';
        clone.style.top = '-9999px';
        clone.style.width = mapElem.offsetWidth + 'px';
        clone.style.height = mapElem.offsetHeight + 'px';
        clone.style.zIndex = '-9999';

        // Append it to body to ensure CSS styles apply perfectly
        document.body.appendChild(clone);

        // 3. Temporarily translate ALL elements inside the clone that have CSS transforms (tiles, panes, markers, popups)
        const allElements = clone.querySelectorAll('*');
        allElements.forEach((el, index) => {
          const style = el.style;
          let transform = style.transform;
          if (!transform) {
            // Fallback to live element's computed style if clone's style is initially empty
            const liveEl = mapElem.querySelectorAll('*')[index];
            if (liveEl) {
              transform = window.getComputedStyle(liveEl).transform;
            }
          }

          if (transform && transform !== 'none') {
            let x = 0, y = 0;
            // A. Try parsing direct translate3d(x, y, z) or translate(x, y) via regex (most precise for inline styles!)
            const match = transform.match(/translate(?:3d)?\(([^,]+)px,\s*([^,]+)px/);
            if (match) {
              x = parseFloat(match[1]);
              y = parseFloat(match[2]);
            } else {
              // B. Fallback to matrix/matrix3d parsing
              const matrixValues = transform.split('(')[1]?.split(')')[0]?.split(',');
              if (matrixValues) {
                if (matrixValues.length === 6) {
                  x = parseFloat(matrixValues[4]);
                  y = parseFloat(matrixValues[5]);
                } else if (matrixValues.length === 16) {
                  x = parseFloat(matrixValues[12]);
                  y = parseFloat(matrixValues[13]);
                }
              }
            }

            style.transform = 'none';
            style.left = (parseFloat(style.left || 0) + x) + 'px';
            style.top = (parseFloat(style.top || 0) + y) + 'px';
          }
        });

        // 4. Temporarily replace glassmorphism and semi-transparent panels inside the clone with solid opaque cards
        const panels = clone.querySelectorAll('#map-nearest-panel, .map-legend, .leaflet-popup-content-wrapper, .leaflet-popup-tip');
        const isLight = document.body.classList.contains('light');
        panels.forEach(p => {
          p.style.background = isLight ? '#ffffff' : '#1c1c1f';
          p.style.backdropFilter = 'none';
          p.style.webkitBackdropFilter = 'none';
          p.style.boxShadow = 'none';
        });

        // 5. Take screenshot of the CLONED element via html2canvas
        const canvas = await html2canvas(clone, {
          useCORS: true,
          allowTaint: true,
          scale: window.devicePixelRatio || 2, // Retina resolution
          backgroundColor: isLight ? '#f9f9fb' : '#111113', // Match base theme background exactly
          logging: false
        });

        // Convert to data URL and download
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');

        // Generate filename based on date and searched site/coords
        const now = new Date();
        const dateStr = now.getFullYear() +
          String(now.getMonth() + 1).padStart(2, '0') +
          String(now.getDate()).padStart(2, '0') + '_' +
          String(now.getHours()).padStart(2, '0') +
          String(now.getMinutes()).padStart(2, '0') +
          String(now.getSeconds()).padStart(2, '0');

        const searchVal = mapSiteInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `Map_Screenshot_${searchVal || 'site'}_${dateStr}.png`;

        link.download = filename;
        link.href = dataUrl;
        link.click();

        // Superpower feature: Copy image to clipboard for instant pasting (e.g. into WhatsApp)
        try {
          canvas.toBlob(async (blob) => {
            if (blob) {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
            }
          }, 'image/png');
          btnMapScreenshot.innerHTML = '✓ Captured & Copied!';
        } catch (clipErr) {
          console.warn('Clipboard write failed, downloaded only:', clipErr);
          btnMapScreenshot.innerHTML = '✓ Captured!';
        }
      } catch (err) {
        alert('Gagal mengambil screenshot: ' + err);
      } finally {
        // ALWAYS clean up the off-screen clone from the DOM tree!
        if (clone && clone.parentNode) {
          clone.parentNode.removeChild(clone);
        }

        setTimeout(() => {
          btnMapScreenshot.disabled = false;
          btnMapScreenshot.innerHTML = oldText;
        }, 2000);
      }
    });
  }
}

// ==========================================
// OTHERS TAB - SUB-TAB NAVIGATION
// ==========================================
const subBtns = document.querySelectorAll('#tab-others .tb');
const subPanes = document.querySelectorAll('#tab-others .subtab-pane');

subBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    subBtns.forEach(b => b.classList.remove('active'));
    subPanes.forEach(p => p.classList.add('hidden'));

    btn.classList.add('active');
    const targetId = btn.id.replace('subbtn-', 'subtab-');
    const target = document.getElementById(targetId);
    if (target) target.classList.remove('hidden');

    // Special case for System tab: load version
    if (targetId === 'subtab-system') {
      loadAppVersion();
    }
  });
});

// ==========================================
// SYSTEM & AUTO UPDATE LOGIC
// ==========================================
const lblVersion = document.getElementById('app-version-display');
const btnCheckUpdate = document.getElementById('btn-check-update');
const btnInstallUpdate = document.getElementById('btn-install-update');
const lblUpdateStatus = document.getElementById('update-status-text');
const progressContainer = document.getElementById('update-progress-bar-container');
const progressPercent = document.getElementById('update-progress-percent');
const progressFill = document.getElementById('update-progress-fill');

async function loadAppVersion() {
  try {
    const version = await getVersion();
    if (lblVersion) lblVersion.textContent = version;
  } catch (e) {
    console.error("Failed to get version:", e);
  }
}

if (btnCheckUpdate) {
  btnCheckUpdate.addEventListener('click', async () => {
    btnCheckUpdate.disabled = true;
    btnCheckUpdate.textContent = "⏳ Mengecek...";
    lblUpdateStatus.textContent = "Sedang mencari update terbaru...";
    lblUpdateStatus.style.color = "var(--txt-2)";

    try {
      const update = await check();
      if (update) {
        lblUpdateStatus.textContent = `🚀 Versi baru tersedia: ${update.version}`;
        lblUpdateStatus.style.color = "var(--accent-lit)";
        btnInstallUpdate.classList.remove('hidden');

        // Store update object for installation
        window._pendingUpdate = update;
      } else {
        lblUpdateStatus.textContent = "✅ Anda sudah menggunakan versi terbaru.";
        lblUpdateStatus.style.color = "var(--grn)";
        btnInstallUpdate.classList.add('hidden');
      }
    } catch (e) {
      lblUpdateStatus.textContent = "❌ Gagal mengecek update: " + e;
      lblUpdateStatus.style.color = "var(--red)";
      console.error(e);
    } finally {
      btnCheckUpdate.disabled = false;
      btnCheckUpdate.textContent = "Cek Update Sekarang";
    }
  });
}

if (btnInstallUpdate) {
  btnInstallUpdate.addEventListener('click', async () => {
    const update = window._pendingUpdate;
    if (!update) return;

    btnInstallUpdate.disabled = true;
    btnCheckUpdate.disabled = true;
    progressContainer.classList.remove('hidden');
    lblUpdateStatus.textContent = "Mengunduh update...";

    try {
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength;
            console.log(`started downloading ${contentLength} bytes`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            const percent = Math.round((downloaded / contentLength) * 100);
            progressPercent.textContent = `${percent}%`;
            progressFill.style.width = `${percent}%`;
            break;
          case 'Finished':
            console.log('download finished');
            lblUpdateStatus.textContent = "Update berhasil diinstal! Restarting...";
            break;
        }
      });

      // App will restart automatically on most platforms after install
    } catch (e) {
      lblUpdateStatus.textContent = "❌ Gagal menginstal update: " + e;
      lblUpdateStatus.style.color = "var(--red)";
      btnInstallUpdate.disabled = false;
      btnCheckUpdate.disabled = false;
    }
  });
}

// --- DATA PIVOT FEATURE ---

// Load persisted pivot data
try {
  const savedPivot = localStorage.getItem('cjhelper_pivot_data');
  const savedText = localStorage.getItem('cjhelper_pivot_text');
  if (savedPivot) {
    pivotData = JSON.parse(savedPivot);
  }
  if (savedText && document.getElementById('txt-pivot')) {
    document.getElementById('txt-pivot').value = savedText;
  }
} catch (e) {
  console.error("Failed to load saved pivot data", e);
}

// Function to format date from pivot row (e.g., "5/9/2026 0:14" -> "2026-05-09 00:14")
function formatPivotDate(dateStr) {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateStr)) return dateStr;

  const match = dateStr.match(/(\d+)[\/\-](\d+)[\/\-](\d+)\s+(\d+):(\d+)/);
  if (match) {
    const mm = match[1].padStart(2, '0');
    const dd = match[2].padStart(2, '0');
    const yyyy = match[3];
    const hh = match[4].padStart(2, '0');
    const min = match[5].padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yy}-${mm}-${dd} ${hh}:${min}`;
  }
  return dateStr;
}

// Calculate pivot aging
function calculatePivotAging(dateStr) {
  if (!dateStr) return "0 - 2 Hours";

  let d = new Date(dateStr);
  const match = dateStr.match(/(\d+)[\/\-](\d+)[\/\-](\d+)\s+(\d+):(\d+)/);
  if (match) {
    const mm = parseInt(match[1]);
    const dd = parseInt(match[2]);
    const yyyy = parseInt(match[3]);
    const hh = parseInt(match[4]);
    const min = parseInt(match[5]);
    d = new Date(yyyy, mm - 1, dd, hh, min);
  }

  if (isNaN(d.getTime())) return "0 - 2 Hours";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) return "0 - 2 Hours";
  if (diffHours < 2) return "0 - 2 Hours";
  if (diffHours < 4) return "2 - 4 Hours";
  if (diffHours < 8) return "4 - 8 Hours";
  if (diffHours < 24) return "8 - 24 Hours";
  return "> 24 Hours";
}

function parsePivotData(text) {
  const lines = text.split('\n');
  const rows = [];
  let currentSystem = "";

  let colIndices = {
    rowLabels: 0,
    monitoring: 1,
    system: 2,
    cluster: 3,
    newId: 4,
    siteName: 5,
    tanggal: 6,
    ring: 7,
    category: 8,
    newTe: 9
  };

  let headerFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split('\t').map(p => p.trim());

    if (parts[0] === 'Row Labels' || parts.includes('Monitoring')) {
      parts.forEach((part, idx) => {
        const p = part.toLowerCase();
        if (p.includes('label')) colIndices.rowLabels = idx;
        else if (p.includes('monitoring')) colIndices.monitoring = idx;
        else if (p.includes('system')) colIndices.system = idx;
        else if (p.includes('cluster')) colIndices.cluster = idx;
        else if (p.includes('new id') || p.includes('new site id') || p.includes('id')) colIndices.newId = idx;
        else if (p.includes('site name') || p.includes('name')) colIndices.siteName = idx;
        else if (p.includes('tanggal') || p.includes('date') || p.includes('start')) colIndices.tanggal = idx;
        else if (p.includes('ring')) colIndices.ring = idx;
        else if (p.includes('category') || p.includes('categ')) colIndices.category = idx;
        else if (p.includes('new te') || p.includes('te name') || p.includes('te')) colIndices.newTe = idx;
      });
      headerFound = true;
      continue;
    }

    if (!headerFound && i === 0) {
      headerFound = true;
    }

    if (parts.length < 2) continue;

    let rawId = parts[colIndices.newId] || "";
    const label = parts[colIndices.rowLabels] || "";
    const siteName = parts[colIndices.siteName] || "";
    const monitoring = parts[colIndices.monitoring] || "";
    const systemVal = parts[colIndices.system] || "";

    if (monitoring.toUpperCase() === 'GRAND TOTAL' || label.toUpperCase() === 'GRAND TOTAL') continue;

    // Extract real Site ID (e.g. 14KDS0085 or 14SMG0156)
    const siteIdPattern = /([0-9]{2}[A-Z]{3}[0-9]{4})/i;
    let siteIdMatch = line.match(siteIdPattern) || rawId.match(siteIdPattern) || siteName.match(siteIdPattern) || label.match(siteIdPattern);
    const newId = siteIdMatch ? siteIdMatch[1].toUpperCase() : "";

    if (!newId) {
      if (systemVal && systemVal !== '0' && isNaN(systemVal)) {
        currentSystem = systemVal.toUpperCase();
      }
      continue;
    }

    let cleanSiteName = siteName;
    if (cleanSiteName && newId && cleanSiteName.toUpperCase().startsWith(newId + "_")) {
      cleanSiteName = cleanSiteName.substring(newId.length + 1);
    }

    const cluster = parts[colIndices.cluster] || "";
    const tanggal = parts[colIndices.tanggal] || "";
    const category = parts[colIndices.category] || "";
    const newTe = parts[colIndices.newTe] || "";

    rows.push({
      monitoring: monitoring.toUpperCase(),
      system: currentSystem || systemVal.toUpperCase() || "HUAWEI",
      cluster,
      newId,
      siteName: cleanSiteName || siteName || newId,
      tanggal,
      category,
      newTe
    });
  }

  return rows;
}

function renderPivotTable() {
  const tbody = document.getElementById('pivot-tbody');
  if (!tbody) return;
  if (pivotData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-subtle" style="padding: 20px;">Belum ada data pivot diproses.</td></tr>';
    return;
  }
  tbody.innerHTML = pivotData.map(row => `
    <tr>
      <td><span class="badge ${row.monitoring === 'STOLLEN' || row.monitoring === 'CABLE STOLLEN' ? 'br' : 'ba'}">${row.monitoring}</span></td>
      <td>${row.system}</td>
      <td>${row.cluster}</td>
      <td>${row.newId}</td>
      <td>${row.siteName}</td>
      <td>${row.tanggal}</td>
      <td>${row.category}</td>
      <td>${(row.monitoring === 'STOLLEN' || row.monitoring === 'CABLE STOLLEN') ? (row.rtsName || row.teName || row.newTe) : (row.teName || row.newTe)}</td>
    </tr>
  `).join('');
}

// Handler for processing pivot data
async function handleProcessPivot() {
  const txtPivot = document.getElementById('txt-pivot');
  if (!txtPivot) return;
  const text = txtPivot.value.trim();
  if (!text) {
    alert("Silakan paste data pivot terlebih dahulu.");
    return;
  }

  const rawRows = parsePivotData(text);

  const statusBar = document.getElementById('status-bar');
  if (statusBar) statusBar.textContent = "Sedang memproses & mencocokkan data pivot...";

  for (let row of rawRows) {
    let dbInfo = null;
    if (invoke && row.newId) {
      try {
        dbInfo = await invoke('lookup_site', { siteId: row.newId });
      } catch (err) {
        console.error("DB lookup failed for", row.newId, err);
      }
    }

    const matchedMaster = (typeof statusData !== 'undefined' && statusData) ? statusData.find(s => s.new_site && s.new_site.toUpperCase() === (row.newId || "").toUpperCase()) : null;

    // 1. RTS Name / TE Name
    let rtsName = (dbInfo && (dbInfo['RTS Name'] || dbInfo['TE Name'])) || (matchedMaster && (matchedMaster.rts || matchedMaster.pic)) || row.newTe || "—";
    let teName = (dbInfo && dbInfo['TE Name']) || (matchedMaster && matchedMaster.pic) || row.newTe || "—";

    row.rtsName = rtsName;
    row.teName = teName;

    // 2. FM Office priority (MUST NOT be RTS Name or TE Name)
    let fmOffice = (dbInfo && dbInfo['FM Office']) ||
                   (matchedMaster && matchedMaster.cluster) ||
                   row.cluster || "—";

    if (fmOffice && fmOffice.toUpperCase().startsWith("MC-")) {
      fmOffice = fmOffice.substring(3).trim();
    }

    if (!fmOffice || fmOffice === "—" || fmOffice === "0" || fmOffice.toUpperCase() === rtsName.toUpperCase() || fmOffice.toUpperCase() === teName.toUpperCase()) {
      fmOffice = (dbInfo && dbInfo['Cluster (MC)']) || (matchedMaster && matchedMaster.cluster) || row.cluster || "—";
      if (fmOffice && fmOffice.toUpperCase().startsWith("MC-")) {
        fmOffice = fmOffice.substring(3).trim();
      }
    }

    row.fmOffice = fmOffice;
    row.cluster = fmOffice; // Replace cluster with clean FM Office

    // 3. Site Class priority (END SITE, SMALL HUB SITE, MEDIUM HUB SITE, BIG HUB SITE)
    let sClass = (matchedMaster && matchedMaster.site_class && !matchedMaster.site_class.toUpperCase().includes('CRITICAL') ? matchedMaster.site_class : "") ||
                 (dbInfo && dbInfo['Hub Type']) ||
                 (dbInfo && dbInfo['Site Class'] && !dbInfo['Site Class'].toUpperCase().includes('CRITICAL') ? dbInfo['Site Class'] : "") || "";

    if (!sClass || sClass === "A" || sClass === "B" || sClass === "C" || sClass.length <= 2 || sClass.toUpperCase().includes('CRITICAL')) {
      if (matchedMaster && matchedMaster.site_class && !matchedMaster.site_class.toUpperCase().includes('CRITICAL')) {
        sClass = matchedMaster.site_class;
      } else if (matchedMaster && matchedMaster.category && !matchedMaster.category.toUpperCase().includes('CRITICAL')) {
        sClass = matchedMaster.category;
      } else {
        sClass = "END SITE";
      }
    }

    row.siteClass = sClass;

    if (dbInfo && dbInfo['Site Name']) row.siteName = dbInfo['Site Name'];
    else if (matchedMaster && matchedMaster.site_name) row.siteName = matchedMaster.site_name;
  }

  pivotData = rawRows;

  localStorage.setItem('cjhelper_pivot_data', JSON.stringify(pivotData));
  localStorage.setItem('cjhelper_pivot_text', text);

  renderPivotTable();
  if (statusBar) statusBar.textContent = `Selesai! Memproses ${pivotData.length} baris pivot.`;

  await checkStatus();
}

// Bind button actions
document.addEventListener('DOMContentLoaded', () => {
  const btnProcessPivot = document.getElementById('btn-process-pivot');
  const btnClearPivot = document.getElementById('btn-clear-pivot');
  const btnResetPivot = document.getElementById('btn-reset-pivot');

  if (btnProcessPivot) {
    btnProcessPivot.addEventListener('click', handleProcessPivot);
  }

  if (btnClearPivot) {
    btnClearPivot.addEventListener('click', () => {
      const txtPivot = document.getElementById('txt-pivot');
      if (txtPivot) txtPivot.value = '';
    });
  }

  if (btnResetPivot) {
    btnResetPivot.addEventListener('click', () => {
      const txtPivot = document.getElementById('txt-pivot');
      if (txtPivot) txtPivot.value = '';
      pivotData = [];
      localStorage.removeItem('cjhelper_pivot_data');
      localStorage.removeItem('cjhelper_pivot_text');
      renderPivotTable();
      checkStatus();
    });
  }

  const btnClearNetdrone = document.getElementById('btn-clear-netdrone');
  if (btnClearNetdrone) {
    btnClearNetdrone.addEventListener('click', () => {
      const txtNetdrone = document.getElementById('txt-netdrone');
      if (txtNetdrone) txtNetdrone.value = '';
      netdroneData = [];
      localStorage.removeItem('cjhelper_netdrone_data');
      localStorage.removeItem('cjhelper_netdrone_text');
      renderNetdroneTable();
      if (typeof updateFilterCountsInUI === 'function') updateFilterCountsInUI();
    });
  }

  renderPivotTable();
  renderNetdroneTable();
});

renderPivotTable();
renderNetdroneTable();

// --- DATA NETDRONE FEATURE ---

// Load persisted Netdrone data
try {
  const savedNetdrone = localStorage.getItem('cjhelper_netdrone_data');
  const savedNetdroneText = localStorage.getItem('cjhelper_netdrone_text');
  if (savedNetdrone) {
    netdroneData = JSON.parse(savedNetdrone);
  }
  if (savedNetdroneText && document.getElementById('txt-netdrone')) {
    document.getElementById('txt-netdrone').value = savedNetdroneText;
  }
} catch (e) {
  console.error("Gagal memuat netdroneData dari localStorage", e);
}

async function parseNetdroneData(text) {
  if (!text || !text.trim()) return [];
  const lines = text.trim().split('\n');
  if (lines.length === 0) return [];

  let headerIndex = 0;
  let headers = [];
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const cols = lines[i].split('\t').map(c => c.trim().toLowerCase());
    if (cols.includes('site_id') || cols.includes('sitecode') || cols.includes('site_name') || cols.includes('alarm_count')) {
      headerIndex = i;
      headers = cols;
      break;
    }
  }

  if (headers.length === 0) {
    headers = lines[0].split('\t').map(c => c.trim().toLowerCase());
    headerIndex = 0;
  }

  const getColVal = (cols, keywords) => {
    for (const kw of keywords) {
      const idx = headers.indexOf(kw.toLowerCase());
      if (idx !== -1 && cols[idx] !== undefined) return cols[idx].trim();
    }
    return "";
  };

  const masterSiteIds = new Set();
  (statusData || []).forEach(s => {
    if (s.new_site) masterSiteIds.add(s.new_site.trim().toUpperCase());
    if (s.old_site) masterSiteIds.add(s.old_site.trim().toUpperCase());
    if (s.site_name) masterSiteIds.add(s.site_name.trim().toUpperCase());
  });

  const parsedRows = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split('\t');

    const rawSiteId = getColVal(cols, ['site_id', 'sitecode', 'site_name']);
    if (!rawSiteId) continue;

    const siteIdMatch = rawSiteId.match(/([0-9]{2}[A-Z]{3}[0-9]{4})/i);
    const siteId = siteIdMatch ? siteIdMatch[1].toUpperCase() : rawSiteId.split('_')[0].toUpperCase();

    const siteName = getColVal(cols, ['site_name', 'sitecode', 'title']) || rawSiteId;
    const vendor = getColVal(cols, ['vendor', 'site_vendor']) || "";
    const alarmName = getColVal(cols, ['alarm_name', 'title', 'summary']) || "Full Sitedown";
    const remark = getColVal(cols, ['remark', 'remarks', 'wo_remarks', 'summary']) || "";
    const startTime = getColVal(cols, ['lastoccurrence', 'firstoccurrence', 'last_occurrence']) || "";

    let isMasterPresent = false;
    for (let mId of masterSiteIds) {
      if (mId.includes(siteId) || siteId.includes(mId)) {
        isMasterPresent = true;
        break;
      }
    }

    if (isMasterPresent) {
      parsedRows.push({
        siteId,
        siteName,
        vendor,
        alarmName,
        remark,
        startTime,
        cluster: "",
        pic: "",
        tePhone: "",
        category: "",
        siteClass: "",
        skipped: true,
        matchedDb: false,
        statusMessage: "⚠️ Skipped (Ada di Master)"
      });
      continue;
    }

    let dbRow = null;
    try {
      if (invoke) {
        dbRow = await invoke('lookup_site', { siteId: siteId });
        if (!dbRow && siteName) {
          const cleanName = siteName.split('_')[0].trim();
          if (cleanName && cleanName !== siteId) {
            dbRow = await invoke('lookup_site', { siteId: cleanName });
          }
        }
      }
    } catch (e) {
      console.warn(`Lookup site error for ${siteId}:`, e);
    }

    const hasDbMatch = dbRow && (
      dbRow['Site ID (New)'] ||
      dbRow['Old Site ID'] ||
      dbRow['Site Name'] ||
      dbRow['Cluster (MC)'] ||
      dbRow['Cluster'] ||
      dbRow['TE Name'] ||
      dbRow['FE Name'] ||
      dbRow['FME Name']
    );

    if (hasDbMatch) {
      const cluster = dbRow['Cluster (MC)'] || dbRow['Cluster'] || dbRow['CLUSTER'] || getColVal(cols, ['mc_cluster']) || "";
      const pic = dbRow['TE Name'] || dbRow['FE Name'] || dbRow['FME Name'] || dbRow['FME'] || dbRow['FE'] || getColVal(cols, ['fme_name']) || "";
      const rts = dbRow['RTS Name'] || dbRow['RTS'] || getColVal(cols, ['rts_name']) || "";
      const tePhone = dbRow['TE Phone'] || dbRow['FE Phone'] || dbRow['FME Phone'] || getColVal(cols, ['fme_phone']) || "";
      const category = dbRow['Hub Type'] || dbRow['Category'] || dbRow['CATEGORY'] || getColVal(cols, ['category']) || "";
      const siteClass = dbRow['Site Class'] || dbRow['Tier'] || getColVal(cols, ['site_class']) || "";

      parsedRows.push({
        siteId,
        siteName,
        vendor: dbRow['Vendor'] || vendor,
        alarmName: "Full Sitedown",
        remark,
        startTime,
        cluster,
        pic,
        rts,
        tePhone,
        category,
        siteClass,
        skipped: false,
        matchedDb: true,
        statusMessage: "✅ Netdrone (Matched DB)"
      });
    } else {
      parsedRows.push({
        siteId,
        siteName,
        vendor,
        alarmName,
        remark,
        startTime,
        cluster: getColVal(cols, ['mc_cluster']) || "",
        pic: getColVal(cols, ['fme_name']) || "",
        rts: getColVal(cols, ['rts_name']) || "",
        tePhone: getColVal(cols, ['fme_phone']) || "",
        category: getColVal(cols, ['category']) || "",
        siteClass: getColVal(cols, ['site_class']) || "",
        skipped: false,
        matchedDb: false,
        statusMessage: "❓ DB Tidak Ditemukan"
      });
    }
  }

  return parsedRows;
}

function renderNetdroneTable() {
  const tbody = document.getElementById('netdrone-tbody');
  const lblSummary = document.getElementById('lbl-netdrone-summary');
  if (!tbody) return;

  if (!netdroneData || netdroneData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-subtle" style="padding: 20px;">Belum ada data Netdrone diproses.</td></tr>';
    if (lblSummary) lblSummary.textContent = '0 data diproses';
    return;
  }

  const matchedCount = netdroneData.filter(d => !d.skipped && d.matchedDb).length;
  const skippedCount = netdroneData.filter(d => d.skipped).length;
  const notFoundCount = netdroneData.filter(d => !d.skipped && !d.matchedDb).length;

  if (lblSummary) {
    lblSummary.textContent = `${matchedCount} Matched DB | ${skippedCount} Skipped (Master) | ${notFoundCount} DB Tidak Ditemukan`;
  }

  const fragment = document.createDocumentFragment();
  netdroneData.forEach((row, idx) => {
    const tr = document.createElement('tr');
    let badgeClass = "bb";
    if (row.skipped) badgeClass = "ba";
    else if (row.matchedDb) badgeClass = "br";

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${row.siteId}</strong></td>
      <td>${row.siteName}</td>
      <td>${row.vendor || '-'}</td>
      <td>${row.alarmName || '-'}</td>
      <td>${row.cluster || '-'}</td>
      <td>${row.pic || '-'}</td>
      <td><span class="badge ${badgeClass}">${row.statusMessage}</span></td>
    `;
    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

// Netdrone event listeners setup
document.addEventListener('DOMContentLoaded', () => {
  const txtNetdrone = document.getElementById('txt-netdrone');
  const btnProcessNetdrone = document.getElementById('btn-process-netdrone');

  if (txtNetdrone && btnProcessNetdrone) {
    txtNetdrone.addEventListener('input', () => {
      const val = txtNetdrone.value.trim();
      if (val) {
        const lineCount = val.split('\n').filter(l => l.trim()).length;
        btnProcessNetdrone.disabled = false;
        btnProcessNetdrone.style.opacity = '1';
        btnProcessNetdrone.style.cursor = 'pointer';
        btnProcessNetdrone.textContent = `▶ PROSES NETDRONE (${lineCount} baris)`;
      } else {
        btnProcessNetdrone.disabled = true;
        btnProcessNetdrone.style.opacity = '0.5';
        btnProcessNetdrone.style.cursor = 'not-allowed';
        btnProcessNetdrone.textContent = '▶ PROSES NETDRONE (Kosong)';
      }
    });

    btnProcessNetdrone.addEventListener('click', async () => {
      const text = txtNetdrone.value.trim();
      if (!text) return;

      btnProcessNetdrone.disabled = true;
      btnProcessNetdrone.textContent = '⏳ Memproses & mencocokkan DB...';

      try {
        netdroneData = await parseNetdroneData(text);
        localStorage.setItem('cjhelper_netdrone_data', JSON.stringify(netdroneData));
        localStorage.setItem('cjhelper_netdrone_text', text);

        renderNetdroneTable();
        if (typeof updateFilterCountsInUI === 'function') updateFilterCountsInUI();
      } catch (e) {
        console.error("Error memproses Data Netdrone: ", e);
      } finally {
        const lineCount = text.split('\n').filter(l => l.trim()).length;
        btnProcessNetdrone.disabled = false;
        btnProcessNetdrone.textContent = `▶ PROSES NETDRONE (${lineCount} baris)`;
      }
    });
  }
});

// ==========================================
// WA BLAST JAPRI TE LOGIC & CONTACTS DB
// ==========================================
const btnPmWaBlast = document.getElementById('btn-pm-wa-blast');
const waBlastTeModal = document.getElementById('wa-blast-te-modal');
const btnCloseWaBlastTe = document.getElementById('btn-close-wa-blast-te');
const btnExecuteWaBlastTe = document.getElementById('btn-execute-wa-blast-te');
const chkWaBlastTeSelectAll = document.getElementById('chk-wa-blast-te-select-all');
const waBlastTeTbody = document.getElementById('wa-blast-te-tbody');
const numWaBlastTeDelay = document.getElementById('num-wa-blast-te-delay');
const waBlastTeProgressContainer = document.getElementById('wa-blast-te-progress-container');
const waBlastTeProgressStatus = document.getElementById('wa-blast-te-progress-status');
const waBlastTeProgressPercent = document.getElementById('wa-blast-te-progress-percent');
const waBlastTeProgressFill = document.getElementById('wa-blast-te-progress-fill');

// WA Blast Filter Modal Elements
const btnPmBlastFilter = document.getElementById('btn-pm-blast-filter');
const waBlastFilterModal = document.getElementById('wa-blast-filter-modal');
const btnCloseWaBlastFilter = document.getElementById('btn-close-wa-blast-filter');
const btnSaveWaBlastFilter = document.getElementById('btn-save-wa-blast-filter');

const chkFilterRemarkTrigger = document.getElementById('chk-filter-remark-trigger');
const chkFilterSitedown = document.getElementById('chk-filter-sitedown');
const chkFilterCelldown = document.getElementById('chk-filter-celldown');
const chkFilterBcch = document.getElementById('chk-filter-bcch');
const chkFilterEnva = document.getElementById('chk-filter-enva');
const chkFilterStolen = document.getElementById('chk-filter-stolen');

// TE Contacts sub-tab elements
const waTeTbody = document.getElementById('wa-te-tbody');
const waTeSearch = document.getElementById('wa-te-search');
const btnWaTeClearSearch = document.getElementById('btn-wa-te-clear-search');
const btnWaTeAdd = document.getElementById('btn-wa-te-add');
const btnWaTeSave = document.getElementById('btn-wa-te-save');
const btnWaTeImport = document.getElementById('btn-wa-te-import');
const waTeStatusLbl = document.getElementById('wa-te-status-lbl');

let currentTeGroups = {};
let savedWaTeContacts = [];

// WA Blast Filter Configuration State (Persisted in localStorage)
const defaultBlastFilterCfg = {
  filterRemarkTrigger: true, // Default ON (hanya remark fu team, follow up team, plan ts today, atau kosong)
  enableSitedown: true,      // Default ON
  enableCelldown: true,      // Default ON
  enableBcch: true,          // Default ON
  enableEnva: false,         // Default OFF per user request
  enableStolen: false,       // Default OFF per user request
  enableNetdrone: true       // Default ON for WA Blast per user request
};

let blastFilterCfg = { ...defaultBlastFilterCfg };

try {
  const savedFilter = localStorage.getItem('cjhelper_blast_filter_cfg');
  if (savedFilter) {
    blastFilterCfg = Object.assign({}, defaultBlastFilterCfg, JSON.parse(savedFilter));
  }
} catch (e) {
  console.warn("Gagal memuat blastFilterCfg dari localStorage", e);
}

function saveBlastFilterCfg() {
  localStorage.setItem('cjhelper_blast_filter_cfg', JSON.stringify(blastFilterCfg));
}

function cleanWaNumber(num) {
  if (!num) return "";
  let cleaned = num.toString().replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  if (cleaned.length < 8) return "";
  return cleaned + "@c.us";
}

function shouldSendToTe(remark) {
  if (!blastFilterCfg.filterRemarkTrigger) {
    return true; // Jika filter remark di-OFF-kan, kirim semua tanpa mengecek kata kunci
  }
  const rem = (remark || "").trim();
  if (!rem) return true; // kosong → kirim

  const keywords = ["fu team", "follow up team", "plan ts today"];
  const remLower = rem.toLowerCase();

  // Hanya kirim jika remark persis sama dengan salah satu keyword
  return keywords.some(kw => remLower === kw);
}

let siteSelectionMap = {}; // Tracks per-site selection: "siteKey" -> boolean

function getSiteKey(s) {
  const isFully = s.impact && s.impact.toLowerCase().includes('fully');
  const bcchKw = (fmtMsg && fmtMsg.key_bcch || "BCCH").toUpperCase();
  const isBcch = s.remark && s.remark.toUpperCase().includes(bcchKw);
  let type = "CELLDOWN";
  if (isFully) type = "SITEDOWN";
  else if (isBcch) type = "BCCH";
  return `${s.new_site || s.site_name}_${type}`;
}

function isSiteSelected(s) {
  const key = getSiteKey(s);
  if (siteSelectionMap.hasOwnProperty(key)) {
    return siteSelectionMap[key];
  }
  if (s.is_netdrone) return true; // Netdrone matched DB sites are ALWAYS enabled for Japri TE blast!
  return shouldSendToTe(s.remark);
}

function getTeMessageItemCount(sites, cluster) {
  const bcchKw = (fmtMsg && fmtMsg.key_bcch || "BCCH").toUpperCase();
  const sitedownFiltered = [];
  const celldownFiltered = [];
  const celldownBcchFiltered = [];

  sites.forEach(s => {
    const isFully = s.is_netdrone || (s.impact && (s.impact.toLowerCase().includes('fully') || s.impact.toLowerCase().includes('sitedown')));
    const isBcch = !s.is_netdrone && s.remark && s.remark.toUpperCase().includes(bcchKw);
    if (isFully) {
      if (blastFilterCfg.enableSitedown && isSiteSelected(s)) sitedownFiltered.push(s);
    } else if (isBcch) {
      if (blastFilterCfg.enableBcch && isSiteSelected(s)) celldownBcchFiltered.push(s);
    } else {
      if (blastFilterCfg.enableCelldown && isSiteSelected(s)) celldownFiltered.push(s);
    }
  });

  const clusterUpper = (cluster || "").toUpperCase();
  const stollenRows = blastFilterCfg.enableStolen ? (pivotData || []).filter(r => (r.monitoring === 'STOLLEN' || r.monitoring === 'CABLE STOLLEN') && r.cluster && r.cluster.toUpperCase() === clusterUpper) : [];
  const envaAlarmRows = blastFilterCfg.enableEnva ? (pivotData || []).filter(r => (r.monitoring.includes('POWER') || r.monitoring.includes('ENVA')) && !r.monitoring.includes('NETECO') && r.cluster && r.cluster.toUpperCase() === clusterUpper) : [];
  const envaNetecoRows = blastFilterCfg.enableEnva ? (pivotData || []).filter(r => r.monitoring.includes('NETECO') && r.cluster && r.cluster.toUpperCase() === clusterUpper) : [];

  return {
    total: sitedownFiltered.length + celldownFiltered.length + celldownBcchFiltered.length + stollenRows.length + envaAlarmRows.length + envaNetecoRows.length
  };
}

function convertPivotRowToSiteItem(row) {
  let realSiteId = row.newId || "";
  let realSiteName = row.siteName || "";

  const siteIdPattern = /([0-9]{2}[A-Z]{3}[0-9]{4})/i;
  let match = (row.siteName || "").match(siteIdPattern) || (row.newId || "").match(siteIdPattern) || (row.rowLabels || "").match(siteIdPattern);
  if (match) {
    realSiteId = match[1].toUpperCase();
  }

  if (realSiteName && realSiteId && realSiteName.toUpperCase().startsWith(realSiteId + "_")) {
    realSiteName = realSiteName.substring(realSiteId.length + 1);
  }

  const matchedMaster = (typeof statusData !== 'undefined' && statusData) ? statusData.find(s => s.new_site && s.new_site.toUpperCase() === realSiteId.toUpperCase()) : null;

  let rtsVal = row.rtsName || (matchedMaster && matchedMaster.rts) || row.rts || row.teName || row.newTe || "—";
  let picVal = row.teName || (matchedMaster && matchedMaster.pic) || row.newTe || "—";

  let fmOffice = row.fmOffice || (matchedMaster && matchedMaster.cluster) || row.cluster || "—";
  if (fmOffice && fmOffice.toUpperCase().startsWith("MC-")) {
    fmOffice = fmOffice.substring(3).trim();
  }

  if (!fmOffice || fmOffice === "—" || fmOffice === "0" || fmOffice.toUpperCase() === rtsVal.toUpperCase() || fmOffice.toUpperCase() === picVal.toUpperCase()) {
    fmOffice = (matchedMaster && matchedMaster.cluster) || row.cluster || "—";
    if (fmOffice && fmOffice.toUpperCase().startsWith("MC-")) {
      fmOffice = fmOffice.substring(3).trim();
    }
  }

  let resolvedClass = (matchedMaster && matchedMaster.site_class && !matchedMaster.site_class.toUpperCase().includes('CRITICAL') ? matchedMaster.site_class : "") ||
                      (row.siteClass && !row.siteClass.toUpperCase().includes('CRITICAL') ? row.siteClass : "") ||
                      (matchedMaster && matchedMaster.category && !matchedMaster.category.toUpperCase().includes('CRITICAL') ? matchedMaster.category : "") || "";

  if (!resolvedClass || resolvedClass === "A" || resolvedClass === "B" || resolvedClass === "C" || resolvedClass.length <= 2 || resolvedClass.toUpperCase().includes('CRITICAL')) {
    resolvedClass = "END SITE";
  }

  return {
    impact: 'Full Sitedown',
    status: 'DOWN',
    cluster: fmOffice,
    site_name: realSiteName || row.siteName || realSiteId || "—",
    old_site: "",
    new_site: realSiteId || "—",
    start_time: row.tanggal || row.start_time || "—",
    start_timestamp: 0,
    remark: row.remark || row.duration || row.aging || row.monitoring || "",
    category: resolvedClass,
    site_class: resolvedClass,
    rts: rtsVal,
    pic: picVal,
    vendor: row.system || "HUAWEI",
    is_pivot: true
  };
}

function formatStollenLine(row, fmtObj) {
  const item = convertPivotRowToSiteItem(row);
  item.category = "STOLEN BATTERY";
  return formatSingleLine(item, fmtObj || getActiveFmt()).waLine;
}

function formatCableStollenLine(row, fmtObj) {
  const item = convertPivotRowToSiteItem(row);
  item.category = "STOLEN CABLE";
  return formatSingleLine(item, fmtObj || getActiveFmt()).waLine;
}

function formatEnvaLine(row, fmtObj) {
  const item = convertPivotRowToSiteItem(row);
  return formatSingleLine(item, fmtObj || getActiveFmt()).waLine;
}

function generateTeMessage(teName, sites, cluster) {
  const bcchKw = (fmtMsg && fmtMsg.key_bcch || "BCCH").toUpperCase();
  const sitedownFiltered = [];
  const celldownFiltered = [];
  const celldownBcchFiltered = [];

  sites.forEach(s => {
    const isFully = s.is_netdrone || (s.impact && (s.impact.toLowerCase().includes('fully') || s.impact.toLowerCase().includes('sitedown')));
    const isBcch = !s.is_netdrone && s.remark && s.remark.toUpperCase().includes(bcchKw);
    if (isFully) {
      if (blastFilterCfg.enableSitedown && isSiteSelected(s)) sitedownFiltered.push(s);
    } else if (isBcch) {
      if (blastFilterCfg.enableBcch && isSiteSelected(s)) celldownBcchFiltered.push(s);
    } else {
      if (blastFilterCfg.enableCelldown && isSiteSelected(s)) celldownFiltered.push(s);
    }
  });

  const clusterUpper = (cluster || "").toUpperCase();
  const stollenRows = blastFilterCfg.enableStolen ? (pivotData || []).filter(r => r.monitoring === 'STOLLEN' && r.cluster && r.cluster.toUpperCase() === clusterUpper) : [];
  const cableStollenRows = blastFilterCfg.enableStolen ? (pivotData || []).filter(r => r.monitoring === 'CABLE STOLLEN' && r.cluster && r.cluster.toUpperCase() === clusterUpper) : [];
  const envaAlarmRows = blastFilterCfg.enableEnva ? (pivotData || []).filter(r => (r.monitoring.includes('POWER') || r.monitoring.includes('ENVA')) && !r.monitoring.includes('NETECO') && r.cluster && r.cluster.toUpperCase() === clusterUpper) : [];
  const envaNetecoRows = blastFilterCfg.enableEnva ? (pivotData || []).filter(r => r.monitoring.includes('NETECO') && r.cluster && r.cluster.toUpperCase() === clusterUpper) : [];

  const parts = [];

  if (stollenRows.length > 0) {
    parts.push(`*STOLEN BATTERY :: ${stollenRows.length}*`);
    stollenRows.forEach(row => parts.push(formatStollenLine(row)));
    parts.push("");
  }

  if (cableStollenRows.length > 0) {
    parts.push(`*STOLEN CABLE :: ${cableStollenRows.length}*`);
    cableStollenRows.forEach(row => parts.push(formatCableStollenLine(row)));
    parts.push("");
  }

  if (sitedownFiltered.length > 0) {
    parts.push(`*SITEDOWN :: ${sitedownFiltered.length}*`);
    sitedownFiltered.forEach(s => parts.push(formatSingleLine(s, fmtMsg).waLine));
    parts.push("");
  }

  if (celldownFiltered.length > 0) {
    parts.push(`*CELLDOWN :: ${celldownFiltered.length}*`);
    celldownFiltered.forEach(s => parts.push(formatSingleLine(s, fmtMsg).waLine));
    parts.push("");
  }

  if (celldownBcchFiltered.length > 0) {
    parts.push(`*CELLDOWN BCCH :: ${celldownBcchFiltered.length}*`);
    celldownBcchFiltered.forEach(s => parts.push(formatSingleLine(s, fmtMsg).waLine));
    parts.push("");
  }

  if (envaAlarmRows.length > 0) {
    parts.push(`*ENVA ALARM :: ${envaAlarmRows.length}*`);
    envaAlarmRows.forEach(row => parts.push(formatEnvaLine(row)));
    parts.push("");
  }

  if (envaNetecoRows.length > 0) {
    parts.push(`*ENVA NETECO :: ${envaNetecoRows.length}*`);
    envaNetecoRows.forEach(row => parts.push(formatEnvaLine(row)));
    parts.push("");
  }

  return parts.join("\n").trim();
}

function updateContactDashboardCards() {
  const contacts = activeRegionFilter === 'ALL'
    ? savedWaTeContacts
    : savedWaTeContacts.filter(c => {
        return getSiteRegion({ cluster: c.cluster, site_name: '', remark: '', pic: c.name }) === activeRegionFilter;
      });

  const total = contacts.length;
  const valid = contacts.filter(c => cleanWaNumber(c.phone)).length;
  const unset = total - valid;
  const clusters = new Set(contacts.map(c => (c.cluster || "").trim().toUpperCase()).filter(Boolean)).size;

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl('dash-contact-total', total);
  setEl('dash-contact-valid', valid);
  setEl('dash-contact-unset', unset);
  setEl('dash-contact-clusters', clusters);
}

// Bind Region Switcher Events in Dashboard
document.addEventListener('DOMContentLoaded', () => {
  const regBtns = document.querySelectorAll('#dash-region-filter .seg-btn');
  regBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      regBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      activeRegionFilter = e.currentTarget.dataset.region || 'ALL';
      checkStatus();
      updateContactDashboardCards();
    });
  });
});

async function loadWaTeContacts() {
  try {
    const res = await invoke('get_wa_te_contacts');
    savedWaTeContacts = res.contacts || [];
    updateContactDashboardCards();
  } catch (e) {
    console.warn("Gagal memuat kontak TE:", e);
  }
}

function renderWaTeContactsTable(filterText = "") {
  if (!waTeTbody) return;
  waTeTbody.innerHTML = '';

  const filtered = savedWaTeContacts.filter(c => {
    const term = filterText.toLowerCase().trim();
    if (!term) return true;
    return (c.name || "").toLowerCase().includes(term) || (c.cluster || "").toLowerCase().includes(term);
  });

  if (filtered.length === 0) {
    waTeTbody.innerHTML = '<tr><td colspan="4" class="text-center text-subtle py-4">Belum ada kontak disimpan atau pencarian tidak cocok.</td></tr>';
    return;
  }

  filtered.forEach((c, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="fi wa-te-edit-name" value="${c.name || ''}" style="background:transparent; border:none; color:var(--txt-1); width:100%;"></td>
      <td><input type="text" class="fi wa-te-edit-cluster" value="${c.cluster || ''}" style="background:transparent; border:none; color:var(--txt-1); width:100%;"></td>
      <td><input type="text" class="fi wa-te-edit-phone" value="${c.phone || ''}" style="background:transparent; border:none; color:var(--txt-1); width:100%;"></td>
      <td class="text-center">
        <button class="tbtn-clr btn-wa-te-delete" style="padding:2px 8px; font-size:11px; background:var(--red-d); color:var(--red); border-color:rgba(255,79,94,0.2);">Hapus</button>
      </td>
    `;

    // Live update in-memory array on edit
    tr.querySelector('.wa-te-edit-name').addEventListener('input', (e) => {
      c.name = e.target.value.trim();
    });
    tr.querySelector('.wa-te-edit-cluster').addEventListener('input', (e) => {
      c.cluster = e.target.value.trim();
    });
    tr.querySelector('.wa-te-edit-phone').addEventListener('input', (e) => {
      c.phone = e.target.value.trim();
    });

    tr.querySelector('.btn-wa-te-delete').addEventListener('click', () => {
      const actualIdx = savedWaTeContacts.indexOf(c);
      if (actualIdx !== -1) {
        savedWaTeContacts.splice(actualIdx, 1);
        renderWaTeContactsTable(waTeSearch ? waTeSearch.value : "");
      }
    });

    waTeTbody.appendChild(tr);
  });
}

// Bind navigation hook for TE Contacts Tab
const tabOthersNavBtns = document.querySelectorAll('#tab-others .tb');
tabOthersNavBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.id.replace('subbtn-', 'subtab-');
    if (targetId === 'subtab-wa-te') {
      loadWaTeContacts().then(() => renderWaTeContactsTable());
    }
  });
});

// Implement Contacts Tab actions
if (waTeSearch) {
  waTeSearch.addEventListener('input', (e) => {
    renderWaTeContactsTable(e.target.value);
  });
}

if (btnWaTeClearSearch) {
  btnWaTeClearSearch.addEventListener('click', () => {
    if (waTeSearch) waTeSearch.value = "";
    renderWaTeContactsTable();
  });
}

if (btnWaTeAdd) {
  btnWaTeAdd.addEventListener('click', () => {
    const inpName = document.getElementById('wa-te-input-name');
    const inpCluster = document.getElementById('wa-te-input-cluster');
    const inpPhone = document.getElementById('wa-te-input-phone');

    const name = inpName.value.trim();
    const cluster = inpCluster.value.trim();
    const phone = inpPhone.value.trim();

    if (!name || !cluster || !phone) {
      alert("Harap isi semua kolom Tambah Kontak!");
      return;
    }

    const exists = savedWaTeContacts.some(c =>
      c.name.trim().toUpperCase() === name.toUpperCase() &&
      c.cluster.trim().toUpperCase() === cluster.toUpperCase()
    );

    if (exists) {
      alert(`Kontak dengan nama ${name} di cluster ${cluster} sudah ada!`);
      return;
    }

    savedWaTeContacts.push({ name, cluster, phone });
    renderWaTeContactsTable(waTeSearch ? waTeSearch.value : "");

    inpName.value = '';
    inpCluster.value = '';
    inpPhone.value = '';
  });
}

if (btnWaTeSave) {
  btnWaTeSave.addEventListener('click', async () => {
    try {
      btnWaTeSave.disabled = true;
      btnWaTeSave.textContent = "⏳ Menyimpan...";

      savedWaTeContacts = savedWaTeContacts.filter(c => c.name.trim() && c.cluster.trim() && c.phone.trim());

      await invoke('save_wa_te_contacts', { contacts: savedWaTeContacts });

      if (waTeStatusLbl) {
        waTeStatusLbl.textContent = "✅ Database kontak TE berhasil disimpan!";
        waTeStatusLbl.style.color = "var(--grn)";
        setTimeout(() => waTeStatusLbl.textContent = "", 3000);
      }
    } catch (e) {
      alert("Gagal menyimpan kontak: " + e);
    } finally {
      btnWaTeSave.disabled = false;
      btnWaTeSave.textContent = "Simpan Perubahan";
    }
  });
}

if (btnWaTeImport) {
  btnWaTeImport.addEventListener('click', async () => {
    try {
      const selectedPath = await invoke('pick_db_file');
      if (selectedPath) {
        if (waTeStatusLbl) {
          waTeStatusLbl.textContent = "Mengimpor data Excel...";
          waTeStatusLbl.style.color = "var(--amb)";
        }

        await new Promise(r => setTimeout(r, 50));

        const count = await invoke('load_te_contacts_excel', { path: selectedPath });

        if (waTeStatusLbl) {
          waTeStatusLbl.textContent = `✅ Berhasil mengimpor ${count} kontak TE!`;
          waTeStatusLbl.style.color = "var(--grn)";
        }

        await loadWaTeContacts();
        renderWaTeContactsTable(waTeSearch ? waTeSearch.value : "");

        setTimeout(() => { if (waTeStatusLbl) waTeStatusLbl.textContent = ""; }, 4000);
      }
    } catch (err) {
      alert("Gagal mengimpor Excel: " + err);
      if (waTeStatusLbl) waTeStatusLbl.textContent = "";
    }
  });
}

// Helper for syncing TE contact when editing a site in Database Lookup
async function syncTeContactFromSite(editData) {
  if (!editData || !editData.te_name) return;
  const teName = editData.te_name.trim();
  const tePhone = (editData.te_phone || "").trim();
  const cluster = (editData.cluster || editData.fm_office || "").trim();

  if (!teName || !tePhone) return;

  const existing = savedWaTeContacts.find(c =>
    (c.name || "").trim().toUpperCase() === teName.toUpperCase() &&
    (c.cluster || "").trim().toUpperCase() === cluster.toUpperCase()
  );

  if (existing) {
    existing.phone = tePhone;
  } else {
    savedWaTeContacts.push({ name: teName, cluster, phone: tePhone });
  }

  try {
    await invoke('save_wa_te_contacts', { contacts: savedWaTeContacts });
    updateContactDashboardCards();
    if (typeof renderWaTeContactsTable === 'function') {
      renderWaTeContactsTable(typeof waTeSearch !== 'undefined' && waTeSearch ? waTeSearch.value : "");
    }
  } catch (e) {
    console.warn("Auto-sync TE contact failed:", e);
  }
}

// ==========================================
// HANDOVER / PERGANTIAN TE MASSAL
// ==========================================
const btnDashHandoverTe = document.getElementById('btn-dash-handover-te');
const btnWaTeHandover = document.getElementById('btn-wa-te-handover');
const modalHandoverTe = document.getElementById('modal-handover-te');
const btnCloseHandoverX = document.getElementById('btn-close-handover-x');
const btnCancelHandover = document.getElementById('btn-cancel-handover');
const btnExecuteHandover = document.getElementById('btn-execute-handover');
const selHandoverOldTe = document.getElementById('sel-handover-old-te');
const inpHandoverNewTe = document.getElementById('inp-handover-new-te');
const inpHandoverNewPhone = document.getElementById('inp-handover-new-phone');
const selHandoverCluster = document.getElementById('sel-handover-cluster');
const handoverSummaryBox = document.getElementById('handover-summary-box');

function openHandoverTeModal() {
  if (!modalHandoverTe || !selHandoverOldTe) return;

  // Gather all unique TE names from savedWaTeContacts, statusData, and pivotData
  const namesSet = new Set();
  (savedWaTeContacts || []).forEach(c => {
    const n = (c.name || "").trim();
    if (n && !n.startsWith("[") && n.toUpperCase() !== "UNKNOWN TE") namesSet.add(n);
  });

  if (typeof statusData !== 'undefined' && statusData) {
    statusData.forEach(s => {
      const n = (s.pic || "").trim();
      if (n && !n.startsWith("[") && n.toUpperCase() !== "UNKNOWN TE" && n !== "—" && n !== "0") namesSet.add(n);
    });
  }

  const sortedNames = Array.from(namesSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  selHandoverOldTe.innerHTML = '<option value="">-- Pilih TE Lama yang Diganti --</option>';
  sortedNames.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    selHandoverOldTe.appendChild(opt);
  });

  inpHandoverNewTe.value = '';
  inpHandoverNewPhone.value = '';
  selHandoverCluster.innerHTML = '<option value="ALL">Semua Cluster (Global Reassign)</option>';
  handoverSummaryBox.textContent = 'Pilih TE lama untuk melihat estimasi site yang terdampak.';

  modalHandoverTe.classList.remove('hidden');
  modalHandoverTe.style.display = 'flex';
}

function closeHandoverTeModal() {
  if (!modalHandoverTe) return;
  modalHandoverTe.classList.add('hidden');
  modalHandoverTe.style.display = 'none';
}

if (btnDashHandoverTe) btnDashHandoverTe.addEventListener('click', openHandoverTeModal);
if (btnWaTeHandover) btnWaTeHandover.addEventListener('click', openHandoverTeModal);
if (btnCloseHandoverX) btnCloseHandoverX.addEventListener('click', closeHandoverTeModal);
if (btnCancelHandover) btnCancelHandover.addEventListener('click', closeHandoverTeModal);

if (selHandoverOldTe) {
  selHandoverOldTe.addEventListener('change', () => {
    const oldName = selHandoverOldTe.value;
    if (!oldName) {
      selHandoverCluster.innerHTML = '<option value="ALL">Semua Cluster (Global Reassign)</option>';
      handoverSummaryBox.textContent = 'Pilih TE lama untuk melihat estimasi site yang terdampak.';
      return;
    }

    // Find clusters associated with this TE
    const clustersSet = new Set();
    let contactPhone = "";

    (savedWaTeContacts || []).forEach(c => {
      if ((c.name || "").trim().toUpperCase() === oldName.toUpperCase()) {
        if (c.cluster) clustersSet.add(c.cluster.trim());
        if (!contactPhone && c.phone) contactPhone = c.phone.trim();
      }
    });

    let siteCount = 0;
    if (typeof statusData !== 'undefined' && statusData) {
      statusData.forEach(s => {
        if ((s.pic || "").trim().toUpperCase() === oldName.toUpperCase()) {
          siteCount++;
          if (s.cluster) clustersSet.add(s.cluster.trim());
        }
      });
    }

    selHandoverCluster.innerHTML = '<option value="ALL">Semua Cluster (Global Reassign)</option>';
    Array.from(clustersSet).sort().forEach(cl => {
      const opt = document.createElement('option');
      opt.value = cl;
      opt.textContent = `Cluster: ${cl}`;
      selHandoverCluster.appendChild(opt);
    });

    handoverSummaryBox.innerHTML = `
      <strong>Terpilih:</strong> ${oldName}<br>
      • Kontak WA terdaftar: <b>${clustersSet.size || 1} cluster</b> ${contactPhone ? `(No lama: ${contactPhone})` : ''}<br>
      • Site aktif di memory: <b>${siteCount} site</b>
    `;
  });
}

if (btnExecuteHandover) {
  btnExecuteHandover.addEventListener('click', async () => {
    const oldTeName = selHandoverOldTe.value;
    const newTeName = inpHandoverNewTe.value.trim();
    const newTePhone = inpHandoverNewPhone.value.trim();
    const targetCluster = selHandoverCluster.value;

    if (!oldTeName) {
      alert("Harap pilih TE lama yang akan diganti.");
      return;
    }
    if (!newTeName) {
      alert("Harap masukkan nama TE baru.");
      return;
    }

    const confirmMsg = `Konfirmasi Pergantian TE:\n\n` +
      `• TE Lama: ${oldTeName}\n` +
      `• TE Baru: ${newTeName}\n` +
      `• Nomor WA Baru: ${newTePhone || '(tidak diubah)'}\n` +
      `• Cakupan: ${targetCluster === 'ALL' ? 'Semua Cluster' : targetCluster}\n\n` +
      `Lanjutkan proses handover?`;

    if (!confirm(confirmMsg)) return;

    btnExecuteHandover.disabled = true;
    btnExecuteHandover.textContent = "⏳ Memproses Handover...";

    try {
      const res = await invoke('reassign_te_db', {
        oldTeName,
        newTeName,
        newTePhone,
        targetCluster: targetCluster === 'ALL' ? null : targetCluster
      });

      // User requirement: JSON also saves changes from Handover TE
      if (typeof SiteChangesManager !== 'undefined' && res && res.reassigned_sites && Array.isArray(res.reassigned_sites)) {
        SiteChangesManager.recordBulkHandover(
          res.reassigned_sites,
          `Handover TE Massal: ${oldTeName} ➔ ${newTeName} (${targetCluster === 'ALL' ? 'Semua Cluster' : targetCluster})`
        );
      }

      // Update in-memory statusData if present
      if (typeof statusData !== 'undefined' && statusData) {
        statusData.forEach(s => {
          if ((s.pic || "").trim().toUpperCase() === oldTeName.toUpperCase()) {
            if (targetCluster === 'ALL' || (s.cluster || "").trim().toUpperCase() === targetCluster.toUpperCase()) {
              s.pic = newTeName;
              if (newTePhone) s.te_phone = newTePhone;
            }
          }
        });
        if (typeof renderPmCards === 'function') renderPmCards();
        if (typeof renderFilterSiteTables === 'function') renderFilterSiteTables();
      }

      // Reload contacts
      await loadWaTeContacts();
      if (typeof renderWaTeContactsTable === 'function') {
        renderWaTeContactsTable(typeof waTeSearch !== 'undefined' && waTeSearch ? waTeSearch.value : "");
      }
      updateContactDashboardCards();

      closeHandoverTeModal();

      alert(`✅ Handover TE Berhasil!\n\n` +
        `• ${res.updated_sites || 0} site di database aktif ter-update.\n` +
        `• ${res.updated_contacts || 0} kontak WhatsApp ter-update.\n` +
        `Semua site '${oldTeName}' kini dialihkan ke '${newTeName}'.`);

    } catch (err) {
      alert("Gagal melakukan handover TE: " + err);
    } finally {
      btnExecuteHandover.disabled = false;
      btnExecuteHandover.textContent = "Terapkan Pergantian";
    }
  });
}

// ==========================================
// SITE CHANGES & OVERRIDES MANAGER (.JSON)
// ==========================================
const SiteChangesManager = {
  siteOverrides: {}, // Key: uppercase site_id -> { site_id, site_name, cluster, te_name, te_phone, old_te, old_phone, note, updated_at, fields }
  handoverHistory: [], // Array of { id, site_id, site_name, cluster, old_te, old_phone, new_te, new_phone, note, timestamp }
  lastLoadedFileName: "",

  init() {
    try {
      const saved = localStorage.getItem('cjhelper_site_changes_autosave');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.overrides && typeof parsed.overrides === 'object') {
          this.siteOverrides = parsed.overrides;
        }
        if (Array.isArray(parsed.handovers)) {
          this.handoverHistory = parsed.handovers;
        }
      }
    } catch (e) {
      console.warn("Gagal membaca autosave perubahan site:", e);
    }
    this.updateDashboardBadge();
    this.renderHistoryTable();
  },

  persistAutosave() {
    try {
      localStorage.setItem('cjhelper_site_changes_autosave', JSON.stringify({
        updated_at: new Date().toISOString(),
        overrides: this.siteOverrides,
        handovers: this.handoverHistory
      }));
    } catch (e) {
      console.warn("Gagal menyimpan autosave:", e);
    }
  },

  recordHandover(record) {
    if (!record || !record.site_id) return;
    const sid = record.site_id.trim().toUpperCase();

    // Add or update override
    this.siteOverrides[sid] = {
      site_id: sid,
      site_name: record.site_name || (this.siteOverrides[sid] && this.siteOverrides[sid].site_name) || "",
      cluster: record.cluster || (this.siteOverrides[sid] && this.siteOverrides[sid].cluster) || "",
      te_name: record.new_te || "",
      te_phone: record.new_phone || "",
      old_te: record.old_te || "",
      old_phone: record.old_phone || "",
      note: record.note || "",
      updated_at: new Date().toISOString()
    };

    // Prepend to history log
    this.handoverHistory.unshift({
      id: "ho_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      site_id: sid,
      site_name: record.site_name || "",
      cluster: record.cluster || "",
      old_te: record.old_te || "",
      old_phone: record.old_phone || "",
      new_te: record.new_te || "",
      new_phone: record.new_phone || "",
      note: record.note || "",
      timestamp: record.timestamp || new Date().toLocaleString()
    });

    this.persistAutosave();
    this.syncActiveStatusData(sid, record.new_te, record.new_phone);
    this.updateDashboardBadge();
    this.renderHistoryTable();
  },

  recordBulkHandover(records, bulkNote = "Handover TE Massal") {
    if (!Array.isArray(records) || records.length === 0) return;
    const now = new Date().toLocaleString();

    records.forEach(r => {
      const sid = (r.site_id || "").trim().toUpperCase();
      if (!sid) return;

      this.siteOverrides[sid] = {
        site_id: sid,
        site_name: r.site_name || (this.siteOverrides[sid] && this.siteOverrides[sid].site_name) || "",
        cluster: r.cluster || (this.siteOverrides[sid] && this.siteOverrides[sid].cluster) || "",
        te_name: r.new_te || "",
        te_phone: r.new_te_phone || "",
        old_te: r.old_te || "",
        old_phone: r.old_te_phone || "",
        note: bulkNote,
        updated_at: new Date().toISOString()
      };

      this.handoverHistory.unshift({
        id: "ho_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        site_id: sid,
        site_name: r.site_name || "",
        cluster: r.cluster || "",
        old_te: r.old_te || "",
        old_phone: r.old_te_phone || "",
        new_te: r.new_te || "",
        new_phone: r.new_te_phone || "",
        note: bulkNote,
        timestamp: now
      });

      this.syncActiveStatusData(sid, r.new_te, r.new_te_phone);
    });

    this.persistAutosave();
    this.updateDashboardBadge();
    this.renderHistoryTable();
  },

  recordSiteEdit(siteId, editData) {
    if (!siteId) return;
    const sid = siteId.trim().toUpperCase();
    const existing = this.siteOverrides[sid] || {};

    this.siteOverrides[sid] = {
      site_id: sid,
      site_name: editData.site_name || existing.site_name || "",
      cluster: editData.cluster || existing.cluster || "",
      te_name: editData.te_name || existing.te_name || "",
      te_phone: editData.te_phone || existing.te_phone || "",
      old_te: existing.old_te || "",
      old_phone: existing.old_phone || "",
      note: "Edit Database Form",
      updated_at: new Date().toISOString(),
      fields: {
        ...(existing.fields || {}),
        SITE_NAME: editData.site_name,
        MC: editData.cluster,
        VENDOR: editData.vendor,
        TE_NAME: editData.te_name,
        TE_PHONE: editData.te_phone,
        TE_EMAIL: editData.te_email,
        CME_NAME: editData.cme_name,
        CME_PHONE: editData.cme_phone,
        CME_EMAIL: editData.cme_email,
        FM_OFFICE: editData.fm_office,
        HOST_NAME: editData.host_name,
        TLP: editData.tlp
      }
    };

    this.persistAutosave();
    if (editData.te_name) {
      this.syncActiveStatusData(sid, editData.te_name, editData.te_phone);
    }
    this.updateDashboardBadge();
    this.renderHistoryTable();
  },

  syncActiveStatusData(siteId, newTe, newPhone) {
    if (typeof statusData !== 'undefined' && Array.isArray(statusData)) {
      let modified = false;
      statusData.forEach(s => {
        if ((s.new_site || "").trim().toUpperCase() === siteId) {
          if (newTe) s.pic = newTe;
          if (newPhone) s.te_phone = newPhone;
          modified = true;
        }
      });
      if (modified) {
        if (typeof renderStatus === 'function') renderStatus();
        if (typeof renderPmCards === 'function') renderPmCards();
        if (typeof renderFilterSiteTables === 'function') renderFilterSiteTables();
      }
    }
  },

  async applyToMemory(silent = false, isAutoOnLoad = false) {
    const total = Object.keys(this.siteOverrides).length;
    if (total === 0) {
      if (!silent) alert("Belum ada data perubahan site yang tersimpan.");
      return;
    }

    try {
      const res = await invoke('apply_site_changes', {
        changes: { overrides: this.siteOverrides }
      });

      // Update in-memory statusData
      Object.keys(this.siteOverrides).forEach(sid => {
        const ov = this.siteOverrides[sid];
        this.syncActiveStatusData(sid, ov.te_name, ov.te_phone);
      });

      this.updateDashboardBadge();
      this.renderHistoryTable();

      const applied = res.applied_count || 0;
      const notFound = res.not_found ? res.not_found.length : 0;

      if (!silent) {
        let msg = `✅ Berhasil menerapkan ${applied} perubahan site ke memory!`;
        if (notFound > 0) {
          msg += `\n⚠️ ${notFound} site tidak ditemukan di Master DB (mungkin beda database).`;
        }
        alert(msg);
      } else if (isAutoOnLoad && applied > 0) {
        console.log(`[Auto-Apply] ${applied} perubahan site otomatis diterapkan dari perubahan tersimpan.`);
      }
    } catch (err) {
      if (!silent) {
        alert("Gagal menerapkan perubahan ke database: " + err);
      } else {
        console.warn("Gagal auto-apply perubahan site:", err);
      }
    }
  },

  async saveToJsonFile() {
    const count = Object.keys(this.siteOverrides).length;
    if (count === 0 && this.handoverHistory.length === 0) {
      alert("Belum ada data site yang diubah. Lakukan Handover Site / BTS atau Edit Database terlebih dahulu.");
      return;
    }

    const payload = {
      app: "CJHelper",
      schema_version: 1,
      exported_at: new Date().toISOString(),
      stats: {
        total_modified_sites: count,
        total_handover_logs: this.handoverHistory.length
      },
      handovers: this.handoverHistory,
      overrides: this.siteOverrides
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const defaultName = `cjhelper_site_changes_${dateStr}.json`;

    try {
      const savedPath = await invoke('save_changes_json_file', {
        jsonContent: jsonStr,
        defaultFilename: defaultName
      });

      if (savedPath) {
        const fName = savedPath.split(/[\\/]/).pop();
        this.lastLoadedFileName = fName;
        this.updateDashboardBadge();
        alert(`✅ Berhasil menyimpan file perubahan:\n${savedPath}\n\nTotal: ${count} site tersimpan.`);
      }
    } catch (err) {
      alert("Gagal menyimpan file .json: " + err);
    }
  },

  async loadFromJsonFile() {
    try {
      const selectedPath = await invoke('pick_json_file');
      if (!selectedPath) return;

      const fName = selectedPath.split(/[\\/]/).pop();
      const content = await invoke('read_json_file', { path: selectedPath });
      const parsed = JSON.parse(content);

      if (!parsed || (typeof parsed !== 'object')) {
        throw new Error("Format file JSON tidak valid.");
      }

      let loadedOverrides = {};
      let loadedHandovers = [];

      if (parsed.overrides && typeof parsed.overrides === 'object') {
        loadedOverrides = parsed.overrides;
      } else if (parsed.site_overrides && typeof parsed.site_overrides === 'object') {
        loadedOverrides = parsed.site_overrides;
      } else if (!parsed.handovers && typeof parsed === 'object') {
        loadedOverrides = parsed;
      }

      if (Array.isArray(parsed.handovers)) {
        loadedHandovers = parsed.handovers;
      } else if (Array.isArray(parsed.handover_records)) {
        loadedHandovers = parsed.handover_records;
      }

      // Merge into active state
      Object.keys(loadedOverrides).forEach(sid => {
        const norm = sid.trim().toUpperCase();
        this.siteOverrides[norm] = loadedOverrides[sid];
      });

      // Merge handovers
      const existingIds = new Set(this.handoverHistory.map(h => h.id || h.site_id + h.timestamp));
      loadedHandovers.forEach(h => {
        const idKey = h.id || (h.site_id + h.timestamp);
        if (!existingIds.has(idKey)) {
          this.handoverHistory.push(h);
        }
      });

      this.lastLoadedFileName = fName;
      this.persistAutosave();

      // Apply to memory
      await this.applyToMemory(false);

    } catch (err) {
      alert("Gagal memuat file .json: " + err);
    }
  },

  revertOverride(siteId) {
    if (!siteId) return;
    const sid = siteId.trim().toUpperCase();
    if (!confirm(`Batalkan perubahan untuk site ${sid}? Site akan kembali ke data Master DB saat di-reload.`)) return;

    delete this.siteOverrides[sid];
    this.handoverHistory = this.handoverHistory.filter(h => (h.site_id || "").trim().toUpperCase() !== sid);

    this.persistAutosave();
    this.updateDashboardBadge();
    this.renderHistoryTable();

    alert(`Perubahan untuk site ${sid} telah dihapus dari daftar override.`);
  },

  resetAll() {
    const total = Object.keys(this.siteOverrides).length;
    if (total === 0) {
      alert("Tidak ada perubahan yang aktif.");
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus SEMUA (${total}) perubahan site yang tersimpan?`)) return;

    this.siteOverrides = {};
    this.handoverHistory = [];
    this.lastLoadedFileName = "";
    localStorage.removeItem('cjhelper_site_changes_autosave');

    this.updateDashboardBadge();
    this.renderHistoryTable();
    alert("Seluruh data perubahan site berhasil direset.");
  },

  updateDashboardBadge() {
    const count = Object.keys(this.siteOverrides).length;
    const countEl = document.getElementById('dash-changes-count');
    const fileEl = document.getElementById('lbl-dash-changes-filename');
    const badgeEl = document.getElementById('hos-history-badge');

    if (countEl) countEl.textContent = count;
    if (fileEl) {
      if (this.lastLoadedFileName) {
        fileEl.textContent = `📁 ${this.lastLoadedFileName}`;
        fileEl.style.color = "var(--grn)";
        fileEl.title = `${this.lastLoadedFileName} (${count} site)`;
      } else if (count > 0) {
        fileEl.textContent = `${count} site diubah`;
        fileEl.style.color = "#c084fc";
        fileEl.title = `${count} site diubah di sesi ini`;
      } else {
        fileEl.textContent = "0 diubah";
        fileEl.style.color = "var(--txt-3)";
        fileEl.title = "Belum ada site diubah";
      }
    }
    if (badgeEl) badgeEl.textContent = `${count} site`;
  },

  renderHistoryTable(filterText = "") {
    const tbody = document.getElementById('hos-history-tbody');
    if (!tbody) return;

    const term = (filterText || "").toLowerCase().trim();
    const records = this.handoverHistory.filter(h => {
      if (!term) return true;
      return (h.site_id || "").toLowerCase().includes(term) ||
             (h.site_name || "").toLowerCase().includes(term) ||
             (h.new_te || "").toLowerCase().includes(term) ||
             (h.old_te || "").toLowerCase().includes(term) ||
             (h.cluster || "").toLowerCase().includes(term);
    });

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-subtle py-4" style="color:var(--txt-3);padding:14px;text-align:center;">
        ${term ? 'Tidak ada riwayat perubahan yang cocok dengan pencarian.' : 'Belum ada site yang diubah di sesi ini.'}
      </td></tr>`;
      return;
    }

    tbody.innerHTML = records.map(r => `
      <tr style="border-bottom:1px solid var(--bdr);">
        <td style="padding:6px 8px;font-weight:700;color:var(--txt-1);">${r.site_id || '—'}</td>
        <td style="padding:6px 8px;color:var(--txt-2);">${r.site_name || '—'}</td>
        <td style="padding:6px 8px;color:var(--txt-2);">${r.cluster || '—'}</td>
        <td style="padding:6px 8px;color:var(--amb);">${r.old_te || '—'}</td>
        <td style="padding:6px 8px;font-weight:600;color:#c084fc;">
          ${r.new_te || '—'} ${r.new_phone ? `<span style="font-size:10px;color:var(--txt-3);font-weight:normal;">(${r.new_phone})</span>` : ''}
        </td>
        <td style="padding:6px 8px;font-size:10px;color:var(--txt-3);">
          ${r.timestamp || '—'}
          ${r.note ? `<div style="color:var(--txt-2);font-style:italic;">${r.note}</div>` : ''}
        </td>
        <td style="padding:6px 8px;text-align:center;">
          <button class="tbtn-clr btn-hos-revert-row" data-site="${r.site_id}" style="padding:2px 6px;font-size:10px;color:var(--red);border-color:rgba(239,68,68,0.3);" title="Hapus override site ini">
            Revert
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-hos-revert-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sid = e.currentTarget.dataset.site;
        SiteChangesManager.revertOverride(sid);
      });
    });
  }
};

// ==========================================
// MODAL HANDOVER NEW SITE / BTS CONTROLLER
// ==========================================
const modalHandoverSite = document.getElementById('modal-handover-site');
const btnCloseHandoverSiteX = document.getElementById('btn-close-handover-site-x');
const btnCloseHandoverSite = document.getElementById('btn-close-handover-site');
const btnDashHandoverSite = document.getElementById('btn-dash-handover-site');
const dashChangesCard = document.getElementById('dash-changes-card');
const btnDbLookupHandover = document.getElementById('btn-db-lookup-handover');

const hosTabSingle = document.getElementById('hos-tab-single');
const hosTabBatch = document.getElementById('hos-tab-batch');
const hosPaneSingle = document.getElementById('hos-pane-single');
const hosPaneBatch = document.getElementById('hos-pane-batch');

const inpHosSearchSite = document.getElementById('inp-hos-search-site');
const btnHosCheckSite = document.getElementById('btn-hos-check-site');
const btnHosClearSite = document.getElementById('btn-hos-clear-site');

const hosPrevSiteName = document.getElementById('hos-prev-site-name');
const hosPrevSiteId = document.getElementById('hos-prev-site-id');
const hosPrevCluster = document.getElementById('hos-prev-cluster');
const hosPrevOldTe = document.getElementById('hos-prev-old-te');
const hosPrevOldPhone = document.getElementById('hos-prev-old-phone');

const inpHosBatchSites = document.getElementById('inp-hos-batch-sites');
const btnHosBatchValidate = document.getElementById('btn-hos-batch-validate');
const hosBatchCountInfo = document.getElementById('hos-batch-count-info');

const selHosNewTe = document.getElementById('sel-hos-new-te');
const inpHosNewTe = document.getElementById('inp-hos-new-te');
const inpHosNewPhone = document.getElementById('inp-hos-new-phone');
const inpHosNote = document.getElementById('inp-hos-note');
const btnExecuteHandoverSite = document.getElementById('btn-execute-handover-site');

const inpHosFilterHistory = document.getElementById('inp-hos-filter-history');
const btnHosLoadJson = document.getElementById('btn-hos-load-json');
const btnHosSaveJson = document.getElementById('btn-hos-save-json');
const btnHosResetAll = document.getElementById('btn-hos-reset-all');

const btnDashLoadJson = document.getElementById('btn-dash-load-json');
const btnDashSaveJson = document.getElementById('btn-dash-save-json');
const btnDbeLoadJson = document.getElementById('btn-dbe-load-json');
const btnDbeSaveJson = document.getElementById('btn-dbe-save-json');

let currentActiveSiteData = null;
let currentHosMode = 'single'; // 'single' or 'batch'

function openHandoverSiteModal(prefilledSiteId = "") {
  if (!modalHandoverSite) return;

  // Populate TE dropdown from savedWaTeContacts
  if (selHosNewTe) {
    selHosNewTe.innerHTML = '<option value="">-- Pilih TE Terdaftar --</option>';
    const teMap = new Map();
    (savedWaTeContacts || []).forEach(c => {
      const name = (c.name || "").trim();
      if (name && !name.startsWith("[") && name.toUpperCase() !== "UNKNOWN TE") {
        if (!teMap.has(name.toUpperCase())) {
          teMap.set(name.toUpperCase(), c);
        }
      }
    });

    Array.from(teMap.values()).sort((a, b) => a.name.localeCompare(b.name)).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = `${c.name} ${c.cluster ? `(${c.cluster})` : ''}`;
      opt.dataset.phone = c.phone || '';
      selHosNewTe.appendChild(opt);
    });
  }

  // Reset inputs
  if (inpHosNewTe) inpHosNewTe.value = '';
  if (inpHosNewPhone) inpHosNewPhone.value = '';
  if (inpHosNote) inpHosNote.value = '';

  // Switch to single mode by default
  switchHosMode('single');

  if (prefilledSiteId) {
    if (inpHosSearchSite) {
      inpHosSearchSite.value = prefilledSiteId;
      searchSiteForHandover(prefilledSiteId);
    }
  }

  SiteChangesManager.renderHistoryTable();
  modalHandoverSite.classList.remove('hidden');
  modalHandoverSite.style.display = 'flex';
}

function closeHandoverSiteModal() {
  if (!modalHandoverSite) return;
  modalHandoverSite.classList.add('hidden');
  modalHandoverSite.style.display = 'none';
}

function switchHosMode(mode) {
  currentHosMode = mode;
  if (mode === 'single') {
    if (hosTabSingle) hosTabSingle.classList.add('active');
    if (hosTabBatch) hosTabBatch.classList.remove('active');
    if (hosPaneSingle) hosPaneSingle.style.display = 'flex';
    if (hosPaneBatch) hosPaneBatch.style.display = 'none';
  } else {
    if (hosTabSingle) hosTabSingle.classList.remove('active');
    if (hosTabBatch) hosTabBatch.classList.add('active');
    if (hosPaneSingle) hosPaneSingle.style.display = 'none';
    if (hosPaneBatch) hosPaneBatch.style.display = 'flex';
  }
}

async function searchSiteForHandover(siteId) {
  const sid = (siteId || (inpHosSearchSite ? inpHosSearchSite.value : "")).trim().toUpperCase();
  if (!sid) {
    alert("Harap masukkan Site ID terlebih dahulu.");
    return;
  }

  try {
    const res = await invoke('lookup_site', { siteId: sid });
    if (!res) {
      alert(`Site ID '${sid}' tidak ditemukan di Master Database.`);
      clearSitePreview();
      return;
    }

    currentActiveSiteData = res;
    if (hosPrevSiteName) hosPrevSiteName.textContent = res["Site Name"] || "—";
    if (hosPrevSiteId) hosPrevSiteId.textContent = `New ID: ${res["Site ID (New)"] || sid} | Old: ${res["Old Site ID"] || '—'}`;
    if (hosPrevCluster) hosPrevCluster.textContent = res["Cluster (MC)"] || res["FM Office"] || "—";
    if (hosPrevOldTe) hosPrevOldTe.textContent = res["TE Name"] || "(Belum ditentukan)";
    if (hosPrevOldPhone) hosPrevOldPhone.textContent = res["TE Phone"] || "—";

  } catch (err) {
    alert("Gagal mencari site di database: " + err);
    clearSitePreview();
  }
}

function clearSitePreview() {
  currentActiveSiteData = null;
  if (inpHosSearchSite) inpHosSearchSite.value = '';
  if (hosPrevSiteName) hosPrevSiteName.textContent = "Belum dipilih";
  if (hosPrevSiteId) hosPrevSiteId.textContent = "—";
  if (hosPrevCluster) hosPrevCluster.textContent = "—";
  if (hosPrevOldTe) hosPrevOldTe.textContent = "—";
  if (hosPrevOldPhone) hosPrevOldPhone.textContent = "—";
}

// Event Listeners for Handover Site Modal
if (btnDashHandoverSite) btnDashHandoverSite.addEventListener('click', () => openHandoverSiteModal());
if (dashChangesCard) dashChangesCard.addEventListener('click', () => openHandoverSiteModal());
if (btnDbLookupHandover) {
  btnDbLookupHandover.addEventListener('click', () => {
    const currentLookupId = (document.getElementById('db-f-site-id-new')?.textContent || document.getElementById('db-search-input')?.value || "").trim();
    if (currentLookupId && currentLookupId !== '—') {
      openHandoverSiteModal(currentLookupId);
    } else {
      openHandoverSiteModal();
    }
  });
}

if (btnCloseHandoverSiteX) btnCloseHandoverSiteX.addEventListener('click', closeHandoverSiteModal);
if (btnCloseHandoverSite) btnCloseHandoverSite.addEventListener('click', closeHandoverSiteModal);

if (hosTabSingle) hosTabSingle.addEventListener('click', () => switchHosMode('single'));
if (hosTabBatch) hosTabBatch.addEventListener('click', () => switchHosMode('batch'));

if (btnHosCheckSite) {
  btnHosCheckSite.addEventListener('click', () => {
    const val = inpHosSearchSite ? inpHosSearchSite.value.trim() : "";
    searchSiteForHandover(val);
  });
}

if (inpHosSearchSite) {
  inpHosSearchSite.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      searchSiteForHandover(inpHosSearchSite.value.trim());
    }
  });
}

if (btnHosClearSite) btnHosClearSite.addEventListener('click', clearSitePreview);

if (selHosNewTe) {
  selHosNewTe.addEventListener('change', () => {
    const selectedOpt = selHosNewTe.options[selHosNewTe.selectedIndex];
    if (selectedOpt && selectedOpt.value) {
      if (inpHosNewTe) inpHosNewTe.value = selectedOpt.value;
      if (inpHosNewPhone) inpHosNewPhone.value = selectedOpt.dataset.phone || '';
    }
  });
}

if (inpHosBatchSites) {
  inpHosBatchSites.addEventListener('input', () => {
    const raw = inpHosBatchSites.value;
    const ids = raw.split(/[\n,; \t]+/).map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    if (hosBatchCountInfo) hosBatchCountInfo.textContent = `${ids.length} Site ID dimasukkan`;
  });
}

if (btnHosBatchValidate) {
  btnHosBatchValidate.addEventListener('click', async () => {
    const raw = inpHosBatchSites ? inpHosBatchSites.value : "";
    const ids = raw.split(/[\n,; \t]+/).map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    if (ids.length === 0) {
      alert("Masukkan minimal 1 Site ID di textarea terlebih dahulu.");
      return;
    }

    let found = 0;
    let notFound = 0;
    for (const sid of ids) {
      try {
        const res = await invoke('lookup_site', { siteId: sid });
        if (res) found++; else notFound++;
      } catch (e) {
        notFound++;
      }
    }
    alert(`Hasil Validasi DB:\n• ${found} site terdaftar di Master DB.\n• ${notFound} site tidak ditemukan.`);
    if (hosBatchCountInfo) hosBatchCountInfo.textContent = `${ids.length} Site ID (${found} valid di DB)`;
  });
}

if (btnExecuteHandoverSite) {
  btnExecuteHandoverSite.addEventListener('click', async () => {
    let newTeName = (inpHosNewTe && inpHosNewTe.value.trim()) || (selHosNewTe && selHosNewTe.value.trim()) || "";
    let newTePhone = inpHosNewPhone ? inpHosNewPhone.value.trim() : "";
    const note = inpHosNote ? inpHosNote.value.trim() : "";

    if (!newTeName) {
      alert("Harap pilih atau ketik nama TE Baru penerima handover.");
      return;
    }

    let targetSiteIds = [];

    if (currentHosMode === 'single') {
      if (!currentActiveSiteData) {
        const typed = inpHosSearchSite ? inpHosSearchSite.value.trim().toUpperCase() : "";
        if (!typed) {
          alert("Harap cari dan pilih site yang akan di-handover terlebih dahulu.");
          return;
        }
        await searchSiteForHandover(typed);
        if (!currentActiveSiteData) return;
      }
      const sid = currentActiveSiteData["Site ID (New)"] || inpHosSearchSite.value.trim().toUpperCase();
      targetSiteIds.push(sid);
    } else {
      const rawText = inpHosBatchSites ? inpHosBatchSites.value : "";
      targetSiteIds = rawText.split(/[\n,; \t]+/)
        .map(s => s.trim().toUpperCase())
        .filter(s => s.length > 0);

      if (targetSiteIds.length === 0) {
        alert("Harap masukkan minimal 1 Site ID di textarea batch.");
        return;
      }
    }

    const confirmMsg = `Konfirmasi Handover Site / BTS:\n\n` +
      `• Jumlah Site: ${targetSiteIds.length} site\n` +
      `• Target TE Baru: ${newTeName}\n` +
      `• Nomor WA: ${newTePhone || '(tidak diisi)'}\n` +
      `• Catatan: ${note || '-'}\n\n` +
      `Lanjutkan proses handover?`;

    if (!confirm(confirmMsg)) return;

    btnExecuteHandoverSite.disabled = true;
    btnExecuteHandoverSite.textContent = "⏳ Memproses...";

    try {
      const res = await invoke('handover_sites_batch', {
        siteIds: targetSiteIds,
        newTeName: newTeName,
        newTePhone: newTePhone,
        note: note ? note : null
      });

      const records = res.records || [];
      const successes = records.filter(r => r.success);
      const fails = records.filter(r => !r.success);

      successes.forEach(r => {
        SiteChangesManager.recordHandover({
          site_id: r.site_id,
          site_name: r.site_name,
          cluster: r.cluster,
          old_te: r.old_te,
          old_phone: r.old_phone,
          new_te: r.new_te,
          new_phone: r.new_phone,
          note: r.note,
          timestamp: r.timestamp
        });
      });

      let alertMsg = `✅ Handover Berhasil!\n\n` +
        `• ${successes.length} site berhasil dialihkan ke ${newTeName}.\n`;

      if (fails.length > 0) {
        alertMsg += `⚠️ ${fails.length} site gagal (tidak ditemukan di DB):\n` +
          fails.slice(0, 5).map(f => `  - ${f.site_id}: ${f.message}`).join('\n') +
          (fails.length > 5 ? `\n  ... dan ${fails.length - 5} lainnya` : '');
      }

      alert(alertMsg);

      if (currentHosMode === 'single') {
        clearSitePreview();
      } else {
        if (inpHosBatchSites) inpHosBatchSites.value = '';
        if (hosBatchCountInfo) hosBatchCountInfo.textContent = '0 Site ID dimasukkan';
      }
      if (inpHosNote) inpHosNote.value = '';

    } catch (err) {
      alert("Gagal memproses handover site: " + err);
    } finally {
      btnExecuteHandoverSite.disabled = false;
      btnExecuteHandoverSite.textContent = "⚡ Terapkan Handover Site";
    }
  });
}

// Table history filter
if (inpHosFilterHistory) {
  inpHosFilterHistory.addEventListener('input', (e) => {
    SiteChangesManager.renderHistoryTable(e.target.value);
  });
}

// JSON Import / Export Bindings
if (btnHosLoadJson) btnHosLoadJson.addEventListener('click', () => SiteChangesManager.loadFromJsonFile());
if (btnHosSaveJson) btnHosSaveJson.addEventListener('click', () => SiteChangesManager.saveToJsonFile());
if (btnHosResetAll) btnHosResetAll.addEventListener('click', () => SiteChangesManager.resetAll());

if (btnDashLoadJson) btnDashLoadJson.addEventListener('click', () => SiteChangesManager.loadFromJsonFile());
if (btnDashSaveJson) btnDashSaveJson.addEventListener('click', () => SiteChangesManager.saveToJsonFile());

if (btnDbeLoadJson) btnDbeLoadJson.addEventListener('click', () => SiteChangesManager.loadFromJsonFile());
if (btnDbeSaveJson) btnDbeSaveJson.addEventListener('click', () => SiteChangesManager.saveToJsonFile());

// WA Blast TE Main trigger in tab-pm
if (btnPmWaBlast) {
  btnPmWaBlast.addEventListener('click', async () => {
    try {
      const check = await invoke('wa_status');
      if (!check || check.status !== "CONNECTED") {
        alert("WhatsApp is not CONNECTED. Please start the server and connect your WA account in the Broadcast tab.");
        return;
      }
    } catch (e) {
      alert("Failed to check WA status. Ensure Node server is running. Error: " + e);
      return;
    }

    const downSites = statusData.filter(s => s.status === 'DOWN');

    if (typeof netdroneData !== 'undefined' && netdroneData && netdroneData.length > 0) {
      netdroneData.filter(d => !d.skipped && d.matchedDb).forEach(nr => {
        const siteObj = {
          status: 'DOWN',
          impact: 'Full Sitedown',
          new_site: nr.siteId,
          old_site: "",
          site_name: nr.siteName,
          cluster: nr.cluster || 'UNKNOWN',
          pic: nr.pic || "",
          rts: nr.rts || "",
          start_time: nr.startTime || "",
          agging: "",
          remark: nr.remark || "",
          category: nr.category || "",
          site_class: nr.siteClass || "",
          vendor: nr.vendor || "",
          te_phone: nr.tePhone || "",
          is_netdrone: true
        };
        if (typeof activeRegionFilter === 'undefined' || activeRegionFilter === 'ALL' || getSiteRegion(siteObj) === activeRegionFilter) {
          downSites.push(siteObj);
        }
      });
    }

    if (downSites.length === 0) {
      alert("No site DOWN at this time.");
      return;
    }

    // Refresh contact list from DB
    await loadWaTeContacts();

    currentTeGroups = {};
    downSites.forEach(s => {
      const rawTe = (s.pic || "").trim();
      const cluster = (s.cluster || "").trim();

      const isUntitled = !rawTe ||
                         rawTe === "—" ||
                         rawTe === "-" ||
                         rawTe === "0" ||
                         rawTe.toLowerCase() === "nan" ||
                         rawTe.toLowerCase() === "unknown te" ||
                         rawTe.toLowerCase() === "te unknown" ||
                         rawTe.toLowerCase().includes("untitled") ||
                         rawTe.toLowerCase() === "null";

      let teDisplayName = "";
      let groupKey = "";
      let isUnassigned = false;

      if (isUntitled) {
        isUnassigned = true;
        const clusterLabel = cluster || "Tanpa Cluster";
        teDisplayName = `[Belum Ada TE] ${clusterLabel}`;
        groupKey = `UNASSIGNED_${clusterLabel.toUpperCase()}`;
      } else {
        teDisplayName = rawTe;
        groupKey = rawTe.toUpperCase();
      }

      // Try finding contact in savedWaTeContacts
      const localContact = savedWaTeContacts.find(c => {
        const cName = (c.name || "").trim().toUpperCase();
        const cCluster = (c.cluster || "").trim().toUpperCase();
        if (isUnassigned) {
          return cCluster === (cluster || "").toUpperCase() && (cName.includes("BELUM ADA") || cName.includes("NO TE") || cName.includes("PIC"));
        }
        return cName === teDisplayName.toUpperCase();
      });

      let tePhone = (localContact && localContact.phone) ? localContact.phone.trim() : "";
      if (!tePhone && s.te_phone && s.te_phone !== "0" && s.te_phone.toLowerCase() !== "nan") {
        tePhone = s.te_phone.trim();
      }

      if (!currentTeGroups[groupKey]) {
        currentTeGroups[groupKey] = {
          name: teDisplayName,
          rawName: rawTe,
          clusters: new Set(),
          phone: tePhone,
          sites: [],
          isUnassigned: isUnassigned
        };
      }

      if (cluster) currentTeGroups[groupKey].clusters.add(cluster);
      if (!currentTeGroups[groupKey].phone && tePhone) currentTeGroups[groupKey].phone = tePhone;
      currentTeGroups[groupKey].sites.push(s);
    });

    for (let k in currentTeGroups) {
      const sortedCls = Array.from(currentTeGroups[k].clusters).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      currentTeGroups[k].cluster = sortedCls.join(", ") || "—";
    }

    // Filter out groups that have absolutely NO items to send (sites or pivot alarms)
    const keys = Object.keys(currentTeGroups);
    keys.forEach(key => {
      const g = currentTeGroups[key];
      const counts = getTeMessageItemCount(g.sites, g.cluster);
      if (counts.total === 0) {
        delete currentTeGroups[key];
      }
    });

    waBlastTeProgressContainer.classList.add('hidden');
    btnCloseWaBlastTe.textContent = "Cancel";
    btnExecuteWaBlastTe.disabled = false;
    btnCloseWaBlastTe.disabled = false;
    if (chkWaBlastTeSelectAll) chkWaBlastTeSelectAll.checked = true;
    if (chkWaBlastTeSelectAll) chkWaBlastTeSelectAll.disabled = false;

    renderWaBlastTeTable(currentTeGroups);

    waBlastTeModal.classList.remove('hidden');
    waBlastTeModal.style.display = 'flex';
  });
}

function renderWaBlastTeTable(teGroups) {
  if (!waBlastTeTbody) return;
  waBlastTeTbody.innerHTML = '';

  const keys = Object.keys(teGroups);
  if (keys.length === 0) {
    waBlastTeTbody.innerHTML = '<tr><td colspan="6" class="text-center text-subtle py-4">No TE data with down sites.</td></tr>';
    return;
  }

  keys.forEach((key) => {
    const g = teGroups[key];
    const cleanJid = cleanWaNumber(g.phone);
    const isPhoneValid = !!cleanJid;
    const totalCount = getTeMessageItemCount(g.sites, g.cluster).total;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center" style="width: 30px;">
        <input type="checkbox" class="wa-blast-te-chk checkbox" data-key="${key}" ${isPhoneValid ? 'checked' : 'disabled'}>
      </td>
      <td class="font-bold ${g.isUnassigned ? 'text-amb' : 'text-success'}">
        ${g.name}
        ${g.isUnassigned ? '<span class="badge ba" style="font-size:9.5px; padding:1px 5px; margin-left:4px;" title="Site ini belum memiliki TE di database">⚠️ Belum Ada TE</span>' : ''}
        <small class="text-subtle" style="font-weight:normal; display:block; font-size:10.5px;">(${g.cluster})</small>
      </td>
      <td>
        <input type="text" class="fi wa-blast-te-phone-input" data-key="${key}" value="${g.phone}" placeholder="${g.isUnassigned ? 'No WA PIC/RTS...' : 'WA Phone (628...)'}" style="width:160px; font-size:13.5px; height:24px; padding:2px 6px;">
      </td>
      <td class="text-center"><span class="badge ${totalCount > 1 ? 'br' : 'bb'}">${totalCount}</span></td>
      <td class="text-center">
        <button class="tbtn btn-preview-te-msg" data-key="${key}" style="font-size:11px; padding:2px 8px;" title="View Message Preview">👁️ Preview</button>
      </td>
      <td class="wa-blast-te-status-cell text-subtle" data-key="${key}" style="font-size:14px; font-weight:600;">Ready</td>
    `;

    const chk = tr.querySelector('.wa-blast-te-chk');
    const phoneInput = tr.querySelector('.wa-blast-te-phone-input');
    const btnPreview = tr.querySelector('.btn-preview-te-msg');

    phoneInput.addEventListener('input', (e) => {
      const newPhone = e.target.value.trim();
      g.phone = newPhone;
      const jid = cleanWaNumber(newPhone);
      if (jid) {
        chk.disabled = false;
        if (!chk.checked) chk.checked = true;
      } else {
        chk.disabled = true;
        chk.checked = false;
      }
    });

    if (btnPreview) {
      btnPreview.addEventListener('click', () => {
        openTePreviewModal(g);
      });
    }

    waBlastTeTbody.appendChild(tr);
  });
}

function openTePreviewModal(g) {
  const modal = document.getElementById('wa-blast-preview-modal');
  const lblName = document.getElementById('lbl-preview-te-name');
  const lblPhone = document.getElementById('lbl-preview-te-phone');
  const txtMsg = document.getElementById('txt-preview-te-msg');

  if (lblName) lblName.textContent = `${g.name} (${g.cluster})`;
  if (lblPhone) lblPhone.textContent = g.phone ? `[${g.phone}]` : "[WA Phone unset]";

  const msg = generateTeMessage(g.name, g.sites, g.cluster);
  if (txtMsg) txtMsg.value = msg || "(No data to send based on current filter configuration)";

  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}

document.getElementById('btn-close-wa-blast-preview')?.addEventListener('click', () => {
  const modal = document.getElementById('wa-blast-preview-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
});

document.getElementById('btn-done-preview-te')?.addEventListener('click', () => {
  const modal = document.getElementById('wa-blast-preview-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
});

document.getElementById('btn-copy-preview-te-msg')?.addEventListener('click', () => {
  const txtMsg = document.getElementById('txt-preview-te-msg');
  if (txtMsg && txtMsg.value) {
    navigator.clipboard.writeText(txtMsg.value);
    const btn = document.getElementById('btn-copy-preview-te-msg');
    const old = btn.textContent;
    btn.textContent = "✓ Copied!";
    setTimeout(() => btn.textContent = old, 2000);
  }
});

if (chkWaBlastTeSelectAll) {
  chkWaBlastTeSelectAll.addEventListener('change', (e) => {
    const checked = e.target.checked;
    const chks = document.querySelectorAll('.wa-blast-te-chk:not(:disabled)');
    chks.forEach(c => c.checked = checked);
  });
}

if (btnCloseWaBlastTe) {
  btnCloseWaBlastTe.addEventListener('click', () => {
    waBlastTeModal.classList.add('hidden');
    waBlastTeModal.style.display = 'none';
  });
}

if (btnExecuteWaBlastTe) {
  btnExecuteWaBlastTe.addEventListener('click', async () => {
    const selectedChks = document.querySelectorAll('.wa-blast-te-chk:checked');
    if (selectedChks.length === 0) {
      alert("Please select at least 1 TE to blast.");
      return;
    }

    const confirmed = confirm(`Send direct message to ${selectedChks.length} TEs?`);
    if (!confirmed) return;

    const blastTargets = [];
    let needSaveContacts = false;

    selectedChks.forEach(chk => {
      const key = chk.dataset.key;
      const g = currentTeGroups[key];
      const jid = cleanWaNumber(g.phone);
      const message = generateTeMessage(g.name, g.sites, g.cluster);

      blastTargets.push({ key, name: g.name, jid, message });

      // Auto-save logic
      if (g.phone) {
        const saveName = g.isUnassigned ? `[No TE] ${g.cluster}` : g.name.trim();
        const existsIdx = savedWaTeContacts.findIndex(c =>
          (c.name || "").trim().toUpperCase() === saveName.toUpperCase() &&
          (c.cluster || "").trim().toUpperCase() === g.cluster.trim().toUpperCase()
        );

        if (existsIdx === -1) {
          savedWaTeContacts.push({
            name: saveName,
            cluster: g.cluster.trim(),
            phone: g.phone.trim()
          });
          needSaveContacts = true;
        } else if (savedWaTeContacts[existsIdx].phone !== g.phone.trim()) {
          savedWaTeContacts[existsIdx].phone = g.phone.trim();
          needSaveContacts = true;
        }
      }
    });

    btnExecuteWaBlastTe.disabled = true;
    btnCloseWaBlastTe.disabled = true;
    if (chkWaBlastTeSelectAll) chkWaBlastTeSelectAll.disabled = true;
    document.querySelectorAll('.wa-blast-te-chk').forEach(c => c.disabled = true);
    document.querySelectorAll('.wa-blast-te-phone-input').forEach(i => i.disabled = true);

    waBlastTeProgressContainer.classList.remove('hidden');
    waBlastTeProgressPercent.textContent = "0%";
    waBlastTeProgressFill.style.width = "0%";
    waBlastTeProgressStatus.textContent = "Starting blast...";

    const delayMs = parseInt(numWaBlastTeDelay.value) || 2000;

    for (let i = 0; i < blastTargets.length; i++) {
      const target = blastTargets[i];
      const statusCell = document.querySelector(`.wa-blast-te-status-cell[data-key="${target.key}"]`);

      if (statusCell) {
        statusCell.textContent = "⏳ Sending...";
        statusCell.style.color = "var(--amb)";
      }

      const percent = Math.round((i / blastTargets.length) * 100);
      waBlastTeProgressPercent.textContent = `${percent}%`;
      waBlastTeProgressFill.style.width = `${percent}%`;
      waBlastTeProgressStatus.textContent = `Sending to ${target.name} (${i + 1}/${blastTargets.length})...`;

      try {
        const result = await invoke('wa_broadcast', {
          targets: [{ group_id: target.jid, message: target.message }],
          delay_ms: 0
        });

        const success = result && result.success > 0;
        if (success) {
          if (statusCell) {
            statusCell.textContent = "✅ Success";
            statusCell.style.color = "var(--grn)";
          }
        } else {
          if (statusCell) {
            statusCell.textContent = "❌ Failed";
            statusCell.style.color = "var(--red)";
          }
        }
      } catch (err) {
        console.error("Blast failed for TE:", target.name, err);
        if (statusCell) {
          statusCell.textContent = "❌ Error";
          statusCell.style.color = "var(--red)";
          statusCell.title = err.toString();
        }
      }

      if (i < blastTargets.length - 1 && delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    waBlastTeProgressPercent.textContent = "100%";
    waBlastTeProgressFill.style.width = "100%";
    waBlastTeProgressStatus.textContent = `Done sending to ${blastTargets.length} TEs!`;

    // Auto-save contacts to file if changes occurred
    if (needSaveContacts) {
      try {
        await invoke('save_wa_te_contacts', { contacts: savedWaTeContacts });
        console.log("TE contact database auto-updated.");
      } catch (err) {
        console.warn("Failed to auto-save contacts:", err);
      }
    }

    btnCloseWaBlastTe.textContent = "Close";
    btnCloseWaBlastTe.disabled = false;
  });
}

// ==========================================
// WA BLAST FILTER MODAL LOGIC
// ==========================================
function syncBlastFilterUI() {
  if (chkFilterRemarkTrigger) chkFilterRemarkTrigger.checked = blastFilterCfg.filterRemarkTrigger;
  if (chkFilterSitedown) chkFilterSitedown.checked = blastFilterCfg.enableSitedown;
  if (chkFilterCelldown) chkFilterCelldown.checked = blastFilterCfg.enableCelldown;
  if (chkFilterBcch) chkFilterBcch.checked = blastFilterCfg.enableBcch;
  if (chkFilterEnva) chkFilterEnva.checked = blastFilterCfg.enableEnva;
  if (chkFilterStolen) chkFilterStolen.checked = blastFilterCfg.enableStolen;

  renderFilterSiteTables();
  updateFilterCountsInUI();
}

const chkWaEnableNetdrone = document.getElementById('chk-wa-enable-netdrone');
if (chkWaEnableNetdrone) {
  chkWaEnableNetdrone.addEventListener('change', () => {
    const btnGenWa = document.getElementById('btn-gen-wa');
    if (btnGenWa) btnGenWa.click();
  });
}

// Initial load of WA TE contacts for Dashboard cards
loadWaTeContacts();

function updateFilterCountsInUI() {
  const bcchKw = (fmtMsg && fmtMsg.key_bcch || "BCCH").toUpperCase();
  const downSites = statusData.filter(s => s.status === 'DOWN');

  let sitedownTotal = 0, sitedownSelected = 0;
  let celldownTotal = 0, celldownSelected = 0;
  let bcchTotal = 0, bcchSelected = 0;

  downSites.forEach(s => {
    const isFully = s.is_netdrone || (s.impact && (s.impact.toLowerCase().includes('fully') || s.impact.toLowerCase().includes('sitedown')));
    const isBcch = !s.is_netdrone && s.remark && s.remark.toUpperCase().includes(bcchKw);
    const sel = isSiteSelected(s);
    if (isFully) {
      sitedownTotal++;
      if (sel) sitedownSelected++;
    } else if (isBcch) {
      bcchTotal++;
      if (sel) bcchSelected++;
    } else {
      celldownTotal++;
      if (sel) celldownSelected++;
    }
  });

  const stollenRows = (pivotData || []).filter(r => r.monitoring === 'STOLLEN' || r.monitoring === 'CABLE STOLLEN');
  const envaRows = (pivotData || []).filter(r => r.monitoring.includes('POWER') || r.monitoring.includes('ENVA') || r.monitoring.includes('NETECO'));

  const setCnt = (id, selected, total) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${selected}/${total} data`;
  };

  setCnt('cnt-filter-sitedown', sitedownSelected, sitedownTotal);
  setCnt('cnt-filter-celldown', celldownSelected, celldownTotal);
  setCnt('cnt-filter-bcch', bcchSelected, bcchTotal);

  const setSimpleCnt = (id, count) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${count} data`;
  };
  setSimpleCnt('cnt-filter-enva', envaRows.length);
  setSimpleCnt('cnt-filter-stolen', stollenRows.length);

  const netdroneMatchedCount = (netdroneData || []).filter(d => !d.skipped && d.matchedDb).length;
  setSimpleCnt('cnt-filter-netdrone', netdroneMatchedCount);
}

function renderFilterSiteTables() {
  const bcchKw = (fmtMsg && fmtMsg.key_bcch || "BCCH").toUpperCase();
  let downSites = statusData.filter(s => s.status === 'DOWN');

  if (typeof activeRegionFilter !== 'undefined' && activeRegionFilter !== 'ALL') {
    downSites = downSites.filter(s => getSiteRegion(s) === activeRegionFilter);
  }

  const sitedownList = [];
  const celldownList = [];
  const bcchList = [];

  downSites.forEach(s => {
    const isFully = s.is_netdrone || (s.impact && (s.impact.toLowerCase().includes('fully') || s.impact.toLowerCase().includes('sitedown')));
    const isBcch = !s.is_netdrone && s.remark && s.remark.toUpperCase().includes(bcchKw);
    if (isFully) sitedownList.push(s);
    else if (isBcch) bcchList.push(s);
    else celldownList.push(s);
  });

  const fillTbodyWithClusters = (tbodyId, list) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-subtle py-2">Tidak ada data.</td></tr>';
      return;
    }

    // Group list by Cluster
    const groups = {};
    list.forEach(s => {
      const cl = s.cluster || 'UNKNOWN CLUSTER';
      if (!groups[cl]) groups[cl] = [];
      groups[cl].push(s);
    });

    const sortedClusters = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    sortedClusters.forEach(clusterName => {
      const clusterSites = groups[clusterName];
      const allSelected = clusterSites.every(s => isSiteSelected(s));

      // Cluster Heading Row with Checkbox
      const hdrTr = document.createElement('tr');
      hdrTr.style.background = 'var(--bg-surface)';
      hdrTr.style.borderTop = '1px solid var(--bdr)';
      hdrTr.style.borderBottom = '1px solid var(--bdr)';
      hdrTr.innerHTML = `
        <td class="text-center" style="width:26px;padding:4px 0;">
          <input type="checkbox" class="cluster-group-chk" data-cluster="${clusterName}" ${allSelected ? 'checked' : ''} style="width:14px;height:14px;cursor:pointer;">
        </td>
        <td colspan="4" style="font-weight:bold;color:var(--accent-lit);font-size:11px;padding:5px 8px;">
          📍 Cluster: ${clusterName} <span style="font-size:10px;color:var(--txt-3);font-weight:normal;">(${clusterSites.length} site)</span>
        </td>
      `;

      const clusterChk = hdrTr.querySelector('.cluster-group-chk');
      clusterChk.addEventListener('change', (e) => {
        const checked = e.target.checked;
        clusterSites.forEach(s => {
          const key = getSiteKey(s);
          siteSelectionMap[key] = checked;
        });
        const safeClusterClass = `site-chk-${tbodyId}-${clusterName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const rowChks = tbody.querySelectorAll(`.${safeClusterClass}`);
        rowChks.forEach(c => c.checked = checked);
        updateFilterCountsInUI();
      });

      tbody.appendChild(hdrTr);

      // Render site rows for this cluster
      clusterSites.forEach(s => {
        const key = getSiteKey(s);
        const isSelected = isSiteSelected(s);
        const isTrigger = shouldSendToTe(s.remark);
        const safeClusterClass = `site-chk-${tbodyId}-${clusterName.replace(/[^a-zA-Z0-9]/g, '_')}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="text-center" style="width:26px;">
            <input type="checkbox" class="site-filter-chk ${safeClusterClass} checkbox" data-key="${key}" ${isSelected ? 'checked' : ''}>
          </td>
          <td class="font-bold text-success" style="width:85px;">${s.new_site}</td>
          <td style="width:110px; font-weight:600; color:var(--accent-lit);">${s.cluster || '—'}</td>
          <td>${s.site_name}</td>
          <td style="color:${isTrigger ? 'var(--grn)' : 'var(--txt-3)'}; font-size:10px;">
            ${s.remark || '—'} ${isTrigger ? '<span style="color:var(--grn);font-weight:bold;">(Auto)</span>' : ''}
          </td>
        `;

        tr.querySelector('input').addEventListener('change', (e) => {
          siteSelectionMap[key] = e.target.checked;
          const nowAllSelected = clusterSites.every(item => isSiteSelected(item));
          clusterChk.checked = nowAllSelected;
          updateFilterCountsInUI();
        });

        tbody.appendChild(tr);
      });
    });
  };

  fillTbodyWithClusters('tbody-filter-sitedown', sitedownList);
  fillTbodyWithClusters('tbody-filter-celldown', celldownList);
  fillTbodyWithClusters('tbody-filter-bcch', bcchList);
}

// Expand / Collapse toggles for Site Down, Cell Down, BCCH detail tables
['sitedown', 'celldown', 'bcch'].forEach(cat => {
  const toggleBtn = document.getElementById(`toggle-expand-${cat}`);
  const container = document.getElementById(`list-container-${cat}`);
  const icon = document.getElementById(`icon-expand-${cat}`);

  if (toggleBtn && container) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = container.style.display === 'none' || container.style.display === '';
      container.style.display = isHidden ? 'block' : 'none';
      if (icon) icon.textContent = isHidden ? '▲ Sembunyikan' : '▼ Detail';
    });
  }
});

// Category Select-All Checkboxes
const bindCategorySelectAll = (chkId, tbodyId) => {
  const chkAll = document.getElementById(chkId);
  if (!chkAll) return;
  chkAll.addEventListener('change', (e) => {
    const checked = e.target.checked;
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.querySelectorAll('.site-filter-chk').forEach(c => {
      c.checked = checked;
      siteSelectionMap[c.dataset.key] = checked;
    });
    updateFilterCountsInUI();
  });
};

bindCategorySelectAll('chk-sitedown-select-all', 'tbody-filter-sitedown');
bindCategorySelectAll('chk-celldown-select-all', 'tbody-filter-celldown');
bindCategorySelectAll('chk-bcch-select-all', 'tbody-filter-bcch');

// Toggle Remark Trigger Event Listener -> reset siteSelectionMap to re-evaluate trigger match defaults
if (chkFilterRemarkTrigger) {
  chkFilterRemarkTrigger.addEventListener('change', (e) => {
    blastFilterCfg.filterRemarkTrigger = e.target.checked;
    siteSelectionMap = {}; // Reset so isSiteSelected recalculates based on new trigger rule!
    renderFilterSiteTables();
    updateFilterCountsInUI();
  });
}

if (btnPmBlastFilter) {
  btnPmBlastFilter.addEventListener('click', () => {
    syncBlastFilterUI();
    if (waBlastFilterModal) {
      waBlastFilterModal.classList.remove('hidden');
      waBlastFilterModal.style.display = 'flex';
    }
  });
}

if (btnCloseWaBlastFilter) {
  btnCloseWaBlastFilter.addEventListener('click', () => {
    if (waBlastFilterModal) {
      waBlastFilterModal.classList.add('hidden');
      waBlastFilterModal.style.display = 'none';
    }
  });
}

if (btnSaveWaBlastFilter) {
  btnSaveWaBlastFilter.addEventListener('click', () => {
    const chkFilterNetdrone = document.getElementById('chk-filter-netdrone');
    blastFilterCfg.filterRemarkTrigger = chkFilterRemarkTrigger ? chkFilterRemarkTrigger.checked : true;
    blastFilterCfg.enableSitedown = chkFilterSitedown ? chkFilterSitedown.checked : true;
    blastFilterCfg.enableCelldown = chkFilterCelldown ? chkFilterCelldown.checked : true;
    blastFilterCfg.enableBcch = chkFilterBcch ? chkFilterBcch.checked : true;
    blastFilterCfg.enableEnva = chkFilterEnva ? chkFilterEnva.checked : false;
    blastFilterCfg.enableStolen = chkFilterStolen ? chkFilterStolen.checked : false;
    blastFilterCfg.enableNetdrone = chkFilterNetdrone ? chkFilterNetdrone.checked : false;

    const chkWaEnableNetdrone = document.getElementById('chk-wa-enable-netdrone');
    if (chkWaEnableNetdrone) chkWaEnableNetdrone.checked = blastFilterCfg.enableNetdrone;

    saveBlastFilterCfg();

    if (waBlastFilterModal) {
      waBlastFilterModal.classList.add('hidden');
      waBlastFilterModal.style.display = 'none';
    }
  });
}

// Initial load of WA TE contacts for Dashboard cards
loadWaTeContacts();
SiteChangesManager.init();

// ==========================================
// FLASH REPORT MODULE CONTROLLER
// ==========================================
let frMasterRows = [];
let frManualPgList = [];
let frActiveRegion = 'ALL'; // 'ALL' | 'CJN' | 'CJS'

// 1. Subtab Switching in Tab-Flash
const frSubBtns = document.querySelectorAll('#flash-subtab-seg .seg-btn');
const frSubPanes = document.querySelectorAll('.fr-subtab-pane');

frSubBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    frSubBtns.forEach(b => b.classList.remove('active'));
    frSubPanes.forEach(p => p.classList.add('hidden'));

    btn.classList.add('active');
    const targetId = btn.dataset.subtarget;
    const targetElem = document.getElementById(targetId);
    if (targetElem) {
      targetElem.classList.remove('hidden');
    }

    // If switching to output, automatically generate preview
    if (targetId === 'subtab-fr-output') {
      renderFlashReportPreview();
    }
  });
});

// 2. Region Filter Selector
const frRegBtns = document.querySelectorAll('.fr-reg-btn');
frRegBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    frRegBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    frActiveRegion = btn.dataset.reg || 'ALL';

    // Update title input
    const titleInput = document.getElementById('fr-title-input');
    if (titleInput) {
      if (frActiveRegion === 'CJN') titleInput.value = 'Central Java North';
      else if (frActiveRegion === 'CJS') titleInput.value = 'Central Java South';
      else titleInput.value = 'Central Java';
    }

    renderFrMasterTable();
    updateFrStats();
    renderFlashReportPreview();
  });
});

// 3. Helper to detect region from row
function detectRowRegion(siteId, cluster, siteName, remark, areaName, rawRegion) {
  const combined = `${siteId || ''} ${cluster || ''} ${siteName || ''} ${remark || ''} ${areaName || ''} ${rawRegion || ''}`.toUpperCase();
  if (combined.includes('CJS') || combined.includes('SOUTH')) return 'CJS';
  if (combined.includes('CJN') || combined.includes('NORTH')) return 'CJN';
  return (typeof getSiteRegion === 'function') ? getSiteRegion({ site_name: siteName, cluster: cluster, remark: remark }) : 'CJN';
}

// 4. Parse Flash Master TSV
function parseFlashMasterTSV(text) {
  if (!text || !text.trim()) return [];
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const clean = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const rawHeaders = lines[0].split('\t').map(h => h.trim());
  const cleanedHeaders = rawHeaders.map(clean);

  const findCol = (targetKeys, exclude = []) => {
    // 1. Exact cleaned match
    for (const k of targetKeys) {
      const clk = clean(k);
      const idx = cleanedHeaders.findIndex((h, i) => !exclude.includes(i) && h === clk);
      if (idx !== -1) return idx;
    }
    // 2. Substring match
    for (const k of targetKeys) {
      const clk = clean(k);
      const idx = cleanedHeaders.findIndex((h, i) => !exclude.includes(i) && (h.includes(clk) || clk.includes(h)));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const assigned = [];
  const getAndTrack = (keys) => {
    const idx = findCol(keys, assigned);
    if (idx !== -1) assigned.push(idx);
    return idx;
  };

  let colSiteId = getAndTrack(['newsite', 'siteid', 'sitecode', 'new_site', 'site_id', 'site id']);
  let colMc = getAndTrack(['mccluster', 'mc_cluster', 'mc-cluster', 'clustermc', 'mc']);
  let colSiteName = getAndTrack(['sitename', 'site_name', 'site name']);
  let colCluster = getAndTrack(['fmoffice', 'cluster', 'fm_office', 'locationname', 'fmo']);
  let colRoh = getAndTrack(['roh', 'region', 'area', 'areaname', 'fiveregion']);
  let colRemark = getAndTrack(['remark', 'remarks', 'woremarks', 'rcacategory', 'summary']);
  let colImpact = getAndTrack(['impactsite', 'impact', 'severity', 'alarmname']);
  let colNetType = getAndTrack(['networktype', 'nettype', 'devicetype', 'ratinfo', 'technology']);

  // Smart fallback: scan first data row if key columns weren't found by header name
  const sampleParts = lines[1].split('\t');
  if (colSiteId === -1) {
    const idx = sampleParts.findIndex(c => /^[0-9]{2}[A-Za-z]{3}[0-9]{4}/.test(c.trim()));
    if (idx !== -1) colSiteId = idx;
    else colSiteId = 1; // last resort fallback
  }
  if (colMc === -1) {
    const idx = sampleParts.findIndex(c => /^MC-/i.test(c.trim()));
    if (idx !== -1) colMc = idx;
  }
  if (colSiteName === -1) {
    // If siteId is at idx, siteName is often idx + 1
    if (colSiteId !== -1 && sampleParts.length > colSiteId + 1) colSiteName = colSiteId + 1;
    else colSiteName = 5;
  }

  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    if (parts.length < 2) continue;

    const siteId = (colSiteId !== -1 && parts[colSiteId] ? parts[colSiteId] : '').trim();
    if (!siteId) continue;

    const siteName = (colSiteName !== -1 && parts[colSiteName] ? parts[colSiteName] : siteId).trim();
    const mcCluster = (colMc !== -1 && parts[colMc] ? parts[colMc] : '').trim();
    const cluster = (colCluster !== -1 && parts[colCluster] ? parts[colCluster] : '').trim();
    const netRaw = (colNetType !== -1 && parts[colNetType] ? parts[colNetType] : '').trim().toUpperCase();
    const remark = (colRemark !== -1 && parts[colRemark] ? parts[colRemark] : '').trim();
    const impact = (colImpact !== -1 && parts[colImpact] ? parts[colImpact] : '').trim();
    const rawRoh = (colRoh !== -1 && parts[colRoh] ? parts[colRoh] : '').trim();

    // Determine 2G or 4G
    let is2G = false;
    let is4G = false;
    if (netRaw.includes('2G') || netRaw.includes('BTS') || netRaw.includes('GSM') || impact.includes('2G')) {
      is2G = true;
    }
    if (netRaw.includes('4G') || netRaw.includes('ENODEB') || netRaw.includes('LTE') || impact.includes('4G')) {
      is4G = true;
    }
    if (!is2G && !is4G) {
      is4G = true; // default
    }

    const netLabel = is2G && is4G ? '2G/4G' : (is2G ? '2G' : '4G');

    // Region determination: prefer explicit ROH column if CJN / CJS
    let region = 'CJN';
    const rohUpper = rawRoh.toUpperCase();
    if (rohUpper.includes('CJN') || rohUpper.includes('NORTH')) {
      region = 'CJN';
    } else if (rohUpper.includes('CJS') || rohUpper.includes('SOUTH')) {
      region = 'CJS';
    } else {
      region = detectRowRegion(siteId, cluster, siteName, remark, '', rawRoh);
    }

    // Check remark match for otw, onsite, priority
    const remLow = remark.toLowerCase();
    const matchesFilter = remLow.includes('otw') || remLow.includes('onsite') || remLow.includes('priority');

    parsed.push({
      siteId,
      siteName,
      mcCluster,
      cluster,
      netLabel,
      is2G,
      is4G,
      impact,
      remark,
      region,
      matchesFilter
    });
  }

  return parsed;
}

// 5. Render Master Table Preview
function renderFrMasterTable() {
  const tbody = document.getElementById('fr-master-tbody');
  const lblCount = document.getElementById('fr-tbl-count');
  if (!tbody) return;

  tbody.innerHTML = '';
  let filtered = frMasterRows;
  if (frActiveRegion !== 'ALL') {
    filtered = filtered.filter(r => r.region === frActiveRegion);
  }

  if (lblCount) lblCount.textContent = `${filtered.length} sites`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-subtle" style="padding:24px;">Belum ada data master diproses untuk wilayah ini.</td></tr>`;
    return;
  }

  filtered.forEach((r, idx) => {
    const tr = document.createElement('tr');
    if (r.matchesFilter) {
      tr.style.background = 'var(--accent-soft)';
    }

    const matchBadge = r.matchesFilter 
      ? `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:var(--grn-d);color:var(--grn);font-size:10px;font-weight:700;">MATCH</span>`
      : `<span style="font-size:10px;color:var(--txt-3);">-</span>`;

    tr.innerHTML = `
      <td style="color:var(--txt-3);font-size:11px;">${idx + 1}</td>
      <td><span class="badge" style="font-size:10px;padding:2px 6px;">${r.region}</span></td>
      <td style="font-weight:600;font-size:11.5px;color:var(--txt-1);">${r.mcCluster || '-'}</td>
      <td style="font-family:var(--mono);font-size:11px;font-weight:600;color:var(--accent);">${r.siteId}</td>
      <td style="font-size:11.5px;">${r.siteName}</td>
      <td><span style="font-size:10.5px;font-weight:600;color:${r.is2G ? 'var(--amb)' : 'var(--blu)'};">${r.netLabel}</span></td>
      <td style="font-size:11px;color:var(--txt-2);">${r.impact || '-'}</td>
      <td style="font-size:11px;font-style:${r.matchesFilter ? 'normal' : 'italic'};color:${r.matchesFilter ? 'var(--txt-1)' : 'var(--txt-3)'};">${r.remark || '-'}</td>
      <td style="text-align:center;">${matchBadge}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 6. Update Stats
function updateFrStats() {
  let rows = frMasterRows;
  if (frActiveRegion !== 'ALL') {
    rows = rows.filter(r => r.region === frActiveRegion);
  }

  const mcSet = new Set();
  let count2g = 0;
  let count4g = 0;
  let matchedCount = 0;

  rows.forEach(r => {
    if (r.mcCluster && r.mcCluster.trim()) mcSet.add(r.mcCluster.trim());
    if (r.is2G) count2g++;
    if (r.is4G) count4g++;
    if (r.matchesFilter) matchedCount++;
  });

  const elTotal = document.getElementById('fr-stat-total');
  const elMc = document.getElementById('fr-stat-mc');
  const el2g = document.getElementById('fr-stat-2g');
  const el4g = document.getElementById('fr-stat-4g');
  const elMatched = document.getElementById('fr-stat-matched');
  const elHeadSummary = document.getElementById('fr-header-summary');

  if (elTotal) elTotal.textContent = rows.length;
  if (elMc) elMc.textContent = mcSet.size;
  if (el2g) el2g.textContent = count2g;
  if (el4g) el4g.textContent = count4g;
  if (elMatched) elMatched.textContent = matchedCount + frManualPgList.length;

  if (elHeadSummary) {
    elHeadSummary.textContent = `${mcSet.size} MC Impact • 2G: ${count2g} | 4G: ${count4g}`;
  }

  // Update Additional Info Site Down Inputs automatically
  const inp2g = document.getElementById('fr-input-2g');
  const inp4g = document.getElementById('fr-input-4g');
  if (inp2g && inp4g) {
    inp2g.value = count2g;
    inp4g.value = count4g;
  }
}

// 7. Render Manual Position PG Table
function renderFrManualTable() {
  const tbody = document.getElementById('fr-manual-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (frManualPgList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-subtle" style="padding:16px;">Belum ada data manual ditambahkan.</td></tr>`;
    return;
  }

  frManualPgList.forEach((m, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--txt-3);">${idx + 1}</td>
      <td><span class="badge" style="font-size:10px;">${m.region}</span></td>
      <td style="font-weight:600;">${m.cluster}</td>
      <td style="font-family:var(--mono);color:var(--accent);">${m.siteId}</td>
      <td>${m.siteName}</td>
      <td style="font-size:11px;">${m.remark}</td>
      <td style="text-align:center;">
        <button class="tbtn-clr btn-fr-del-manual" data-idx="${idx}" style="padding:2px 8px;font-size:11px;background:var(--red-d);color:var(--red);border-color:rgba(255,59,48,0.2);">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-fr-del-manual').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      frManualPgList.splice(idx, 1);
      renderFrManualTable();
      updateFrStats();
      renderFlashReportPreview();
    });
  });
}

// 8. Generate Flash Report Text
function generateFlashReportText() {
  const timeStr = (document.getElementById('fr-time-input')?.value || '21:00').trim();
  const titleRegion = (document.getElementById('fr-title-input')?.value || 'Central Java').trim();

  let rows = frMasterRows;
  if (frActiveRegion !== 'ALL') {
    rows = rows.filter(r => r.region === frActiveRegion);
  }

  const mcSet = new Set();
  rows.forEach(r => {
    if (r.mcCluster && r.mcCluster.trim()) mcSet.add(r.mcCluster.trim());
  });
  const mcList = Array.from(mcSet);
  const mcCount = mcList.length;

  const sepFormat = document.getElementById('fr-mc-format')?.value || 'compact';
  let mcStr = '';
  if (sepFormat === 'compact') {
    mcStr = mcList.join('');
  } else if (sepFormat === 'newline') {
    mcStr = mcList.join('\n');
  } else if (sepFormat === 'space') {
    mcStr = mcList.join(' ');
  } else {
    mcStr = mcList.join(', ');
  }

  const count2g = document.getElementById('fr-input-2g')?.value || 0;
  const count4g = document.getElementById('fr-input-4g')?.value || 0;
  const dgRunning = document.getElementById('fr-dg-running')?.value || 0;
  const dgTotal = document.getElementById('fr-dg-total')?.value || 0;

  // Position PG lines (Master filtered + Manual additions)
  const posPgLines = [];
  rows.forEach(r => {
    if (r.matchesFilter) {
      const reg = r.region || 'CJS';
      const clusterVal = (r.cluster || r.mcCluster || '').trim();
      const clusterFormatted = clusterVal.startsWith('(blank)') ? clusterVal : `(blank)${clusterVal}`;
      posPgLines.push(`${reg} | ${clusterFormatted} / ${r.siteId} / ${r.siteName} / ${r.remark} | `);
    }
  });

  frManualPgList.forEach(m => {
    const reg = m.region || 'CJS';
    const clusterVal = (m.cluster || '').trim();
    const clusterFormatted = clusterVal.startsWith('(blank)') ? clusterVal : `(blank)${clusterVal}`;
    posPgLines.push(`${reg} | ${clusterFormatted} / ${m.siteId} / ${m.siteName} / ${m.remark} | `);
  });

  const pgCompleted = (document.getElementById('fr-pg-completed')?.value || '').trim() || '0';
  const pgInstalled = (document.getElementById('fr-pg-installed')?.value || '').trim() || '0';
  const pgMovement = (document.getElementById('fr-pg-movement')?.value || '').trim() || '0';

  let out = `${timeStr}\n\n\n`;
  out += `*Template flash report: ${titleRegion}*\n\n`;
  out += `==================\n`;
  out += `🔷 *MC impact:  ${mcCount} MC*\n`;
  out += `${mcStr || '(Belum ada MC impact)'}\n\n`;
  out += `🔷 *SITE DOWN:*\n`;
  out += `🔹 2G: ${count2g}\n`;
  out += `🔹 4G: ${count4g}\n\n`;
  out += `🔷 *DG Status*\n`;
  out += `🔹 ${dgRunning} of ${dgTotal} running\n\n`;
  out += `🔷 *POSISION PG*\n\n`;
  out += `🔹 PG Completed : ${pgCompleted}\n`;
  out += `🔹 PG installed : ${pgInstalled}\n`;
  out += `🔹 PG Movement  : ${pgMovement}\n\n`;
  out += `🔷 *POSISION PG*\n`;

  if (posPgLines.length > 0) {
    out += posPgLines.join('\n') + '\n';
  }

  return out.trim();
}

// 9. Render Preview Box
function renderFlashReportPreview() {
  const box = document.getElementById('fr-preview-box');
  const countLbl = document.getElementById('fr-preview-char-count');
  if (!box) return;

  const text = generateFlashReportText();
  box.value = text;

  if (countLbl) {
    const linesCount = text ? text.split('\n').length : 0;
    countLbl.textContent = `${text.length} characters | ${linesCount} lines`;
  }
}

// 10. Bind Actions & Listeners
const btnFrProcess = document.getElementById('btn-fr-process');
if (btnFrProcess) {
  btnFrProcess.addEventListener('click', () => {
    const txt = (document.getElementById('fr-txt-master')?.value || '').trim();
    if (!txt) {
      alert('Silakan paste data TSV Master Table terlebih dahulu!');
      return;
    }
    frMasterRows = parseFlashMasterTSV(txt);
    const statusLbl = document.getElementById('fr-master-status');
    if (statusLbl) {
      statusLbl.textContent = `✅ Berhasil memproses ${frMasterRows.length} baris Master Table.`;
      statusLbl.style.color = 'var(--grn)';
    }
    renderFrMasterTable();
    updateFrStats();
    renderFlashReportPreview();
  });
}

const btnFrLoadMain = document.getElementById('btn-fr-load-main');
if (btnFrLoadMain) {
  btnFrLoadMain.addEventListener('click', () => {
    // 1. Try from txtMaster if available
    const txtMain = (document.getElementById('txt-master')?.value || '').trim();
    if (txtMain) {
      document.getElementById('fr-txt-master').value = txtMain;
      frMasterRows = parseFlashMasterTSV(txtMain);
    } else if (typeof statusData !== 'undefined' && statusData && statusData.length > 0) {
      // 2. Or map from statusData
      frMasterRows = statusData.map(s => {
        const remLow = (s.remark || '').toLowerCase();
        return {
          siteId: s.new_site || s.site_id || '',
          siteName: s.site_name || '',
          mcCluster: s.cluster || '',
          cluster: s.cluster || '',
          netLabel: (s.category && s.category.includes('2G')) ? '2G' : '4G',
          is2G: (s.category && s.category.includes('2G')),
          is4G: !(s.category && s.category.includes('2G')),
          impact: s.impact || s.status || '',
          remark: s.remark || '',
          region: (typeof getSiteRegion === 'function') ? getSiteRegion(s) : 'CJN',
          matchesFilter: remLow.includes('otw') || remLow.includes('onsite') || remLow.includes('priority')
        };
      });
    } else {
      alert('Belum ada data di Master Data utama. Silakan paste data di tab Data atau paste langsung di sini.');
      return;
    }

    const statusLbl = document.getElementById('fr-master-status');
    if (statusLbl) {
      statusLbl.textContent = `✅ Dimuat ${frMasterRows.length} baris dari Master Data utama.`;
      statusLbl.style.color = 'var(--accent)';
    }

    renderFrMasterTable();
    updateFrStats();
    renderFlashReportPreview();
  });
}

const btnFrClear = document.getElementById('btn-fr-clear');
if (btnFrClear) {
  btnFrClear.addEventListener('click', () => {
    document.getElementById('fr-txt-master').value = '';
    frMasterRows = [];
    document.getElementById('fr-master-status').textContent = 'Data dikosongkan.';
    renderFrMasterTable();
    updateFrStats();
    renderFlashReportPreview();
  });
}

// Add Manual Position PG with auto DB lookup
const btnFrAddManual = document.getElementById('btn-fr-add-manual');
if (btnFrAddManual) {
  btnFrAddManual.addEventListener('click', async () => {
    const siteIdInput = document.getElementById('fr-manual-site-id');
    const remarkInput = document.getElementById('fr-manual-remark');
    const siteId = (siteIdInput?.value || '').trim();
    const remark = (remarkInput?.value || '').trim();

    if (!siteId) {
      alert('Site ID wajib diisi!');
      return;
    }

    let siteName = '';
    let cluster = '';
    let region = 'CJS';

    // 1. First look up from SQLite DB if available
    try {
      if (typeof invoke === 'function') {
        const row = await invoke('lookup_site', { siteId });
        if (row) {
          siteName = row['Site Name'] || row.site_name || '';
          cluster = row['FM Office'] || row['Cluster (MC)'] || row.cluster || '';
          const area = (row['Area'] || row['Region'] || '').toUpperCase();
          if (area.includes('CJN') || area.includes('NORTH')) {
            region = 'CJN';
          } else if (area.includes('CJS') || area.includes('SOUTH')) {
            region = 'CJS';
          }
        }
      }
    } catch (e) {
      console.warn('lookup_site error for manual site:', e);
    }

    // 2. Fallback to frMasterRows
    if (!siteName) {
      const matchMaster = frMasterRows.find(r => (r.siteId || '').toUpperCase() === siteId.toUpperCase());
      if (matchMaster) {
        siteName = matchMaster.siteName || '';
        cluster = matchMaster.cluster || matchMaster.mcCluster || cluster;
        region = matchMaster.region || region;
      }
    }

    // 3. Fallback to statusData from main Data tab
    if (!siteName && typeof statusData !== 'undefined' && Array.isArray(statusData)) {
      const matchStatus = statusData.find(s => ((s.new_site || s.site_id || '').toUpperCase() === siteId.toUpperCase()));
      if (matchStatus) {
        siteName = matchStatus.site_name || '';
        cluster = matchStatus.cluster || cluster;
        const sReg = (matchStatus.region || matchStatus.area || '').toUpperCase();
        if (sReg.includes('CJN') || sReg.includes('NORTH')) region = 'CJN';
        else if (sReg.includes('CJS') || sReg.includes('SOUTH')) region = 'CJS';
      }
    }

    // 4. Default if not in DB
    if (!siteName) {
      siteName = siteId;
    }
    if (!cluster) {
      cluster = '01CLUSTER';
    }

    frManualPgList.push({
      region,
      cluster,
      siteId,
      siteName,
      remark: remark || '-'
    });

    // Reset inputs
    if (siteIdInput) siteIdInput.value = '';
    if (remarkInput) remarkInput.value = '';

    renderFrManualTable();
    updateFrStats();
    renderFlashReportPreview();
  });

  // Enter key support
  ['fr-manual-site-id', 'fr-manual-remark'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnFrAddManual.click();
      }
    });
  });
}

// Sync Site Down button
const btnFrSyncSiteDown = document.getElementById('btn-fr-sync-sitedown');
if (btnFrSyncSiteDown) {
  btnFrSyncSiteDown.addEventListener('click', () => {
    updateFrStats();
    renderFlashReportPreview();
  });
}

// DG Status change listener
['fr-dg-running', 'fr-dg-total'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    const r = document.getElementById('fr-dg-running')?.value || 0;
    const t = document.getElementById('fr-dg-total')?.value || 0;
    const lbl = document.getElementById('lbl-dg-preview');
    if (lbl) lbl.textContent = `${r} of ${t} running`;
    renderFlashReportPreview();
  });
});

// Sync inputs to preview on change
['fr-input-2g', 'fr-input-4g', 'fr-time-input', 'fr-title-input', 'fr-mc-format', 'fr-pg-completed', 'fr-pg-installed', 'fr-pg-movement'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', renderFlashReportPreview);
  document.getElementById(id)?.addEventListener('change', renderFlashReportPreview);
});

// Generate button
document.getElementById('btn-fr-generate')?.addEventListener('click', renderFlashReportPreview);

// Copy button
const btnFrCopy = document.getElementById('btn-fr-copy');
if (btnFrCopy) {
  btnFrCopy.addEventListener('click', () => {
    const box = document.getElementById('fr-preview-box');
    if (!box || !box.value.trim()) {
      alert('Tidak ada teks untuk disalin!');
      return;
    }
    navigator.clipboard.writeText(box.value.trim()).then(() => {
      const oldT = btnFrCopy.textContent;
      btnFrCopy.textContent = '✓ Copied!';
      setTimeout(() => { btnFrCopy.textContent = oldT; }, 1800);
    }).catch(err => {
      alert('Gagal menyalin: ' + err);
    });
  });
}

// Auto-populate hour time like broadcast on init
(() => {
  const timeInp = document.getElementById('fr-time-input');
  if (timeInp) {
    let now = new Date();
    if (now.getMinutes() >= 30) {
      now.setHours(now.getHours() + 1);
    }
    now.setMinutes(0, 0, 0);
    timeInp.value = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
  }
})();


