/**
 * Renders the Bulk TE Handover and Single/Batch Site Handover modals with zero inline styles.
 */
export function renderHandoverModals() {
  return `
    <!-- Modal Handover / Pergantian TE Massal -->
    <div id="modal-handover-te" class="modal">
      <div class="modal-card-handover-te">
        <div class="modal-header-row">
          <h3 class="modal-h3-accent">Handover &amp; Pergantian Personel TE</h3>
          <button type="button" id="btn-close-handover-x" class="tbtn-clr modal-close-xs">✕</button>
        </div>

        <p class="modal-desc-sm">
          Ganti personel TE lama ke TE baru secara massal. Sistem akan otomatis memperbarui database site aktif (in-memory) dan daftar kontak WhatsApp.
        </p>

        <div class="flex-col gap-12 mb-16">
          <div>
            <label class="form-label-bold-sm">TE Lama (Yang Akan Diganti):</label>
            <select id="sel-handover-old-te" class="fi fi-select-md">
              <option value="">-- Pilih TE Lama --</option>
            </select>
          </div>

          <div class="grid-2 gap-10">
            <div>
              <label class="form-label-bold-sm">Nama TE Baru:</label>
              <input type="text" id="inp-handover-new-te" class="fi fi-input-md" placeholder="Nama Lengkap TE Baru">
            </div>
            <div>
              <label class="form-label-bold-sm">Nomor WA TE Baru:</label>
              <input type="text" id="inp-handover-new-phone" class="fi fi-input-md" placeholder="08... / 628...">
            </div>
          </div>

          <div>
            <label class="form-label-bold-sm">Cakupan Wilayah / Cluster:</label>
            <select id="sel-handover-cluster" class="fi fi-select-md">
              <option value="ALL">Semua Cluster (Global Reassign)</option>
            </select>
          </div>

          <div id="handover-summary-box" class="handover-summary-box">
            Pilih TE lama untuk melihat estimasi site yang terdampak.
          </div>
        </div>

        <div class="modal-footer-end">
          <button type="button" id="btn-cancel-handover" class="tbtn-clr btn-handover-cancel">Batal</button>
          <button type="button" id="btn-execute-handover" class="tbtn-p btn-handover-exec">Terapkan Pergantian</button>
        </div>
      </div>
    </div>

    <!-- Modal Handover New Site / BTS -->
    <div id="modal-handover-site" class="modal">
      <div class="modal-card-handover-site">
        <div class="modal-header-row">
          <h3 class="modal-h3-purple"><span>🔄</span> Handover New Site / BTS</h3>
          <button type="button" id="btn-close-handover-site-x" class="tbtn-clr modal-close-xs">✕</button>
        </div>

        <p class="modal-desc-sm">
          Pindah kepemilikan site/BTS dari TE lama ke TE baru. Perubahan disimpan secara virtual di memori dan dapat diexport / direload via file <b>.json</b> tanpa merusak Master Database Excel.
        </p>

        <div class="segmented-control hos-seg-wrap">
          <button type="button" class="pill active seg-btn hos-seg-btn" id="hos-tab-single">Single Site</button>
          <button type="button" class="pill seg-btn hos-seg-btn" id="hos-tab-batch">Batch Multi-Site</button>
        </div>

        <div id="hos-pane-single" class="hos-pane">
          <div class="flex-row gap-8">
            <div class="flex-1">
              <input type="text" id="inp-hos-search-site" class="fi hos-input-upper"
                placeholder="Ketik New Site ID (misal: JTG001, BYS002)...">
            </div>
            <button type="button" id="btn-hos-check-site" class="tbtn-p btn-hos-check">Cari Site</button>
            <button type="button" id="btn-hos-clear-site" class="tbtn-clr btn-hos-clear">Clear</button>
          </div>

          <div id="hos-site-preview" class="hos-preview-card">
            <div>
              <span class="hos-prev-kicker">Site ID / Nama</span>
              <span id="hos-prev-site-name" class="hos-prev-site-name">Belum dipilih</span>
              <span id="hos-prev-site-id" class="hos-prev-site-id">—</span>
            </div>
            <div>
              <span class="hos-prev-kicker">Cluster (MC)</span>
              <span id="hos-prev-cluster" class="hos-prev-cluster">—</span>
            </div>
            <div>
              <span class="hos-prev-kicker">TE Saat Ini (Lama)</span>
              <span id="hos-prev-old-te" class="hos-prev-old-te">—</span>
            </div>
            <div>
              <span class="hos-prev-kicker">Nomor WA TE Lama</span>
              <span id="hos-prev-old-phone" class="hos-prev-old-phone">—</span>
            </div>
          </div>
        </div>

        <div id="hos-pane-batch" class="hos-pane hidden">
          <label class="form-label-bold-sm">Daftar Site ID (Pisahkan dengan baris baru, koma, atau spasi):</label>
          <textarea id="inp-hos-batch-sites" class="fi hos-batch-textarea" rows="4"
            placeholder="Contoh:&#10;JTG001&#10;JTG002&#10;SUB105"></textarea>
          <div class="hos-batch-footer">
            <span id="hos-batch-count-info">0 Site ID dimasukkan</span>
            <button type="button" id="btn-hos-batch-validate" class="tbtn btn-hos-validate">Validasi di DB</button>
          </div>
        </div>

        <div class="hos-target-box">
          <div class="hos-target-heading">Target TE Baru (Penerima Handover)</div>
          <div class="grid-2 gap-8">
            <div>
              <label class="hos-field-label">Pilih dari Kontak TE:</label>
              <select id="sel-hos-new-te" class="fi fi-select-sm">
                <option value="">-- Pilih TE Terdaftar --</option>
              </select>
            </div>
            <div>
              <label class="hos-field-label">Atau Ketik Nama TE Baru:</label>
              <input type="text" id="inp-hos-new-te" class="fi fi-select-sm" placeholder="Nama Lengkap TE Baru">
            </div>
          </div>
          <div class="grid-2 gap-8">
            <div>
              <label class="hos-field-label">Nomor WA TE Baru:</label>
              <input type="text" id="inp-hos-new-phone" class="fi fi-select-sm" placeholder="08... / 628...">
            </div>
            <div>
              <label class="hos-field-label">Catatan / Keterangan (Opsional):</label>
              <input type="text" id="inp-hos-note" class="fi fi-select-sm"
                placeholder="Misal: Shift Pagi, Pindah Cluster, Backup">
            </div>
          </div>
          <div class="flex-row justify-end mt-4">
            <button type="button" id="btn-execute-handover-site" class="tbtn-p btn-hos-exec-purple">
              ⚡ Terapkan Handover Site
            </button>
          </div>
        </div>

        <div class="hos-history-section">
          <div class="flex-between mb-6">
            <div class="flex-row gap-6">
              <span class="hos-prev-kicker text-primary-1">Daftar Site yang Diubah</span>
              <span id="hos-history-badge" class="badge hos-history-badge">0 site</span>
            </div>
            <input type="text" id="inp-hos-filter-history" class="fi hos-filter-inp" placeholder="Filter site...">
          </div>

          <div class="hos-history-scroll">
            <table class="dt hos-history-table">
              <thead>
                <tr class="hos-sticky-th-row">
                  <th class="hos-th">Site ID</th>
                  <th class="hos-th">Site Name</th>
                  <th class="hos-th">Cluster</th>
                  <th class="hos-th">TE Lama</th>
                  <th class="hos-th">TE Baru (No WA)</th>
                  <th class="hos-th">Waktu</th>
                  <th class="hos-th-center">Aksi</th>
                </tr>
              </thead>
              <tbody id="hos-history-tbody">
                <tr>
                  <td colspan="7" class="hos-empty-cell">Belum ada site yang diubah di sesi ini.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="hos-history-footer">
          <div class="flex-row gap-6">
            <button type="button" id="btn-hos-load-json" class="tbtn-load btn-hos-json-load">📥 Load .json</button>
            <button type="button" id="btn-hos-save-json" class="tbtn-load btn-hos-json-save">💾 Save .json</button>
            <button type="button" id="btn-hos-reset-all" class="tbtn-clr btn-hos-reset">Reset Semua</button>
          </div>
          <div>
            <button type="button" id="btn-close-handover-site" class="tbtn-clr btn-hos-close">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

