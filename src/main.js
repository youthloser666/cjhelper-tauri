const tauriCore = window.__TAURI__ ? window.__TAURI__.core : null;
const invoke = tauriCore ? tauriCore.invoke : null;
let checkFn = null;
let pivotData = [];
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
  btnTheme.textContent = isLight ? '☀️ Light' : '🌙 Dark';
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
    document.getElementById(targetId).classList.remove('hidden');

    // Auto-generate WA Broadcast message when navigating to Broadcast tab to ensure actual data
    if (targetId === 'tab-wa') {
      const btnGenWa = document.getElementById('btn-gen-wa');
      if (btnGenWa) {
        btnGenWa.click();
      }
    }
  });
});

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

function renderStatus() {
  const filterStatus = document.querySelector('#st-filter-status .active')?.dataset.val || 'ALL';
  const sortDur = document.querySelector('#st-filter-sort .active')?.dataset.val || 'none';
  const searchStr = document.getElementById('st-search').value.toLowerCase().trim();

  let filtered = statusData;

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
    let upCount = 0;
    let downCount = 0;

    statusData.forEach(s => {
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

  statusBar.textContent = "Memproses data...";
  try {
    const res = await invoke('parse_pasted_table', { text });
    dashMaster.textContent = res.count;

    if (res.status === "UNCHANGED") {
      statusBar.textContent = `⚠️ Data sama — ✅ snapshot dipertahankan. (${res.count} baris, ${new Date().toLocaleTimeString('id-ID')})`;
    } else if (res.status === "UPDATED_DETAILS") {
      statusBar.textContent = `✅ Detail diperbarui — snapshot dipertahankan. (${res.count} baris, ${new Date().toLocaleTimeString('id-ID')})`;
    } else if (res.status === "NEW_BASELINE") {
      document.getElementById('lbl-snapshot').textContent = `Baseline: ${res.count} baris (proses pertama)`;
      statusBar.textContent = `Selesai! Data: ${res.count} baris diproses.`;
    } else if (res.status === "UPDATED") {
      document.getElementById('lbl-snapshot').textContent = `Snapshot ${res.count} baris — disimpan pukul ${new Date().toLocaleTimeString('id-ID')}`;
      statusBar.textContent = `Selesai! Data: ${res.count} baris diproses.`;
    } else {
      statusBar.textContent = `Selesai! Data kosong atau format tidak dikenali.`;
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
        document.getElementById('lbl-cek-db').textContent = `Memuat file ${selectedPath.split(/[\\/]/).pop()}...`;
        document.getElementById('lbl-cek-db').className = "text-info text-sm";
        // Give UI time to update
        await new Promise(r => setTimeout(r, 50));

        const count = await invoke('load_db_excel', { path: selectedPath });
        document.getElementById('dash-db').textContent = count;
        document.getElementById('lbl-cek-db').textContent = `DB Loaded: ${selectedPath.split(/[\\/]/).pop()} (${count} baris)`;
        document.getElementById('lbl-cek-db').className = "text-success text-sm";
      } else {
        document.getElementById('lbl-cek-db').textContent = "Batal memilih file.";
        document.getElementById('lbl-cek-db').className = "text-warning text-sm";
      }
    } catch (err) {
      document.getElementById('lbl-cek-db').textContent = "Error: " + err;
      document.getElementById('lbl-cek-db').className = "text-error text-sm";
      console.error(err);
    }
  });
}

