import { clipboardAdapter } from '../shared/adapters/clipboard-adapter.js';
import { geocodingAdapter } from '../shared/adapters/geocoding-adapter.js';
import { storageAdapter } from '../shared/adapters/storage-adapter.js';
import { tauriBridge } from '../shared/adapters/tauri-bridge.js';
import { updaterAdapter } from '../shared/adapters/updater-adapter.js';
import { windowAdapter } from '../shared/adapters/window-adapter.js';
import { appStore } from '../shared/state/app-store.js';
import { getElementById, setTextContent } from '../shared/utils/dom-helpers.js';

import { renderAppShellTemplate } from './app-shell.template.js';
import { initClockController } from './clock.js';
import { initNavigationController } from './navigation.js';
import { initThemeController } from './theme-controller.js';
import { initWindowController } from './window-controller.js';

import { renderDashboardTemplate } from '../features/dashboard/ui/dashboard.template.js';
import { initDashboardView } from '../features/dashboard/ui/dashboard.view.js';

import { renderDataInputTemplate } from '../features/data-input/ui/data-input.template.js';
import { initMasterInputView } from '../features/data-input/ui/master-input.view.js';
import { initNetdroneInputView } from '../features/data-input/ui/netdrone-input.view.js';
import { initPivotInputView } from '../features/data-input/ui/pivot-input.view.js';

import { renderFlashReportTemplate } from '../features/flash-report/ui/flash-report.template.js';
import { initFlashReportView } from '../features/flash-report/ui/flash-report.view.js';

import { renderSiteStatusTemplate } from '../features/site-status/ui/site-status.template.js';
import { initSiteStatusView } from '../features/site-status/ui/site-status.view.js';

import { renderMessagesTemplate } from '../features/messages/ui/messages.template.js';
import { initMessagesView } from '../features/messages/ui/messages.view.js';

import { loadBlastFilterConfig } from '../features/whatsapp-broadcast/logic/blast-filter.js';
import { renderWhatsAppBroadcastTab } from '../features/whatsapp-broadcast/ui/whatsapp-broadcast.template.js';
import {
  renderFloatingBroadcastProgress,
  renderWhatsAppModals,
} from '../features/whatsapp-broadcast/ui/whatsapp-modals.template.js';
import { mountWaBlastFilterModalView } from '../features/whatsapp-broadcast/ui/wa-blast-filter-modal.view.js';
import { mountWaBlastPreviewModalView } from '../features/whatsapp-broadcast/ui/wa-blast-preview-modal.view.js';
import { mountWaBlastTeModalView } from '../features/whatsapp-broadcast/ui/wa-blast-te-modal.view.js';
import { mountWaQrModalView } from '../features/whatsapp-broadcast/ui/wa-qr-modal.view.js';
import { mountWhatsAppBroadcastView } from '../features/whatsapp-broadcast/ui/whatsapp-broadcast.view.js';

import {
  renderDatabaseLookupTab,
  renderOthersDatabaseSubtabs,
} from '../features/database/ui/database.template.js';
import { renderHandoverModals } from '../features/database/ui/handover-modals.template.js';
import { mountDatabaseEditorView } from '../features/database/ui/database-editor.view.js';
import { mountDatabaseLookupView } from '../features/database/ui/database-lookup.view.js';
import { mountHandoverSiteModalView } from '../features/database/ui/handover-site-modal.view.js';
import { mountHandoverTeModalView } from '../features/database/ui/handover-te-modal.view.js';
import { mountWaGroupsView } from '../features/database/ui/wa-groups.view.js';
import { mountWaTeContactsView } from '../features/database/ui/wa-te-contacts.view.js';

import { renderMapsTab } from '../features/maps/ui/maps.template.js';
import { renderStreetViewModal } from '../features/maps/ui/street-view-modal.template.js';
import { mountMapsView } from '../features/maps/ui/maps.view.js';
import { mountStreetViewModalView } from '../features/maps/ui/street-view-modal.view.js';

import { loadFormatterSettings } from '../features/settings/logic/formatter-settings-service.js';
import { renderOthersTab } from '../features/settings/ui/settings.template.js';
import { mountFormatterSettingsView } from '../features/settings/ui/formatter-settings.view.js';
import {
  mountOthersSubnav,
  mountSystemSettingsView,
} from '../features/settings/ui/system-settings.view.js';

function assembleShellHtml() {
  const tabsMarkup = [
    renderDashboardTemplate(),
    renderDataInputTemplate(),
    renderFlashReportTemplate(),
    renderSiteStatusTemplate(),
    renderMessagesTemplate(),
    renderWhatsAppBroadcastTab(),
    renderDatabaseLookupTab(),
    renderMapsTab(),
    renderOthersTab({
      databaseSubtabsMarkup: renderOthersDatabaseSubtabs(),
    }),
  ].join('\n');

  const modalsMarkup = [
    renderFloatingBroadcastProgress(),
    renderWhatsAppModals(),
    renderHandoverModals(),
    renderStreetViewModal(),
  ].join('\n');

  return renderAppShellTemplate({ tabsMarkup, modalsMarkup });
}

