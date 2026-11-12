import { createModalController } from '../../../shared/ui/modal-controller.js';
import { escapeHtml, getElementById } from '../../../shared/utils/dom-helpers.js';
import { loadFormatConfig } from '../../messages/logic/format-config.js';
import {
  classifyDownSitesForBlast,
  getBlastFilterCounts,
  getBlastSiteKey,
  isBlastSiteSelected,
  saveBlastFilterConfig,
  shouldSendToTe,
} from '../logic/blast-filter.js';

function naturalCompare(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function toSafeClusterClass(tbodyId, clusterName) {
  return `site-chk-${tbodyId}-${String(clusterName || '').replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Controls the WA Blast Filter Settings modal (`#wa-blast-filter-modal`) and site selection state.
 */
export function mountWaBlastFilterModalView({
  appStore,
  storageAdapter,
  filterState,
}) {
  const modalEl = getElementById('wa-blast-filter-modal');
  const chkRemarkTrigger = getElementById('chk-filter-remark-trigger');
  const chkSitedown = getElementById('chk-filter-sitedown');
  const chkCelldown = getElementById('chk-filter-celldown');
  const chkBcch = getElementById('chk-filter-bcch');
  const chkEnva = getElementById('chk-filter-enva');
  const chkStolen = getElementById('chk-filter-stolen');
  const closeBtn = getElementById('btn-close-wa-blast-filter');
  const saveBtn = getElementById('btn-save-wa-blast-filter');

  const modalController = createModalController(modalEl, {
    closeButtonSelector: '#btn-close-wa-blast-filter',
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modalController.close('close-button'));
  }

  function updateCountsInUi() {
    const state = appStore.getState();
    const formatConfig = loadFormatConfig(storageAdapter, 'msg');
    const counts = getBlastFilterCounts({
      statusData: state.statusData || [],
      pivotData: state.pivotData || [],
      netdroneData: state.netdroneData || [],
      selectionMap: filterState.siteSelectionMap,
      filterConfig: filterState.config,
      formatConfig,
      regionFilter: 'ALL',
    });

    const setRatioCount = (id, pair) => {
      const el = getElementById(id);
      if (el) el.textContent = `${pair.selected}/${pair.total} data`;
    };
    const setSimpleCount = (id, total) => {
      const el = getElementById(id);
      if (el) el.textContent = `${total} data`;
    };

    setRatioCount('cnt-filter-sitedown', counts.sitedown);
    setRatioCount('cnt-filter-celldown', counts.celldown);
    setRatioCount('cnt-filter-bcch', counts.bcch);
    setSimpleCount('cnt-filter-enva', counts.enva);
    setSimpleCount('cnt-filter-stolen', counts.stolen);
    setSimpleCount('cnt-filter-netdrone', counts.netdrone);
  }

  function renderClusterGroup(tbody, tbodyId, clusterName, clusterSites, formatConfig) {
    const safeClusterClass = toSafeClusterClass(tbodyId, clusterName);
    const allSelected = clusterSites.every((site) =>
      isBlastSiteSelected(site, filterState.siteSelectionMap, filterState.config, formatConfig)
    );

    const hdrTr = document.createElement('tr');
    hdrTr.className = 'filter-cluster-row';
    hdrTr.innerHTML = `
      <td class="text-center col-w-26-pad">
        <input type="checkbox" class="cluster-group-chk chk-14" data-cluster="${escapeHtml(clusterName)}" ${allSelected ? 'checked' : ''}>
      </td>
      <td colspan="4" class="filter-cluster-hd-cell">
        📍 Cluster: ${escapeHtml(clusterName)} <span class="filter-cluster-count">(${clusterSites.length} site)</span>
      </td>
    `;

    const clusterChk = hdrTr.querySelector('.cluster-group-chk');
    clusterChk.addEventListener('change', (e) => {
      const checked = e.target.checked;
      for (const site of clusterSites) {
        const key = getBlastSiteKey(site, formatConfig);
        filterState.siteSelectionMap[key] = checked;
      }
      tbody.querySelectorAll(`.${safeClusterClass}`).forEach((chk) => {
        chk.checked = checked;
      });
      updateCountsInUi();
    });

    tbody.appendChild(hdrTr);

    for (const site of clusterSites) {
      const key = getBlastSiteKey(site, formatConfig);
      const isSelected = isBlastSiteSelected(
        site,
        filterState.siteSelectionMap,
        filterState.config,
        formatConfig
      );
      const isTrigger = shouldSendToTe(site.remark, filterState.config);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center col-w-26">
          <input type="checkbox" class="site-filter-chk ${safeClusterClass} checkbox" data-key="${escapeHtml(key)}" ${isSelected ? 'checked' : ''}>
        </td>
        <td class="font-bold text-success col-w-85">${escapeHtml(site.new_site)}</td>
        <td class="col-w-110">${escapeHtml(site.cluster || '—')}</td>
        <td>${escapeHtml(site.site_name)}</td>
        <td class="filter-remark-cell ${isTrigger ? 'is-trigger' : ''}">
          ${escapeHtml(site.remark || '—')} ${isTrigger ? '<span class="filter-auto-tag">(Auto)</span>' : ''}
        </td>
      `;

      tr.querySelector('input').addEventListener('change', (e) => {
        filterState.siteSelectionMap[key] = e.target.checked;
        clusterChk.checked = clusterSites.every((item) =>
          isBlastSiteSelected(item, filterState.siteSelectionMap, filterState.config, formatConfig)
        );
        updateCountsInUi();
      });

      tbody.appendChild(tr);
    }
  }

  function renderFilterSiteTables() {
    const state = appStore.getState();
    const formatConfig = loadFormatConfig(storageAdapter, 'msg');
    const classified = classifyDownSitesForBlast(state.statusData || [], {
      formatConfig,
      regionFilter: state.activeRegionFilter || 'ALL',
    });

    const fillCategoryTable = (tbodyId, list) => {
      const tbody = getElementById(tbodyId);
      if (!tbody) return;
      tbody.innerHTML = '';

      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-subtle py-2">Tidak ada data.</td></tr>';
        return;
      }

      const groups = {};
      for (const site of list) {
        const cl = site.cluster || 'UNKNOWN CLUSTER';
        if (!groups[cl]) groups[cl] = [];
        groups[cl].push(site);
      }

      const sortedClusters = Object.keys(groups).sort(naturalCompare);
      for (const clusterName of sortedClusters) {
        renderClusterGroup(tbody, tbodyId, clusterName, groups[clusterName], formatConfig);
      }
    };

    fillCategoryTable('tbody-filter-sitedown', classified.sitedown);
    fillCategoryTable('tbody-filter-celldown', classified.celldown);
    fillCategoryTable('tbody-filter-bcch', classified.bcch);
  }

  function syncUi() {
    const filterConfig = filterState.config;
    if (chkRemarkTrigger) chkRemarkTrigger.checked = Boolean(filterConfig.filterRemarkTrigger);
    if (chkSitedown) chkSitedown.checked = Boolean(filterConfig.enableSitedown);
    if (chkCelldown) chkCelldown.checked = Boolean(filterConfig.enableCelldown);
    if (chkBcch) chkBcch.checked = Boolean(filterConfig.enableBcch);
    if (chkEnva) chkEnva.checked = Boolean(filterConfig.enableEnva);
    if (chkStolen) chkStolen.checked = Boolean(filterConfig.enableStolen);

    renderFilterSiteTables();
    updateCountsInUi();
  }

  ['sitedown', 'celldown', 'bcch'].forEach((categoryKey) => {
    const toggleBtn = getElementById(`toggle-expand-${categoryKey}`);
    const container = getElementById(`list-container-${categoryKey}`);
    const icon = getElementById(`icon-expand-${categoryKey}`);

    if (toggleBtn && container) {
      toggleBtn.addEventListener('click', () => {
        const isExpanded = container.classList.toggle('is-expanded');
        if (icon) icon.textContent = isExpanded ? '▲ Sembunyikan' : '▼ Detail';
      });
    }
  });

  [
    ['chk-sitedown-select-all', 'tbody-filter-sitedown'],
    ['chk-celldown-select-all', 'tbody-filter-celldown'],
    ['chk-bcch-select-all', 'tbody-filter-bcch'],
  ].forEach(([chkId, tbodyId]) => {
    const chkAll = getElementById(chkId);
    if (!chkAll) return;

    chkAll.addEventListener('change', (e) => {
      const checked = e.target.checked;
      const tbody = getElementById(tbodyId);
      if (!tbody) return;

      tbody.querySelectorAll('.site-filter-chk').forEach((c) => {
        c.checked = checked;
        filterState.siteSelectionMap[c.dataset.key] = checked;
      });
      updateCountsInUi();
    });
  });

  if (chkRemarkTrigger) {
    chkRemarkTrigger.addEventListener('change', (e) => {
      filterState.config.filterRemarkTrigger = e.target.checked;
      filterState.siteSelectionMap = {};
      renderFilterSiteTables();
      updateCountsInUi();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const chkFilterNetdrone = getElementById('chk-filter-netdrone');
      filterState.config = saveBlastFilterConfig(storageAdapter, {
        filterRemarkTrigger: chkRemarkTrigger ? chkRemarkTrigger.checked : true,
        enableSitedown: chkSitedown ? chkSitedown.checked : true,
        enableCelldown: chkCelldown ? chkCelldown.checked : true,
        enableBcch: chkBcch ? chkBcch.checked : true,
        enableEnva: chkEnva ? chkEnva.checked : false,
        enableStolen: chkStolen ? chkStolen.checked : false,
        enableNetdrone: chkFilterNetdrone
          ? chkFilterNetdrone.checked
          : filterState.config.enableNetdrone,
      });

      const chkWaNetdrone = getElementById('chk-wa-enable-netdrone');
      if (chkWaNetdrone) {
        chkWaNetdrone.checked = Boolean(filterState.config.enableNetdrone);
      }

      modalController.close('save');
    });
  }

  const offOpen = appStore.on('whatsapp:openBlastFilter', () => {
    syncUi();
    modalController.open();
  });

  return {
    open: () => {
      syncUi();
      modalController.open();
    },
    destroy: () => {
      offOpen();
      modalController.destroy();
    },
  };
}