document.getElementById('btn-reset-snap').addEventListener('click', async () => {
  try {
    await invoke('reset_snapshot');
    await invoke('clear_data');
    txtMaster.value = '';
    dashMaster.textContent = '0';
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
    const st = status.status || "DISCONNECTED";
    const qr = status.qr;

    // Adaptive interval
    const nextInterval = (st === "QR_READY") ? 2000 : 10000;
    if (nextInterval !== waPollInterval) {
      waPollInterval = nextInterval;
      startWaPolling();
    }

    if (waStatusText) {
      waStatusText.textContent = st;
      if (st === "CONNECTED") {
        waStatusText.style.color = "var(--grn)";
        waStatusText.textContent = "CONNECTED";
        document.getElementById('srv-dot-indicator')?.classList.replace('srv-off', 'srv-on');
        document.getElementById('wa-qr-modal')?.classList.add('hidden');
      } else if (st === "QR_READY") {
        waStatusText.style.color = "var(--amb)";
        waStatusText.textContent = "SCAN QR";
        document.getElementById('srv-dot-indicator')?.classList.replace('srv-on', 'srv-off');

        if (qr) {
          const qrImg = document.getElementById('wa-qr-img');
          const qrModal = document.getElementById('wa-qr-modal');
          const newSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr)}`;
          if (qrImg && qrImg.src !== newSrc) {
            qrImg.src = newSrc;
          }
          if (qrModal && qrModal.classList.contains('hidden')) {
            qrModal.classList.remove('hidden');
            qrModal.style.display = 'flex';
          }
        }
      } else {
        waStatusText.style.color = "var(--red)";
        document.getElementById('srv-dot-indicator')?.classList.replace('srv-on', 'srv-off');
        // Don't auto-hide if user manually closed it, but hide if server stopped
        if (st === "DISCONNECTED") document.getElementById('wa-qr-modal')?.classList.add('hidden');
      }
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

document.getElementById('btn-close-wa-qr').addEventListener('click', () => {
  const modal = document.getElementById('wa-qr-modal');
  modal.classList.add('hidden');
  modal.style.display = 'none';
});

if (btnWaStatus) btnWaStatus.addEventListener('click', checkWaStatus);
startWaPolling();

if (btnWaStart) {
  btnWaStart.addEventListener('click', async () => {
    try {
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
        return;
      }

      if (waStatusText) waStatusText.textContent = "Starting...";
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
        btnWaReset.innerHTML = "🔌 Reset WA";
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
  const ful = natSort(downs.filter(s => s.impact && s.impact.toLowerCase().includes('fully')));
  const cel = natSort(downs.filter(s => !s.impact || !s.impact.toLowerCase().includes('fully')));

  const bcch_kw = (fmtBc.key_bcch || "BCCH").toUpperCase();
  const cel_bcch = cel.filter(s => (s.remark || "").toUpperCase().includes(bcch_kw));
  const cel_normal = cel.filter(s => !((s.remark || "").toUpperCase().includes(bcch_kw)));

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
        sysRows.forEach(row => {
          parts.push(formatStollenLine(row));
        });
        parts.push("");
      }
    });

    const cableStollenRows = pivotData.filter(r => r.monitoring === 'CABLE STOLLEN');
    const cableStollenSystems = [...new Set(cableStollenRows.map(r => r.system))];
    cableStollenSystems.forEach(sys => {
      const sysRows = cableStollenRows.filter(r => r.system === sys);
      if (sysRows.length > 0) {
        parts.push(`*INDIKASI CABLE STOLLEN ${sys}*`);
        sysRows.forEach(row => {
          parts.push(formatCableStollenLine(row));
        });
        parts.push("");
      }
    });
  }

  const sec_sd = (fmtBc.lbl_sd || "SITE DOWN :").replace(/:/g, "").trim();
  const sec_cd = (fmtBc.lbl_cd || "CELLS DOWN :").replace(/:/g, "").trim();
  const sec_bcch = (fmtBc.lbl_bcch || "CELL DOWN BCCH Missing NOKIA :").trim();

  const toLines = (items) => {
    return items.map(s => {
      const isFully = s.impact.toLowerCase().includes('fully');
      const combined = (s.category + " " + s.impact).toUpperCase().replace(/[-_\s]+/g, ' ');
      const isHub = combined.includes('HUB') && (combined.includes('MEDIUM') || combined.includes('BIG'));
      const isCritical = s.site_class.toUpperCase().includes('CRITICAL');
      const icon = (isHub || isCritical) ? "⚠️" : (fmtBc.icon_down || "▶️");

      let entryTime = s.start_time || "";
      if (s.start_timestamp > 0) {
        const d = new Date(s.start_timestamp * 1000);
        entryTime = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()} | ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
      }

      const ctx = {
        icon: icon,
        rts: s.rts || "",
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
      if (showRemark && s.remark && (fmtBc.msg_remark || " / {remark}").trim()) {
        ln += (fmtBc.msg_remark || " / {remark}").replace(/\{(\w+)\}/g, (_, k) => ctx[k] || "");
      }
      return ln;
    }).join("\n");
  };

  const ful_hw = ful.filter(e => (e.vendor || "").toUpperCase().includes("HUA"));
  const ful_nok = ful.filter(e => (e.vendor || "").toUpperCase().includes("NOK"));
  const ful_oth = ful.filter(e => !(e.vendor || "").toUpperCase().includes("HUA") && !(e.vendor || "").toUpperCase().includes("NOK"));

  if (ful_hw.length > 0) { parts.push(`*${sec_sd} MOCN HUAWEI :: ${ful_hw.length}*`); parts.push(toLines(ful_hw)); parts.push(""); }
  if (ful_nok.length > 0) { parts.push(`*${sec_sd} MOCN NOKIA :: ${ful_nok.length}*`); parts.push(toLines(ful_nok)); parts.push(""); }
  if (ful_oth.length > 0) { parts.push(`*${sec_sd}*`); parts.push(toLines(ful_oth)); parts.push(""); }
  if (ful.length === 0) { parts.push(`*${sec_sd}*`); parts.push("- Nihil -"); parts.push(""); }

  // 2. Append Enva Alarms below Site Down
  if (typeof pivotData !== 'undefined' && pivotData.length > 0) {
    const envaRows = pivotData.filter(r => r.monitoring === 'POWER NOW' || r.monitoring.includes('POWER') || r.monitoring.includes('ENVA'));
    const envaSystems = [...new Set(envaRows.map(r => r.system))];
    envaSystems.forEach(sys => {
      const sysRows = envaRows.filter(r => r.system === sys);
      if (sysRows.length > 0) {
        parts.push(`*ENVA POWER ${sys} : : ${sysRows.length}*`);
        sysRows.forEach(row => {
          parts.push(formatEnvaLine(row));
        });
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

    try {
      const targets = selected.map(g => ({ group_id: g.group_id, message: waText }));
      const result = await invoke('wa_broadcast', { targets, delay_ms: 1500 });

      const success = result.success || 0;
      const total = result.total || 0;
      const failed = result.failed || 0;

      alert(`Broadcast selesai: ${success}/${total} berhasil${failed > 0 ? `, ${failed} gagal` : ""}`);

      // Add to logs
      const groupsArr = selected.map(g => g.group_name);
      addBroadcastLog(success, total, groupsArr);

    } catch (err) {
      alert("Error Broadcast: " + err);
    } finally {
      btnWaSend.disabled = false;
      btnWaSend.textContent = "KIRIM BROADCAST";
    }
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
let mapMarkers = [];

function initMap() {
  if (siteMap) return;
  siteMap = L.map('map-container').setView([-6.98, 110.42], 8); // Default Central Java
  const isLight = document.body.classList.contains('light');
  const tileUrl = isLight
    ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  mapTileLayer = L.tileLayer(tileUrl, {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
    crossOrigin: true
  }).addTo(siteMap);
}

function updateMapTheme(isLight) {
  if (siteMap && mapTileLayer) {
    const tileUrl = isLight
      ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    mapTileLayer.setUrl(tileUrl);
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
    document.getElementById('btn-map-plot-down').textContent = "📍 Plot DOWN Sites";
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
let broadcastLogs = [];

async function loadWaConfig() {
  try {
    const cfg = await invoke('get_wa_config');
    savedWaGroups = cfg.saved_groups || [];
  } catch (e) {
    console.warn("WA Config not loaded", e);
  }
}

function renderWaGroups(filter = "") {
  const tbody = document.getElementById('wa-groups-tbody');
  tbody.innerHTML = '';

  const savedIds = new Set(savedWaGroups.map(g => g.group_id));

  let visible = 0;
  waGroups.filter(g => !filter || g.name.toLowerCase().includes(filter.toLowerCase())).forEach(g => {
    visible++;
    const tr = document.createElement('tr');
    const isChecked = savedIds.has(g.id);

    tr.innerHTML = `
      <td class="text-center" style="width: 50px;">
        <input type="checkbox" class="wa-grp-chk checkbox" data-id="${g.id}" data-name="${g.name}" ${isChecked ? 'checked' : ''}>
      </td>
      <td class="${isChecked ? 'text-success' : 'text-subtle'} font-bold">${g.name}</td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const chk = tr.querySelector('input');
        chk.checked = !chk.checked;
        const event = new Event('change');
        chk.dispatchEvent(event);
      }
    });

    tr.querySelector('input').addEventListener('change', (e) => {
      const td = tr.querySelector('td:nth-child(2)');
      if (e.target.checked) {
        td.classList.replace('text-subtle', 'text-success');
      } else {
        td.classList.replace('text-success', 'text-subtle');
      }
    });

    tbody.appendChild(tr);
  });

  document.getElementById('wa-search-count').textContent = filter ? `${visible}/${waGroups.length} grup` : "";
}

