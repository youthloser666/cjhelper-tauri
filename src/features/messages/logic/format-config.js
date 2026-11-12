import { STORAGE_KEYS } from '../../../shared/state/storage-keys.js';

export const DEFAULT_MSG_FORMAT = Object.freeze({
  msg_line: '{icon} {type} / {cluster} | {sitename} | {old} | {new} | {category} | {time}',
  msg_remark: '    ↳ {remark}',
  msg_hdr: '{cluster}  |  RTS: {rts}',
  lbl_sd: 'SITE DOWN :',
  lbl_cd: 'CELLS DOWN :',
  lbl_bcch: 'CELL DOWN BCCH Missing NOKIA :',
  key_bcch: 'BCCH',
  icon_down: '▶️',
  spacing: false,
});

export const DEFAULT_BC_FORMAT = Object.freeze({
  msg_line: '{icon} {rts} / {cluster} /  {new}  / {sitename} / {category} / {time}',
  msg_remark: ' / {remark}',
  msg_hdr: '*SITE FULLY DOWN {region}  {date} {jam}*\n*TOTAL SITEDOWN : {total_sd}*',
  lbl_sd: 'SITE DOWN :',
  lbl_cd: 'CELLS DOWN :',
  lbl_bcch: 'CELL DOWN BCCH Missing NOKIA :',
  key_bcch: 'BCCH',
  icon_down: '▶️',
  spacing: false,
});

const LEGACY_MSG_MAP = [
  ['msgLine', 'msg_line'],
  ['msgRemark', 'msg_remark'],
  ['msgHdr', 'msg_hdr'],
  ['iconDown', 'icon_down'],
  ['lblSd', 'lbl_sd'],
  ['lblCd', 'lbl_cd'],
  ['lblBcch', 'lbl_bcch'],
  ['keyBcch', 'key_bcch'],
];

const LEGACY_BC_MAP = [
  ['msgLineBc', 'msg_line'],
  ['msgRemarkBc', 'msg_remark'],
  ['msgHdrBc', 'msg_hdr'],
  ['iconDown', 'icon_down'],
  ['lblSdBc', 'lbl_sd'],
  ['lblCdBc', 'lbl_cd'],
  ['section_bcch', 'lbl_bcch'],
  ['keyBcch', 'key_bcch'],
];

/**
 * Normalizes a persisted formatting config object, migrating legacy camelCase
 * keys onto the canonical snake_case schema without mutating the input.
 */
export function normalizeLegacyFormatConfig(parsedConfig, mode = 'msg') {
  const defaults = mode === 'bc' ? DEFAULT_BC_FORMAT : DEFAULT_MSG_FORMAT;
  if (!parsedConfig || typeof parsedConfig !== 'object') {
    return { ...defaults };
  }

  const migrated = { ...parsedConfig };
  const fieldPairs = mode === 'bc' ? LEGACY_BC_MAP : LEGACY_MSG_MAP;

  for (const [legacyKey, canonicalKey] of fieldPairs) {
    if (migrated[legacyKey] && !migrated[canonicalKey]) {
      migrated[canonicalKey] = migrated[legacyKey];
    }
  }

  return { ...defaults, ...migrated };
}

export function getDefaultFormatConfig(mode = 'msg') {
  return mode === 'bc' ? { ...DEFAULT_BC_FORMAT } : { ...DEFAULT_MSG_FORMAT };
}

export function loadFormatConfig(storageAdapter, mode = 'msg') {
  const storageKey =
    mode === 'bc' ? STORAGE_KEYS.FORMAT_BROADCAST : STORAGE_KEYS.FORMAT_MESSAGE;
  const saved = storageAdapter.getJson(storageKey, null);
  return normalizeLegacyFormatConfig(saved, mode);
}

export function saveFormatConfig(storageAdapter, mode, config) {
  const storageKey =
    mode === 'bc' ? STORAGE_KEYS.FORMAT_BROADCAST : STORAGE_KEYS.FORMAT_MESSAGE;
  const normalized = normalizeLegacyFormatConfig(config, mode);
  storageAdapter.setJson(storageKey, normalized);
  return normalized;
}

export function resetFormatConfig(storageAdapter, mode = 'msg') {
  const storageKey =
    mode === 'bc' ? STORAGE_KEYS.FORMAT_BROADCAST : STORAGE_KEYS.FORMAT_MESSAGE;
  storageAdapter.remove(storageKey);
  return getDefaultFormatConfig(mode);
}

