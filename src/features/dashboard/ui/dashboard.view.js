import { appStore } from '../../../shared/state/app-store.js';
import { setTextContent } from '../../../shared/utils/dom-helpers.js';
import { bindSegmentedControl } from '../../../shared/ui/segmented-control.js';
import { computeDashboardMetrics } from '../logic/dashboard-metrics.js';

const CHANGES_TONE_CLASSES = ['text-grn', 'text-accent', 'text-amb', 'text-muted-3'];

/**
 * Binds Dashboard region controls, metric card synchronization, and quick action triggers.
 */
export function initDashboardView({
  onRegionChange = null,
  onLoadDatabase = null,
  onImportContacts = null,
  onImportMplane = null,
  onOpenHandoverTe = null,
  onOpenHandoverSite = null,
  onOpenSiteChanges = null,
  onLoadChangesJson = null,
  onSaveChangesJson = null,
} = {}) {
  const regionFilterContainer = document.getElementById('dash-region-filter');
  const cleanups = [];

  function renderMetrics() {
    const state = appStore.getState();
    const metrics = computeDashboardMetrics({
      regionFilter: state.activeRegionFilter,
      statusData: state.statusData,
      contacts: state.waTeContacts,
      siteChanges: state.siteChanges,
      lastLoadedChangesFileName: state.lastLoadedChangesFileName || '',
    });

    setTextContent('dash-down', metrics.downCount);
    setTextContent('dash-up', metrics.upCount);
    setTextContent('dash-contact-total', metrics.contactTotal);
    setTextContent('dash-contact-valid', metrics.contactValid);
    setTextContent('dash-contact-unset', metrics.contactUnset);
    setTextContent('dash-contact-clusters', metrics.contactClusters);
    setTextContent('dash-changes-count', metrics.overridesCount);

    const changesFileElement = document.getElementById('lbl-dash-changes-filename');
    if (changesFileElement) {
      changesFileElement.textContent = metrics.changesSummaryText;
      changesFileElement.title = metrics.changesSummaryTitle;
      CHANGES_TONE_CLASSES.forEach((cls) => changesFileElement.classList.remove(cls));

      if (metrics.changesTone === 'loaded') {
        changesFileElement.classList.add('text-grn');
      } else if (metrics.changesTone === 'dirty') {
        changesFileElement.classList.add('text-amb');
      } else {
        changesFileElement.classList.add('text-muted-3');
      }
    }
  }

  function renderDatabaseLoad() {
    const databaseLoad = appStore.getState('databaseLoad') || {};
    const status = databaseLoad.status || 'idle';
    const fileName = databaseLoad.fileName || '';
    const rowCount = databaseLoad.rowCount ?? 0;
    const errorMessage = databaseLoad.errorMessage || '';

    const loadButton = document.getElementById('btn-load-db');
    if (loadButton) {
      loadButton.disabled = status === 'loading';
    }

    setTextContent('dash-db', rowCount);

    const dbFileElement = document.getElementById('lbl-dash-db-filename');
    if (dbFileElement) {
      let labelText = 'Not loaded';
      if (status === 'loading') {
        labelText = 'Loading DB...';
      } else if (status === 'loaded') {
        labelText = fileName ? `📁 ${fileName} (${rowCount} baris)` : `${rowCount} baris`;
      } else if (status === 'error') {
        labelText = errorMessage || (fileName ? `📁 ${fileName} (${rowCount} baris)` : 'Gagal memuat DB');
      } else if (fileName) {
        labelText = `📁 ${fileName} (${rowCount} baris)`;
      }

      dbFileElement.textContent = labelText;
      dbFileElement.title = labelText;
    }
  }

  const unbindRegionControl = bindSegmentedControl(regionFilterContainer, (selectedRegion) => {
    const nextRegion = selectedRegion || 'ALL';
    appStore.setState({ activeRegionFilter: nextRegion });
    renderMetrics();
    if (typeof onRegionChange === 'function') {
      onRegionChange(nextRegion);
    }
  });
  cleanups.push(unbindRegionControl);

  const actionBindings = [
    ['btn-load-db', () => onLoadDatabase?.()],
    ['btn-dash-import-contact', () => onImportContacts?.()],
    ['btn-dash-import-mplane', () => onImportMplane?.()],
    ['btn-dash-handover-te', () => onOpenHandoverTe?.()],
    ['btn-dash-handover-site', () => onOpenHandoverSite?.()],
    ['dash-changes-card', () => onOpenSiteChanges?.()],
    ['btn-dash-load-json', () => onLoadChangesJson?.()],
    ['btn-dash-save-json', () => onSaveChangesJson?.()],
  ];

  actionBindings.forEach(([elementId, listener]) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.addEventListener('click', listener);
    cleanups.push(() => element.removeEventListener('click', listener));
  });

  ['statusData', 'waTeContacts', 'siteChanges', 'activeRegionFilter'].forEach((sliceKey) => {
    cleanups.push(appStore.subscribe(sliceKey, renderMetrics));
  });
  cleanups.push(appStore.subscribe('databaseLoad', renderDatabaseLoad));

  renderMetrics();
  renderDatabaseLoad();

  return {
    renderMetrics,
    renderDatabaseLoad,
    destroy: () => cleanups.forEach((cleanup) => cleanup()),
  };
}

