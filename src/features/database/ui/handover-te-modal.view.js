import { createModalController } from '../../../shared/ui/modal-controller.js';
import { escapeHtml, getElementById } from '../../../shared/utils/dom-helpers.js';
import {
  collectHandoverTeNames,
  computeTeHandoverPreview,
  validateBulkTeHandoverInput,
} from '../logic/handover-service.js';

/**
 * Controls the Bulk TE Handover modal (`#modal-handover-te`).
 */
export function mountHandoverTeModalView({
  appStore,
  tauriBridge,
  onRecordBulkHandover = null,
  onReloadContacts = null,
}) {
  const modalEl = getElementById('modal-handover-te');
  const closeXBtn = getElementById('btn-close-handover-x');
  const cancelBtn = getElementById('btn-cancel-handover');
  const executeBtn = getElementById('btn-execute-handover');
  const selOldTe = getElementById('sel-handover-old-te');
  const inpNewTe = getElementById('inp-handover-new-te');
  const inpNewPhone = getElementById('inp-handover-new-phone');
  const selCluster = getElementById('sel-handover-cluster');
  const summaryBox = getElementById('handover-summary-box');

  const modalController = createModalController(modalEl, {
    closeButtonSelector: '#btn-close-handover-x, #btn-cancel-handover',
  });

  closeXBtn?.addEventListener('click', () => modalController.close('close-x'));
  cancelBtn?.addEventListener('click', () => modalController.close('cancel'));

  function open() {
    if (!modalEl || !selOldTe) return;
    const state = appStore.getState();
    const sortedNames = collectHandoverTeNames(
      state.waTeContacts || [],
      state.statusData || []
    );

    selOldTe.innerHTML = '<option value="">-- Pilih TE Lama yang Diganti --</option>';
    for (const name of sortedNames) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      selOldTe.appendChild(opt);
    }

    if (inpNewTe) inpNewTe.value = '';
    if (inpNewPhone) inpNewPhone.value = '';
    if (selCluster) {
      selCluster.innerHTML = '<option value="ALL">Semua Cluster (Global Reassign)</option>';
    }
    if (summaryBox) {
      summaryBox.textContent = 'Pilih TE lama untuk melihat estimasi site yang terdampak.';
    }

    modalController.open();
  }

  selOldTe?.addEventListener('change', () => {
    const oldName = selOldTe.value;
    if (!oldName) {
      if (selCluster) {
        selCluster.innerHTML = '<option value="ALL">Semua Cluster (Global Reassign)</option>';
      }
      if (summaryBox) {
        summaryBox.textContent = 'Pilih TE lama untuk melihat estimasi site yang terdampak.';
      }
      return;
    }

    const state = appStore.getState();
    const preview = computeTeHandoverPreview(
      oldName,
      state.waTeContacts || [],
      state.statusData || []
    );

    if (selCluster) {
      selCluster.innerHTML = '<option value="ALL">Semua Cluster (Global Reassign)</option>';
      for (const cl of preview.clusters) {
        const opt = document.createElement('option');
        opt.value = cl;
        opt.textContent = `Cluster: ${cl}`;
        selCluster.appendChild(opt);
      }
    }

    if (summaryBox) {
      summaryBox.innerHTML = `
        <strong>Terpilih:</strong> ${escapeHtml(oldName)}<br>
        • Kontak WA terdaftar: <b>${preview.clusters.length || 1} cluster</b> ${preview.contactPhone ? `(No lama: ${escapeHtml(preview.contactPhone)})` : ''}<br>
        • Site aktif di memory: <b>${preview.siteCount} site</b>
      `;
    }
  });

  executeBtn?.addEventListener('click', async () => {
    const oldTeName = selOldTe?.value || '';
    const newTeName = (inpNewTe?.value || '').trim();
    const newTePhone = (inpNewPhone?.value || '').trim();
    const targetCluster = selCluster?.value || 'ALL';

    const validation = validateBulkTeHandoverInput({ oldTeName, newTeName });
    if (!validation.ok) {
      alert(validation.message);
      return;
    }

    const confirmMsg =
      `Konfirmasi Pergantian TE:\n\n` +
      `• TE Lama: ${oldTeName}\n` +
      `• TE Baru: ${newTeName}\n` +
      `• Nomor WA Baru: ${newTePhone || '(tidak diubah)'}\n` +
      `• Cakupan: ${targetCluster === 'ALL' ? 'Semua Cluster' : targetCluster}\n\n` +
      `Lanjutkan proses handover?`;
    if (!confirm(confirmMsg)) return;

    executeBtn.disabled = true;
    executeBtn.textContent = '⏳ Memproses Handover...';

    try {
      const reassignResponse = await tauriBridge.reassignTeDatabase({
        oldTeName,
        newTeName,
        newTePhone,
        targetCluster: targetCluster === 'ALL' ? null : targetCluster,
      });

      if (Array.isArray(reassignResponse?.reassigned_sites)) {
        onRecordBulkHandover?.(
          reassignResponse.reassigned_sites,
          `Handover TE Massal: ${oldTeName} ➔ ${newTeName} (${targetCluster === 'ALL' ? 'Semua Cluster' : targetCluster})`
        );
      }

      const currentStatuses = appStore.getState('statusData') || [];
      if (currentStatuses.length > 0) {
        const updatedStatuses = currentStatuses.map((site) => {
          const matchesTe =
            String(site.pic || '').trim().toUpperCase() === oldTeName.toUpperCase();
          const matchesCluster =
            targetCluster === 'ALL' ||
            String(site.cluster || '').trim().toUpperCase() === targetCluster.toUpperCase();
          if (matchesTe && matchesCluster) {
            return {
              ...site,
              pic: newTeName,
              te_phone: newTePhone || site.te_phone,
            };
          }
          return site;
        });
        appStore.setState({ statusData: updatedStatuses });
      }

      await onReloadContacts?.();
      modalController.close('executed');

      alert(
        `✅ Handover TE Berhasil!\n\n` +
          `• ${reassignResponse?.updated_sites || 0} site di database aktif ter-update.\n` +
          `• ${reassignResponse?.updated_contacts || 0} kontak WhatsApp ter-update.\n` +
          `Semua site '${oldTeName}' kini dialihkan ke '${newTeName}'.`
      );
    } catch (err) {
      alert(`Gagal melakukan handover TE: ${err}`);
    } finally {
      executeBtn.disabled = false;
      executeBtn.textContent = 'Terapkan Pergantian';
    }
  });

  return {
    open,
    close: () => modalController.close(),
  };
}