/**
 * Application composition root: renders UI templates, mounts feature controllers,
 * connects cross-feature workflows, and hydrates initial backend/local data.
 */
export async function bootstrapApplication() {
  const mountRoot = getElementById('app-root') || document.body;
  mountRoot.innerHTML = assembleShellHtml();

  initWindowController({ windowAdapter });
  initClockController();
  initThemeController();
  initNavigationController();

  const initialFormat = loadFormatterSettings(storageAdapter);
  appStore.setState({
    fmtMsg: initialFormat.msg,
    fmtBc: initialFormat.bc,
  });

  const sharedBlastFilterState = {
    config: loadBlastFilterConfig(storageAdapter),
    siteSelectionMap: {},
  };

  let pivotInputView = null;
  let netdroneInputView = null;
  let flashReportView = null;
  let siteStatusView = null;
  let messagesView = null;
  let waBroadcastView = null;
  let waTeContactsView = null;
  let waGroupsView = null;
  let handoverSiteModalView = null;
  let masterInputView = null;

  async function refreshSiteStatus() {
    try {
      const statuses = await tauriBridge.checkSiteStatus();
      const normalized = Array.isArray(statuses) ? statuses : [];
      appStore.setState({ statusData: normalized });
      siteStatusView?.renderStatusTable?.();
      flashReportView?.renderMasterTable?.();
      flashReportView?.updateStats?.();
      messagesView?.renderPM?.();
    } catch (err) {
      console.error('Failed to check site status:', err);
    }
  }

  let isDbLoadInFlight = false;

  async function handleLoadDbExcel() {
    if (isDbLoadInFlight) return;
    isDbLoadInFlight = true;

    const previousLoad = {
      status: 'idle',
      fileName: '',
      rowCount: 0,
      errorMessage: '',
      ...(appStore.getState('databaseLoad') || {}),
    };

    try {
      const filePath = await tauriBridge.pickDatabaseFile();
      if (!filePath) return;

      appStore.setState({
        databaseLoad: {
          ...previousLoad,
          status: 'loading',
          errorMessage: '',
        },
      });

      const rowCount = await tauriBridge.loadDatabaseExcel(filePath);
      const fileName = String(filePath).split(/[/\\]/).pop() || 'Database';

      appStore.setState({
        dbFileName: fileName,
        databaseLoad: {
          status: 'loaded',
          fileName,
          rowCount,
          errorMessage: '',
        },
      });

      masterInputView?.setDatabaseLoadedInfo?.({ count: rowCount, fileName });
      await handoverSiteModalView?.applyToMemory?.();
      await refreshSiteStatus();
    } catch (err) {
      const hasPriorDatabase = previousLoad.status === 'loaded' || Number(previousLoad.rowCount) > 0;
      appStore.setState({
        databaseLoad: hasPriorDatabase
          ? {
              status: 'loaded',
              fileName: previousLoad.fileName,
              rowCount: previousLoad.rowCount,
              errorMessage: '',
            }
          : {
              status: 'error',
              fileName: '',
              rowCount: 0,
              errorMessage: 'Gagal memuat DB',
            },
      });
      alert(`Gagal memuat Master DB: ${err}`);
    } finally {
      isDbLoadInFlight = false;
    }
  }

  async function handleImportTeContactsExcel() {
    try {
      const filePath = await tauriBridge.pickDatabaseFile();
      if (!filePath) return;

      const count = await tauriBridge.loadTeContactsExcel(filePath);
      await waTeContactsView?.loadContacts?.();
      alert(`✅ Berhasil mengimpor ${count} kontak TE ke database.`);
    } catch (err) {
      alert(`Gagal mengimpor TE Contacts: ${err}`);
    }
  }

  async function handleImportMplaneExcel() {
    try {
      const filePath = await tauriBridge.pickDatabaseFile();
      if (!filePath) return;

      const count = await tauriBridge.loadMplaneExcel(filePath);
      alert(`✅ Berhasil memuat MPlane IP untuk ${count} site Nokia.`);
    } catch (err) {
      alert(`Gagal mengimpor Nokia MPlane: ${err}`);
    }
  }

  handoverSiteModalView = mountHandoverSiteModalView({
    appStore,
    tauriBridge,
    storageAdapter,
  });

  const handoverTeModalView = mountHandoverTeModalView({
    appStore,
    tauriBridge,
    onRecordBulkHandover: (records, note) => {
      handoverSiteModalView.recordBulkHandover(records, note);
    },
    onReloadContacts: () => waTeContactsView?.loadContacts?.(),
  });

  const waPreviewModal = mountWaBlastPreviewModalView({ clipboardAdapter });
  const waFilterModal = mountWaBlastFilterModalView({
    appStore,
    storageAdapter,
    filterState: sharedBlastFilterState,
  });

  const waQrModal = mountWaQrModalView({
    tauriBridge,
    onPollSpeedup: () => waBroadcastView?.speedUpPoll?.(),
    onResetComplete: () => waBroadcastView?.pollNow?.(),
  });

  waBroadcastView = mountWhatsAppBroadcastView({
    appStore,
    tauriBridge,
    storageAdapter,
    clipboardAdapter,
    qrModalView: waQrModal,
    filterState: sharedBlastFilterState,
  });

  const waBlastTeModal = mountWaBlastTeModalView({
    appStore,
    tauriBridge,
    storageAdapter,
    filterState: sharedBlastFilterState,
    previewModalView: waPreviewModal,
    onReloadContacts: () => waTeContactsView?.loadContacts?.(),
  });

  waGroupsView = mountWaGroupsView({ appStore, tauriBridge });
  waTeContactsView = mountWaTeContactsView({
    appStore,
    tauriBridge,
    onOpenHandoverTe: () => handoverTeModalView.open(),
  });

  mountDatabaseLookupView({
    appStore,
    tauriBridge,
    clipboardAdapter,
    onImportMplane: handleImportMplaneExcel,
    onOpenHandoverSite: (siteId) => handoverSiteModalView.open(siteId, 'single'),
  });

  mountDatabaseEditorView({
    appStore,
    tauriBridge,
    onRecordSiteEdit: (siteId, editData) => handoverSiteModalView.recordSiteEdit(siteId, editData),
    onLoadChangesJson: () => handoverSiteModalView.loadFromJsonFile(),
    onSaveChangesJson: () => handoverSiteModalView.saveToJsonFile(),
  });

  const streetViewModal = mountStreetViewModalView({ tauriBridge });
  mountMapsView({
    appStore,
    tauriBridge,
    storageAdapter,
    geocodingAdapter,
    clipboardAdapter,
    streetViewModal,
  });

  mountOthersSubnav({ appStore });
  mountFormatterSettingsView({ appStore, storageAdapter });
  mountSystemSettingsView({ appStore, updaterAdapter });

  masterInputView = initMasterInputView({
    onResetDependentData: () => {
      pivotInputView?.resetPivotData?.();
      netdroneInputView?.resetNetdroneData?.();
    },
    onStatusReloadRequired: refreshSiteStatus,
  });

  pivotInputView = initPivotInputView({
    onPivotUpdated: () => {
      messagesView?.renderPM?.();
    },
  });

  netdroneInputView = initNetdroneInputView({
    onNetdroneUpdated: () => {
      messagesView?.renderPM?.();
    },
  });

  flashReportView = initFlashReportView();
  siteStatusView = initSiteStatusView();
  messagesView = initMessagesView({
    onOpenWaBlast: () => waBlastTeModal.open(),
    onOpenBlastFilter: () => waFilterModal.open(),
  });

  initDashboardView({
    onLoadDatabase: handleLoadDbExcel,
    onImportContacts: handleImportTeContactsExcel,
    onImportMplane: handleImportMplaneExcel,
    onOpenHandoverTe: () => handoverTeModalView.open(),
    onOpenHandoverSite: (siteId = '') => handoverSiteModalView.open(siteId, 'single'),
    onOpenSiteChanges: () => handoverSiteModalView.open('', 'history'),
    onLoadChangesJson: () => handoverSiteModalView.loadFromJsonFile(),
    onSaveChangesJson: () => handoverSiteModalView.saveToJsonFile(),
  });

  appStore.subscribe('fmtMsg', () => {
    messagesView?.renderPM?.();
  });

  appStore.subscribe('fmtBc', () => {
    waBroadcastView?.generateSharePreview?.();
  });

  appStore.on('navigation:changed', ({ targetTabId } = {}) => {
    if (targetTabId === 'tab-pm') {
      messagesView?.renderPM?.();
    }
  });

  getElementById('btn-refresh')?.addEventListener('click', async () => {
    await refreshSiteStatus();
    await waBroadcastView?.pollNow?.();
  });

  try {
    const autoLoad = await tauriBridge.autoLoadDefaultDatabases();
    if (autoLoad?.db) {
      appStore.setState({
        dbFileName: 'db-new.xlsx',
        databaseLoad: {
          status: 'loaded',
          fileName: 'db-new.xlsx',
          rowCount: autoLoad.db,
          errorMessage: '',
        },
      });
      masterInputView?.setDatabaseLoadedInfo?.({
        count: autoLoad.db,
        fileName: 'db-new.xlsx',
      });
    }
  } catch (err) {
    console.warn('auto_load_default_dbs:', err);
  }

  await Promise.allSettled([
    waGroupsView?.loadConfig?.(),
    waTeContactsView?.loadContacts?.(),
  ]);

  await handoverSiteModalView?.applyToMemory?.();
  await refreshSiteStatus();
  await waBroadcastView?.pollNow?.();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bootstrapApplication();
    });
  } else {
    bootstrapApplication();
  }
}