document.getElementById('btn-wa-refresh-groups').addEventListener('click', async () => {
  try {
    const btn = document.getElementById('btn-wa-refresh-groups');
    const oldT = btn.textContent;
    btn.textContent = "Memuat...";

    const status = await invoke('wa_groups');
    waGroups = status.groups || [];
    renderWaGroups(document.getElementById('wa-group-search').value);

    btn.textContent = oldT;
  } catch (e) {
    alert("Gagal memuat grup: " + e);
    document.getElementById('btn-wa-refresh-groups').textContent = "🔄 Refresh dari WA";
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
  const chks = document.querySelectorAll('.wa-grp-chk:checked');
  const toSave = Array.from(chks).map(c => ({
    group_id: c.dataset.id,
    group_name: c.dataset.name
  }));

  try {
    await invoke('save_wa_groups', { savedGroups: toSave });
    savedWaGroups = toSave; renderWaTargets();
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
    document.getElementById('btn-db-export').textContent = "📥 Export DB (Save As)";
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
  const isFully = s.impact.toLowerCase().includes('fully');
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
  let rawMap = {};

  if (pmMode === 'cluster') {
    downSites.forEach(s => {
      // Group by Cluster AND TE Name (pic) to match Python parity
      const cluster = s.cluster || 'UNKNOWN';
      const pic = s.pic || "";
      const key = `${cluster}|${pic}`;

      if (!rawMap[key]) {
        rawMap[key] = {
          cluster: cluster,
          pic: pic,
          te: pic,
          rts: s.rts || "",
          entries: []
        };
      }

      const fmt = formatSingleLine(s, fmtMsg, pmShowRemark);
      rawMap[key].entries.push({ ...s, ...fmt });

      // Update RTS if the group RTS is empty but a site has one
      if (!rawMap[key].rts && s.rts) rawMap[key].rts = s.rts;
    });
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

    btnMapSearch.textContent = '⏳ ...';

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
            btnMapSearch.textContent = '🔍 Cari';
            return alert(`'${val}' tidak ditemukan sebagai Site ID, Koordinat, maupun Alamat.`);
          }
        }
      }

      if (isNaN(lat) || isNaN(lon) || lat === 0) {
        btnMapSearch.textContent = '🔍 Cari';
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

      const targetMarker = L.marker([lat, lon], { icon }).addTo(siteMap)
        .bindPopup(`<b>${isSite ? 'BTS Site' : 'Lokasi Pelanggan'}</b><br>${title}`).openPopup();
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
            const m = L.marker([s.lat, s.lon], { icon: sIcon }).addTo(siteMap)
              .bindPopup(`<div style="font-family:var(--ui);font-size:12px;"><b>${s.site_id}</b><br>${s.site_name}<br>Jarak: ${s.distance_km.toFixed(2)} KM${remarkHtml}</div>`);
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
      btnMapSearch.textContent = '🔍 Cari';
    }
  });

  document.getElementById('btn-close-nearest')?.addEventListener('click', () => {
    document.getElementById('map-nearest-panel').classList.add('hidden');
  });

  mapSiteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnMapSearch.click();
  });

  btnMapStreet.addEventListener('click', async () => {
    const sid = mapSiteInput.value.trim();
    if (!sid) return alert('Masukkan Site ID!');

    try {
      const row = await invoke('lookup_site', { siteId: sid });
      if (!row) {
        return alert(`Site ${sid} tidak ditemukan di database!`);
      }

      const lat = parseFloat(row['Latitude']);
      const lon = parseFloat(row['Longitude']);

      if (isNaN(lat) || isNaN(lon)) {
        return alert(`Koordinat untuk ${sid} tidak valid atau kosong.`);
      }

      const url = `http://maps.google.com/maps?q=&layer=c&cbll=${lat},${lon}`;
      await invoke('open_url', { url });

    } catch (e) {
      alert(`Error: ${e}`);
    }
  });

  const btnMapScreenshot = document.getElementById('btn-map-screenshot');
  if (btnMapScreenshot) {
    btnMapScreenshot.addEventListener('click', async () => {
      const mapElem = document.querySelector('.map-wrap') || document.getElementById('map-container');
      if (!mapElem) return alert('Elemen peta tidak ditemukan!');

      const oldText = btnMapScreenshot.innerHTML;
      btnMapScreenshot.disabled = true;
      btnMapScreenshot.innerHTML = '⏳ Capturing...';

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
      btnCheckUpdate.textContent = "🔍 Cek Update Sekarang";
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

function formatStollenLine(row) {
  const formattedDate = formatPivotDate(row.tanggal);
  return `❗ / ${row.rtsName || row.teName || row.newTe || "0"} / ${row.cluster} / ${row.newId} / ${row.siteName} / ${row.category} / ${formattedDate} /`;
}

function formatCableStollenLine(row) {
  const formattedDate = formatPivotDate(row.tanggal);
  return `▶️ / ${row.rtsName || row.teName || row.newTe || "0"} / ${row.cluster} / ${row.newId} / ${row.siteName} / ${row.category} / ${formattedDate} /`;
}

function formatEnvaLine(row) {
  const formattedDate = formatPivotDate(row.tanggal);
  const agingStr = calculatePivotAging(row.tanggal);
  return `▶️ / ${row.teName || row.newTe || "0"} / ${row.cluster} / ${row.newId} / ${row.siteName} / ${row.category} / ${formattedDate} / ${agingStr} |`;
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

    const label = parts[colIndices.rowLabels] || "";
    const monitoring = parts[colIndices.monitoring] || "";
    const systemVal = parts[colIndices.system] || "";

    if (monitoring.toUpperCase() === 'GRAND TOTAL' || label.toUpperCase() === 'GRAND TOTAL') continue;

    const newId = parts[colIndices.newId] || "";

    if (!newId || newId === '0' || newId === '') {
      if (systemVal && systemVal !== '0') {
        currentSystem = systemVal.toUpperCase();
      }
      continue;
    }

    const cluster = parts[colIndices.cluster] || "";
    const siteName = parts[colIndices.siteName] || "";
    const tanggal = parts[colIndices.tanggal] || "";
    const category = parts[colIndices.category] || "";
    const newTe = parts[colIndices.newTe] || "";

    rows.push({
      monitoring: monitoring.toUpperCase(),
      system: currentSystem || systemVal.toUpperCase() || "HUAWEI",
      cluster,
      newId,
      siteName,
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
    if (invoke) {
      try {
        const dbInfo = await invoke('lookup_site', { siteId: row.newId });
        if (dbInfo && dbInfo['TE Name']) {
          row.teName = dbInfo['TE Name'];
        } else {
          row.teName = row.newTe;
        }
        if (dbInfo && dbInfo['RTS Name']) {
          row.rtsName = dbInfo['RTS Name'];
        }
      } catch (err) {
        console.error("DB lookup failed for", row.newId, err);
        row.teName = row.newTe;
      }
    } else {
      row.teName = row.newTe;
    }
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

  renderPivotTable();
});

renderPivotTable();

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
  const rem = (remark || "").trim();
  if (!rem) return true; // kosong → kirim
  
  const keywords = ["fu team", "follow up team", "plan ts today"];
  const remLower = rem.toLowerCase();
  
  // Hanya kirim jika remark persis sama dengan salah satu keyword
  return keywords.some(kw => remLower === kw);
}

function getTeMessageItemCount(sites, cluster) {
  const bcchKw = (fmtMsg && fmtMsg.key_bcch || "BCCH").toUpperCase();
  const sitedownFiltered = [];
  const celldownFiltered = [];
  const celldownBcchFiltered = [];

  sites.forEach(s => {
    const isFully = s.impact && s.impact.toLowerCase().includes('fully');
    const isBcch = s.remark && s.remark.toUpperCase().includes(bcchKw);
    if (isFully) {
      if (shouldSendToTe(s.remark)) sitedownFiltered.push(s);
    } else if (isBcch) {
      celldownBcchFiltered.push(s);
    } else {
      if (shouldSendToTe(s.remark)) celldownFiltered.push(s);
    }
  });

  const clusterUpper = (cluster || "").toUpperCase();
  const stollenRows = (pivotData || []).filter(r => r.monitoring === 'STOLLEN' && r.cluster && r.cluster.toUpperCase() === clusterUpper);
  const cableStollenRows = (pivotData || []).filter(r => r.monitoring === 'CABLE STOLLEN' && r.cluster && r.cluster.toUpperCase() === clusterUpper);
  const envaAlarmRows = (pivotData || []).filter(r => (r.monitoring.includes('POWER') || r.monitoring.includes('ENVA')) && !r.monitoring.includes('NETECO') && r.cluster && r.cluster.toUpperCase() === clusterUpper);
  const envaNetecoRows = (pivotData || []).filter(r => r.monitoring.includes('NETECO') && r.cluster && r.cluster.toUpperCase() === clusterUpper);

  return {
    total: sitedownFiltered.length + celldownFiltered.length + celldownBcchFiltered.length + stollenRows.length + cableStollenRows.length + envaAlarmRows.length + envaNetecoRows.length
  };
}

function generateTeMessage(teName, sites, cluster) {
  const bcchKw = (fmtMsg && fmtMsg.key_bcch || "BCCH").toUpperCase();
  const sitedownFiltered = [];
  const celldownFiltered = [];
  const celldownBcchFiltered = [];

  sites.forEach(s => {
    const isFully = s.impact && s.impact.toLowerCase().includes('fully');
    const isBcch = s.remark && s.remark.toUpperCase().includes(bcchKw);
    if (isFully) {
      if (shouldSendToTe(s.remark)) sitedownFiltered.push(s);
    } else if (isBcch) {
      celldownBcchFiltered.push(s);
    } else {
      if (shouldSendToTe(s.remark)) celldownFiltered.push(s);
    }
  });

  const clusterUpper = (cluster || "").toUpperCase();
  const stollenRows = (pivotData || []).filter(r => r.monitoring === 'STOLLEN' && r.cluster && r.cluster.toUpperCase() === clusterUpper);
  const cableStollenRows = (pivotData || []).filter(r => r.monitoring === 'CABLE STOLLEN' && r.cluster && r.cluster.toUpperCase() === clusterUpper);
  const envaAlarmRows = (pivotData || []).filter(r => (r.monitoring.includes('POWER') || r.monitoring.includes('ENVA')) && !r.monitoring.includes('NETECO') && r.cluster && r.cluster.toUpperCase() === clusterUpper);
  const envaNetecoRows = (pivotData || []).filter(r => r.monitoring.includes('NETECO') && r.cluster && r.cluster.toUpperCase() === clusterUpper);

  const parts = [];
  parts.push(`*INFO SITE DOWN - TE: ${teName.toUpperCase()}*`);
  parts.push("");
  parts.push("Rekan TE yth, mohon bantuannya untuk pengecekan site down berikut:");
  parts.push("");

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

  parts.push("Terima kasih atas kerjasamanya.");
  return parts.join("\n").trim();
}

async function loadWaTeContacts() {
  try {
    const res = await invoke('get_wa_te_contacts');
    savedWaTeContacts = res.contacts || [];
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
        <button class="tbtn-clr btn-wa-te-delete" style="padding:2px 8px; font-size:11px; background:var(--red-d); color:var(--red); border-color:rgba(255,79,94,0.2);">✕ Hapus</button>
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
      btnWaTeSave.textContent = "💾 Simpan Perubahan";
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

// WA Blast TE Main trigger in tab-pm
if (btnPmWaBlast) {
  btnPmWaBlast.addEventListener('click', async () => {
    try {
      const check = await invoke('wa_status');
      if (!check || check.status !== "CONNECTED") {
        alert("WhatsApp belum CONNECTED. Silakan aktifkan server dan hubungkan akun WA Anda di tab Broadcast.");
        return;
      }
    } catch (e) {
      alert("Gagal mengecek status WA. Pastikan server Node sudah berjalan. Error: " + e);
      return;
    }

    const downSites = statusData.filter(s => s.status === 'DOWN');
    if (downSites.length === 0) {
      alert("Tidak ada site DOWN saat ini.");
      return;
    }

    // Refresh contact list from DB
    await loadWaTeContacts();

    currentTeGroups = {};
    downSites.forEach(s => {
      const teName = s.pic || "Unknown TE";
      const cluster = s.cluster || "";
      
      // Match in local contacts DB first
      const localContact = savedWaTeContacts.find(c => 
        (c.name || "").trim().toUpperCase() === teName.trim().toUpperCase() &&
        (c.cluster || "").trim().toUpperCase() === cluster.trim().toUpperCase()
      );
      
      let tePhone = "";
      if (localContact && localContact.phone) {
        tePhone = localContact.phone;
      } else {
        tePhone = s.te_phone || "";
      }
      
      const key = `${teName}|${cluster}`;
      
      if (!currentTeGroups[key]) {
        currentTeGroups[key] = {
          name: teName,
          cluster: cluster,
          phone: tePhone,
          sites: []
        };
      }
      currentTeGroups[key].sites.push(s);
    });

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
    btnCloseWaBlastTe.textContent = "Batal";
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
    waBlastTeTbody.innerHTML = '<tr><td colspan="5" class="text-center text-subtle py-4">Tidak ada data TE dengan site down.</td></tr>';
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
      <td class="font-bold text-success">${g.name} <small class="text-subtle" style="font-weight:normal;">(${g.cluster})</small></td>
      <td>
        <input type="text" class="fi wa-blast-te-phone-input" data-key="${key}" value="${g.phone}" placeholder="No WA (628...)" style="width:160px; font-size:13.5px; height:24px; padding:2px 6px;">
      </td>
      <td class="text-center"><span class="badge ${totalCount > 1 ? 'br' : 'bb'}">${totalCount}</span></td>
      <td class="wa-blast-te-status-cell text-subtle" data-key="${key}" style="font-size:14px; font-weight:600;">Ready</td>
    `;
    
    const chk = tr.querySelector('.wa-blast-te-chk');
    const phoneInput = tr.querySelector('.wa-blast-te-phone-input');
    
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

    waBlastTeTbody.appendChild(tr);
  });
}

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
      alert("Silakan pilih minimal 1 TE untuk di-blast.");
      return;
    }

    const confirmed = confirm(`Kirim pesan Japri ke ${selectedChks.length} TE?`);
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
      const existsIdx = savedWaTeContacts.findIndex(c => 
        (c.name || "").trim().toUpperCase() === g.name.trim().toUpperCase() &&
        (c.cluster || "").trim().toUpperCase() === g.cluster.trim().toUpperCase()
      );

      if (existsIdx === -1 && g.phone) {
        savedWaTeContacts.push({
          name: g.name.trim(),
          cluster: g.cluster.trim(),
          phone: g.phone.trim()
        });
        needSaveContacts = true;
      } else if (existsIdx !== -1 && g.phone) {
        if (savedWaTeContacts[existsIdx].phone !== g.phone.trim()) {
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
    waBlastTeProgressStatus.textContent = "Mulai mengirim...";

    const delayMs = parseInt(numWaBlastTeDelay.value) || 2000;

    for (let i = 0; i < blastTargets.length; i++) {
      const target = blastTargets[i];
      const statusCell = document.querySelector(`.wa-blast-te-status-cell[data-key="${target.key}"]`);
      
      if (statusCell) {
        statusCell.textContent = "⏳ Mengirim...";
        statusCell.style.color = "var(--amb)";
      }

      const percent = Math.round((i / blastTargets.length) * 100);
      waBlastTeProgressPercent.textContent = `${percent}%`;
      waBlastTeProgressFill.style.width = `${percent}%`;
      waBlastTeProgressStatus.textContent = `Mengirim ke ${target.name} (${i+1}/${blastTargets.length})...`;

      try {
        const result = await invoke('wa_broadcast', { 
          targets: [{ group_id: target.jid, message: target.message }],
          delay_ms: 0
        });

        const success = result && result.success > 0;
        if (success) {
          if (statusCell) {
            statusCell.textContent = "✅ Berhasil";
            statusCell.style.color = "var(--grn)";
          }
        } else {
          if (statusCell) {
            statusCell.textContent = "❌ Gagal";
            statusCell.style.color = "var(--red)";
          }
        }
      } catch (err) {
        console.error("Gagal blast ke TE:", target.name, err);
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
    waBlastTeProgressStatus.textContent = `Selesai mengirim ke ${blastTargets.length} TE!`;
    
    // Auto-save contacts to file if changes occurred
    if (needSaveContacts) {
      try {
        await invoke('save_wa_te_contacts', { contacts: savedWaTeContacts });
        console.log("Database kontak TE terupdate secara otomatis.");
      } catch (err) {
        console.warn("Gagal menyimpan kontak secara otomatis:", err);
      }
    }

    btnCloseWaBlastTe.textContent = "Tutup";
    btnCloseWaBlastTe.disabled = false;
  });
}
