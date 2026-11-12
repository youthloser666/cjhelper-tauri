import { escapeHtml, getElementById } from '../../../shared/utils/dom-helpers.js';
import {
  formatBroadcastLogsDisplay,
  getTodayLogDateString,
} from '../../whatsapp-broadcast/logic/broadcast-log-service.js';
import {
  buildSavedWaGroupsPayload,
  filterWaGroups,
  formatWaGroupCountLabel,
} from '../logic/wa-groups-service.js';

/**
 * Controls the Broadcast Utilities subtab (`#subtab-wa-mgmt`) and mirrors daily broadcast logs.
 */
export function mountWaGroupsView({ appStore, tauriBridge }) {
  const searchInput = getElementById('wa-group-search');
  const btnClearSearch = getElementById('btn-wa-clear-search');
  const searchCountEl = getElementById('wa-search-count');
  const tbodyEl = getElementById('wa-groups-tbody');
  const statusEl = getElementById('wa-groups-status');
  const btnRefresh = getElementById('btn-wa-refresh-groups');
  const btnSave = getElementById('btn-wa-save-groups');
  const logDateEl = getElementById('wa-bc-log-date');
  const logBoxEl = getElementById('wa-bc-log-box');

  let selectedGroupIds = new Set(
    (appStore.getState('waSavedGroups') || []).map((g) => g.group_id)
  );

  function updateSearchCount(visibleCount, filterText) {
    if (!searchCountEl) return;
    const total = (appStore.getState('waGroups') || []).length;
    searchCountEl.textContent = formatWaGroupCountLabel({
      total,
      visible: visibleCount,
      selected: selectedGroupIds.size,
      filter: filterText,
    });
  }

  function renderGroups(filterText = searchInput?.value || '') {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = '';

    const groups = appStore.getState('waGroups') || [];
    const visibleGroups = filterWaGroups(groups, filterText);

    for (const group of visibleGroups) {
      const tr = document.createElement('tr');
      const isChecked = selectedGroupIds.has(group.id);

      tr.innerHTML = `
        <td class="text-center col-w-50">
          <input type="checkbox" class="wa-grp-chk checkbox" data-id="${escapeHtml(group.id)}" data-name="${escapeHtml(group.name)}" ${isChecked ? 'checked' : ''}>
        </td>
        <td class="${isChecked ? 'text-success' : 'text-subtle'} font-bold">${escapeHtml(group.name)}</td>
      `;

      const chk = tr.querySelector('input');
      const nameTd = tr.querySelector('td:nth-child(2)');

      const toggleSelection = (checked) => {
        chk.checked = checked;
        if (checked) {
          selectedGroupIds.add(group.id);
          nameTd.classList.replace('text-subtle', 'text-success');
        } else {
          selectedGroupIds.delete(group.id);
          nameTd.classList.replace('text-success', 'text-subtle');
        }
        updateSearchCount(visibleGroups.length, filterText);
      };

      tr.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          toggleSelection(!chk.checked);
        }
      });
      chk.addEventListener('change', (e) => {
        toggleSelection(e.target.checked);
      });

      tbodyEl.appendChild(tr);
    }

    updateSearchCount(visibleGroups.length, filterText);
  }

  function renderLogs(logs = appStore.getState('waBroadcastLogs') || []) {
    if (logDateEl) {
      logDateEl.textContent = `📋 ${getTodayLogDateString()}`;
    }
    if (logBoxEl) {
      logBoxEl.value = formatBroadcastLogsDisplay(logs);
    }
  }

  async function loadConfig() {
    try {
      const waConfig = await tauriBridge.getWhatsAppConfig();
      const savedGroups = waConfig?.saved_groups || [];
      selectedGroupIds = new Set(savedGroups.map((g) => g.group_id));
      appStore.setState({ waSavedGroups: savedGroups });
      renderGroups(searchInput?.value || '');
      return savedGroups;
    } catch (err) {
      console.warn('WA Config not loaded:', err);
      return [];
    }
  }

  btnRefresh?.addEventListener('click', async () => {
    const oldText = btnRefresh.textContent;
    btnRefresh.textContent = 'Memuat...';
    try {
      const status = await tauriBridge.getWhatsAppGroups();
      const groups = status?.groups || [];
      const saved = appStore.getState('waSavedGroups') || [];
      selectedGroupIds = new Set(saved.map((g) => g.group_id));
      appStore.setState({ waGroups: groups });
      renderGroups(searchInput?.value || '');
    } catch (err) {
      alert(`Gagal memuat grup: ${err}`);
    } finally {
      btnRefresh.textContent = oldText || 'Refresh from WA';
    }
  });

  searchInput?.addEventListener('input', (e) => {
    renderGroups(e.target.value);
  });

  btnClearSearch?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    renderGroups('');
  });

  btnSave?.addEventListener('click', async () => {
    const groups = appStore.getState('waGroups') || [];
    const payload = buildSavedWaGroupsPayload(groups, selectedGroupIds);

    try {
      await tauriBridge.saveWhatsAppGroups(payload);
      appStore.setState({ waSavedGroups: payload });
      if (statusEl) {
        statusEl.textContent = `✅ ${payload.length} grup disimpan`;
        setTimeout(() => {
          statusEl.textContent = '';
        }, 3000);
      }
    } catch (err) {
      alert(`Gagal menyimpan grup: ${err}`);
    }
  });

  const offLogs = appStore.on('whatsapp:logsUpdated', (logs) => {
    renderLogs(logs);
  });
  const unsubSaved = appStore.subscribe('waSavedGroups', (savedGroups) => {
    selectedGroupIds = new Set((savedGroups || []).map((g) => g.group_id));
    renderGroups(searchInput?.value || '');
  });

  renderLogs();

  return {
    loadConfig,
    renderGroups,
    renderLogs,
    destroy: () => {
      offLogs();
      unsubSaved();
    },
  };
}
