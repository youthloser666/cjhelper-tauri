import { createModalController } from '../../../shared/ui/modal-controller.js';
import { escapeHtml, getElementById } from '../../../shared/utils/dom-helpers.js';
import { normalizeWhatsAppNumber } from '../../../shared/utils/phone-normalizer.js';
import { loadFormatConfig } from '../../messages/logic/format-config.js';
import {
  buildTeGroups,
  generateTeMessage,
  getTeMessageItemCount,
} from '../logic/te-message-generator.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Controls the Direct WA Blast to TE modal (`#wa-blast-te-modal`).
 */
export function mountWaBlastTeModalView({
  appStore,
  tauriBridge,
  storageAdapter,
  filterState,
  previewModalView,
  onReloadContacts,
}) {
  const modalEl = getElementById('wa-blast-te-modal');
  const tbodyEl = getElementById('wa-blast-te-tbody');
  const selectAllChk = getElementById('chk-wa-blast-te-select-all');
  const delayInput = getElementById('num-wa-blast-te-delay');
  const closeBtn = getElementById('btn-close-wa-blast-te');
  const executeBtn = getElementById('btn-execute-wa-blast-te');
  const progressBox = getElementById('wa-blast-te-progress-container');
  const progressStatus = getElementById('wa-blast-te-progress-status');
  const progressPercent = getElementById('wa-blast-te-progress-percent');
  const progressFill = getElementById('wa-blast-te-progress-fill');

  let currentTeGroups = {};

  const modalController = createModalController(modalEl, {
    closeButtonSelector: '#btn-close-wa-blast-te',
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modalController.close('close-button'));
  }

  if (selectAllChk) {
    selectAllChk.addEventListener('change', (e) => {
      const checked = e.target.checked;
      document
        .querySelectorAll('.wa-blast-te-chk:not(:disabled)')
        .forEach((chk) => {
          chk.checked = checked;
        });
    });
  }

  function renderTeTable() {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = '';

    const keys = Object.keys(currentTeGroups);
    if (keys.length === 0) {
      tbodyEl.innerHTML =
        '<tr><td colspan="6" class="text-center text-subtle py-4">No TE data with down sites.</td></tr>';
      return;
    }

    const state = appStore.getState();
    const formatConfig = loadFormatConfig(storageAdapter, 'msg');

    for (const key of keys) {
      const group = currentTeGroups[key];
      const cleanJid = normalizeWhatsAppNumber(group.phone);
      const isPhoneValid = Boolean(cleanJid);
      const totalCount = getTeMessageItemCount(group.sites, group.cluster, {
        pivotData: state.pivotData || [],
        selectionMap: filterState.siteSelectionMap,
        filterConfig: filterState.config,
        formatConfig,
      }).total;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center col-w-30">
          <input type="checkbox" class="wa-blast-te-chk checkbox" data-key="${escapeHtml(key)}" ${isPhoneValid ? 'checked' : 'disabled'}>
        </td>
        <td class="font-bold ${group.isUnassigned ? 'text-amb' : 'text-success'}">
          ${escapeHtml(group.name)}
          ${group.isUnassigned ? '<span class="badge ba blast-te-badge-unassigned" title="Site ini belum memiliki TE di database">⚠️ Belum Ada TE</span>' : ''}
          <small class="text-subtle blast-te-cluster-sub">(${escapeHtml(group.cluster)})</small>
        </td>
        <td>
          <input type="text" class="fi wa-blast-te-phone-input blast-te-phone-input" data-key="${escapeHtml(key)}" value="${escapeHtml(group.phone)}" placeholder="${group.isUnassigned ? 'No WA PIC/RTS...' : 'WA Phone (628...)'}">
        </td>
        <td class="text-center"><span class="badge ${totalCount > 1 ? 'br' : 'bb'}">${totalCount}</span></td>
        <td class="text-center">
          <button type="button" class="tbtn btn-preview-te-msg blast-te-preview-btn" data-key="${escapeHtml(key)}" title="View Message Preview">👁️ Preview</button>
        </td>
        <td class="wa-blast-te-status-cell text-subtle blast-te-status-cell" data-key="${escapeHtml(key)}">Ready</td>
      `;

      const chk = tr.querySelector('.wa-blast-te-chk');
      const phoneInput = tr.querySelector('.wa-blast-te-phone-input');
      const btnPreview = tr.querySelector('.btn-preview-te-msg');

      phoneInput.addEventListener('input', (e) => {
        const nextPhone = e.target.value.trim();
        group.phone = nextPhone;
        const jid = normalizeWhatsAppNumber(nextPhone);
        if (jid) {
          chk.disabled = false;
          if (!chk.checked) chk.checked = true;
        } else {
          chk.disabled = true;
          chk.checked = false;
        }
      });

      btnPreview.addEventListener('click', () => {
        const latestState = appStore.getState();
        const latestFmt = loadFormatConfig(storageAdapter, 'msg');
        const message = generateTeMessage(group.sites, group.cluster, {
          pivotData: latestState.pivotData || [],
          statusData: latestState.statusData || [],
          selectionMap: filterState.siteSelectionMap,
          filterConfig: filterState.config,
          formatConfig: latestFmt,
        });
        previewModalView.open({
          name: group.name,
          cluster: group.cluster,
          phone: group.phone,
          message,
        });
      });

      tbodyEl.appendChild(tr);
    }
  }

  async function open() {
    const state = appStore.getState();
    const downSites = (state.statusData || []).filter((site) => site.status === 'DOWN');
    const hasNetdrone =
      filterState.config.enableNetdrone &&
      (state.netdroneData || []).some((row) => !row.skipped && row.matchedDb);

    if (downSites.length === 0 && !hasNetdrone) {
      alert('No site DOWN at this time.');
      return;
    }

    await onReloadContacts?.();

    const refreshedState = appStore.getState();
    const formatConfig = loadFormatConfig(storageAdapter, 'msg');

    currentTeGroups = buildTeGroups({
      statusData: refreshedState.statusData || [],
      netdroneData: refreshedState.netdroneData || [],
      pivotData: refreshedState.pivotData || [],
      savedTeContacts: refreshedState.waTeContacts || [],
      regionFilter: refreshedState.activeRegionFilter || 'ALL',
      selectionMap: filterState.siteSelectionMap,
      filterConfig: filterState.config,
      formatConfig,
    });

    if (progressBox) progressBox.classList.add('hidden');
    if (closeBtn) {
      closeBtn.textContent = 'Cancel';
      closeBtn.disabled = false;
    }
    if (executeBtn) executeBtn.disabled = false;
    if (selectAllChk) {
      selectAllChk.checked = true;
      selectAllChk.disabled = false;
    }

    renderTeTable();
    modalController.open();
  }

  if (executeBtn) {
    executeBtn.addEventListener('click', async () => {
      const selectedChks = document.querySelectorAll('.wa-blast-te-chk:checked');
      if (selectedChks.length === 0) {
        alert('Please select at least 1 TE to blast.');
        return;
      }

      if (!confirm(`Send direct message to ${selectedChks.length} TEs?`)) {
        return;
      }

      const state = appStore.getState();
      const formatConfig = loadFormatConfig(storageAdapter, 'msg');
      const savedContacts = [...(state.waTeContacts || [])];
      const blastTargets = [];
      let needSaveContacts = false;

      selectedChks.forEach((chk) => {
        const key = chk.dataset.key;
        const group = currentTeGroups[key];
        const jid = normalizeWhatsAppNumber(group.phone);
        const message = generateTeMessage(group.sites, group.cluster, {
          pivotData: state.pivotData || [],
          statusData: state.statusData || [],
          selectionMap: filterState.siteSelectionMap,
          filterConfig: filterState.config,
          formatConfig,
        });

        blastTargets.push({ key, name: group.name, jid, message });

        if (group.phone) {
          const saveName = group.isUnassigned
            ? `[No TE] ${group.cluster}`
            : group.name.trim();
          const existingIdx = savedContacts.findIndex(
            (c) =>
              String(c.name || '').trim().toUpperCase() === saveName.toUpperCase() &&
              String(c.cluster || '').trim().toUpperCase() === group.cluster.trim().toUpperCase()
          );

          if (existingIdx === -1) {
            savedContacts.push({
              name: saveName,
              cluster: group.cluster.trim(),
              phone: group.phone.trim(),
            });
            needSaveContacts = true;
          } else if (savedContacts[existingIdx].phone !== group.phone.trim()) {
            savedContacts[existingIdx] = {
              ...savedContacts[existingIdx],
              phone: group.phone.trim(),
            };
            needSaveContacts = true;
          }
        }
      });

      executeBtn.disabled = true;
      if (closeBtn) closeBtn.disabled = true;
      if (selectAllChk) selectAllChk.disabled = true;
      document.querySelectorAll('.wa-blast-te-chk').forEach((c) => {
        c.disabled = true;
      });
      document.querySelectorAll('.wa-blast-te-phone-input').forEach((input) => {
        input.disabled = true;
      });

      if (progressBox) progressBox.classList.remove('hidden');
      if (progressPercent) progressPercent.textContent = '0%';
      if (progressFill) progressFill.style.width = '0%';
      if (progressStatus) progressStatus.textContent = 'Starting blast...';

      const delayMs = Number.parseInt(delayInput?.value, 10) || 2000;

      for (let idx = 0; idx < blastTargets.length; idx += 1) {
        const target = blastTargets[idx];
        const statusCell = document.querySelector(
          `.wa-blast-te-status-cell[data-key="${target.key}"]`
        );

        if (statusCell) {
          statusCell.textContent = '⏳ Sending...';
          statusCell.className = 'wa-blast-te-status-cell blast-te-status-cell text-amb';
        }

        const pct = Math.round((idx / blastTargets.length) * 100);
        if (progressPercent) progressPercent.textContent = `${pct}%`;
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressStatus) {
          progressStatus.textContent = `Sending to ${target.name} (${idx + 1}/${blastTargets.length})...`;
        }

        try {
          const result = await tauriBridge.broadcastWhatsApp({
            targets: [{ group_id: target.jid, message: target.message }],
            delay_ms: 0,
          });
          const success = Boolean(result && result.success > 0);
          if (statusCell) {
            statusCell.textContent = success ? '✅ Success' : '❌ Failed';
            statusCell.className = `wa-blast-te-status-cell blast-te-status-cell ${success ? 'text-grn' : 'text-red'}`;
            const reason =
              !success && Array.isArray(result?.results) && result.results[0]?.error;
            if (reason) statusCell.title = reason;
          }
        } catch (err) {
          if (statusCell) {
            statusCell.textContent = '❌ Error';
            statusCell.className = 'wa-blast-te-status-cell blast-te-status-cell text-red';
            statusCell.title = String(err);
          }
        }

        if (idx < blastTargets.length - 1 && delayMs > 0) {
          await delay(delayMs);
        }
      }

      if (progressPercent) progressPercent.textContent = '100%';
      if (progressFill) progressFill.style.width = '100%';
      if (progressStatus) {
        progressStatus.textContent = `Done sending to ${blastTargets.length} TEs!`;
      }

      if (needSaveContacts) {
        try {
          await tauriBridge.saveWhatsAppTeContacts(savedContacts);
          appStore.setState({ waTeContacts: savedContacts });
        } catch (err) {
          console.warn('Failed to auto-save contacts:', err);
        }
      }

      if (closeBtn) {
        closeBtn.textContent = 'Close';
        closeBtn.disabled = false;
      }
    });
  }

  const offOpen = appStore.on('whatsapp:openBlastTe', () => {
    open();
  });

  return {
    open,
    destroy: () => {
      offOpen();
      modalController.destroy();
    },
  };
}

