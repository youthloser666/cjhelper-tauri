function resolveInvokeFunction(customInvoke) {
  if (typeof customInvoke === 'function') {
    return customInvoke;
  }

  const globalObject = typeof globalThis !== 'undefined' ? globalThis : null;
  const tauriCoreInvoke = globalObject?.__TAURI__?.core?.invoke;
  if (typeof tauriCoreInvoke === 'function') {
    return tauriCoreInvoke;
  }

  return async (commandName) => {
    throw new Error(`Tauri IPC invoke is unavailable for command "${commandName}".`);
  };
}

/**
 * Builds an injectable Tauri IPC gateway covering all 31 backend commands
 * defined in contracts/tauri-ipc-contract.md without exposing global __TAURI__.
 */
export function createTauriBridge({ invoke } = {}) {
  function callCommand(commandName, payload) {
    const invokeFn = resolveInvokeFunction(invoke);
    return payload === undefined ? invokeFn(commandName) : invokeFn(commandName, payload);
  }

  return {
    // 1. Data Ingestion, Snapshot & Status Commands
    parsePastedTable: (text) => callCommand('parse_pasted_table', { text }),
    pickDatabaseFile: () => callCommand('pick_db_file'),
    loadDatabaseExcel: (path) => callCommand('load_db_excel', { path }),
    loadTeContactsExcel: (path) => callCommand('load_te_contacts_excel', { path }),
    loadMplaneExcel: (path) => callCommand('load_mplane_excel', { path }),
    autoLoadDefaultDatabases: () => callCommand('auto_load_default_dbs'),
    createDataSnapshot: () => callCommand('snapshot_data'),
    resetDataSnapshot: () => callCommand('reset_snapshot'),
    clearWorkspaceData: () => callCommand('clear_data'),
    checkSiteStatus: () => callCommand('check_site_status'),

    // 2. Database Lookup, Editing, Export & Handover Commands
    lookupSite: (siteId) => callCommand('lookup_site', { siteId }),
    updateSiteDatabase: (editData) => callCommand('update_site_db', { editData }),
    exportDatabase: () => callCommand('export_db'),
    reassignTeDatabase: (payload) => callCommand('reassign_te_db', payload),
    handoverSitesBatch: (payload) => callCommand('handover_sites_batch', payload),
    applySiteChanges: (payload) => callCommand('apply_site_changes', payload),
    saveChangesJsonFile: (payload) => callCommand('save_changes_json_file', payload),
    pickJsonFile: () => callCommand('pick_json_file'),
    readJsonFile: (path) => callCommand('read_json_file', { path }),

    // 3. Maps & External Navigation Commands
    getDownSitesCoordinates: () => callCommand('get_down_sites_coords'),
    findNearestSites: ({ lat, lon, limit = 5 }) =>
      callCommand('find_nearest_sites', { lat, lon, limit }),
    openExternalUrl: (url) => callCommand('open_url', { url }),

    // 4. WhatsApp Server & Configuration Commands
    getWhatsAppConfig: () => callCommand('get_wa_config'),
    saveWhatsAppGroups: (savedGroups) => callCommand('save_wa_groups', { savedGroups }),
    getWhatsAppTeContacts: () => callCommand('get_wa_te_contacts'),
    saveWhatsAppTeContacts: (contacts) => callCommand('save_wa_te_contacts', { contacts }),
    startWhatsAppServer: () => callCommand('wa_start_server'),
    getWhatsAppStatus: () => callCommand('wa_status'),
    getWhatsAppGroups: () => callCommand('wa_groups'),
    logoutWhatsApp: () => callCommand('wa_logout'),
    broadcastWhatsApp: (payload) => callCommand('wa_broadcast', payload),
  };
}

export const tauriBridge = createTauriBridge();

