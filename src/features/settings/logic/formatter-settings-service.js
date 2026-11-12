import { STORAGE_KEYS } from '../../../shared/state/storage-keys.js';
import {
  DEFAULT_BC_FORMAT,
  DEFAULT_MSG_FORMAT,
  loadFormatConfig,
  saveFormatConfig,
} from '../../messages/logic/format-config.js';
import { formatSingleLine } from '../../messages/logic/line-formatter.js';

/**
 * Returns a fresh copy of the default format configuration for `'msg'` or `'bc'`.
 *
 * @param {'msg' | 'bc'} target
 */
export function getDefaultFormatForTarget(target = 'msg') {
  const source = target === 'bc' ? DEFAULT_BC_FORMAT : DEFAULT_MSG_FORMAT;
  return { ...source };
}

/**
 * Loads both Message (PM) and Broadcast (Share WA) formatter configs via injected storage.
 *
 * @param {{ getJson: (key: string, fallback?: unknown) => unknown }} storage
 */
export function loadFormatterSettings(storage) {
  return {
    msg: loadFormatConfig(storage, 'msg'),
    bc: loadFormatConfig(storage, 'bc'),
  };
}

/**
 * Normalizes form input values onto the canonical formatter configuration schema.
 *
 * @param {Record<string, unknown>} formValues
 * @param {'msg' | 'bc'} target
 */
export function serializeFormatterForm(formValues = {}, target = 'msg') {
  const defaults = getDefaultFormatForTarget(target);
  return {
    msg_line: String(formValues.msg_line ?? defaults.msg_line),
    msg_remark: String(formValues.msg_remark ?? defaults.msg_remark),
    msg_hdr: String(formValues.msg_hdr ?? defaults.msg_hdr),
    lbl_sd: String(formValues.lbl_sd ?? defaults.lbl_sd),
    lbl_cd: String(formValues.lbl_cd ?? defaults.lbl_cd),
    lbl_bcch: String(formValues.lbl_bcch ?? defaults.lbl_bcch),
    key_bcch: String(formValues.key_bcch ?? defaults.key_bcch),
    icon_down: String(formValues.icon_down ?? defaults.icon_down),
    spacing: Boolean(formValues.spacing),
  };
}

/**
 * Persists a serialized formatter target via `saveFormatConfig`.
 */
export function saveFormatterTarget(storage, target, formValues) {
  const normalized = serializeFormatterForm(formValues, target);
  saveFormatConfig(storage, target, normalized);
  return normalized;
}

/**
 * Clears custom saved format overrides for a target and returns its defaults.
 */
export function resetFormatterTarget(storage, target = 'msg') {
  const key = target === 'bc' ? STORAGE_KEYS.FORMAT_BROADCAST : STORAGE_KEYS.FORMAT_MESSAGE;
  storage?.remove?.(key);
  return getDefaultFormatForTarget(target);
}

/**
 * Generates a live WhatsApp preview string from the active format config using sample sites.
 *
 * @param {Record<string, unknown>} formatConfig
 * @param {'msg' | 'bc'} target
 * @returns {string}
 */
export function buildFormatterPreview(formatConfig, target = 'msg') {
  const config = serializeFormatterForm(formatConfig, target);
  const sampleSites = [
    {
      impact: 'Fully Down',
      category: 'SMALL HUB SITE',
      traffic: 'HIGH',
      site_class: 'A',
      start_time: '2026-11-07 15:08:49',
      start_timestamp: 0,
      cluster: 'Semarang',
      site_name: 'Tugu Muda',
      old_site: 'SMG001',
      new_site: '14SMG0001',
      remark: 'PLN Off',
      rts: 'Jujuk Ahmad Afif',
      pic: 'Budi',
    },
    {
      impact: 'Partial Cell',
      category: 'END SITE',
      traffic: 'VERY HIGH',
      site_class: 'B',
      start_time: '2026-11-07 15:30:00',
      start_timestamp: 0,
      cluster: 'Semarang',
      site_name: 'Simpang Lima',
      old_site: 'SMG002',
      new_site: '14SMG0002',
      remark: 'BCCH missing fault',
      rts: 'Jujuk Ahmad Afif',
      pic: 'Budi',
    },
  ];

  const headerLine = config.msg_hdr
    .replace(/\{cluster\}/g, 'Semarang')
    .replace(/\{pic\}/g, 'Budi')
    .replace(/\{rts\}/g, 'Jujuk Ahmad Afif')
    .replace(/\{region\}/g, 'CJN')
    .replace(/\{date\}/g, '12-Nov-2026')
    .replace(/\{jam\}/g, '10:00')
    .replace(/\{total_sd\}/g, '1');

  const lines = [headerLine];
  const sep = config.spacing ? '\n\n' : '\n';
  const formatOpts = target === 'bc' ? { timeFormat: 'iso' } : undefined;

  const fullFormatted = formatSingleLine(sampleSites[0], config, true, formatOpts);
  const bcchFormatted = formatSingleLine(sampleSites[1], config, true, formatOpts);

  if (config.lbl_sd) {
    lines.push(`${config.lbl_sd}\n${fullFormatted.waLine}`);
  } else {
    lines.push(fullFormatted.waLine);
  }

  if (config.lbl_bcch) {
    lines.push(`${config.lbl_bcch}\n${bcchFormatted.waLine}`);
  } else if (config.lbl_cd) {
    lines.push(`${config.lbl_cd}\n${bcchFormatted.waLine}`);
  } else {
    lines.push(bcchFormatted.waLine);
  }

  return lines.join(sep);
}

