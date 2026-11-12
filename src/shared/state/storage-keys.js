/**
 * Canonical browser localStorage keys preserved across the refactored architecture
 * so existing user preferences, drafts, and autosaved overrides remain intact.
 */
export const STORAGE_KEYS = Object.freeze({
  FORMAT_MESSAGE: 'fmtMsg',
  FORMAT_BROADCAST: 'fmtBc',
  BROADCAST_LOGS: 'cjhelper_bc_logs',
  BLAST_FILTER_CONFIG: 'cjhelper_blast_filter_cfg',
  MAP_TILE_TYPE: 'cjhelper_map_tile_type',
  CARTO_API_KEY: 'cjhelper_carto_api_key',
  PIVOT_DATA: 'cjhelper_pivot_data',
  PIVOT_RAW_TEXT: 'cjhelper_pivot_text',
  NETDRONE_DATA: 'cjhelper_netdrone_data',
  NETDRONE_RAW_TEXT: 'cjhelper_netdrone_text',
  SITE_CHANGES_AUTOSAVE: 'cjhelper_site_changes_autosave',
});

