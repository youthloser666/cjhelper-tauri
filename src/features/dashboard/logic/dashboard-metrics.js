import { detectRegion } from '../../../shared/utils/region-detector.js';
import { normalizeWhatsAppNumber } from '../../../shared/utils/phone-normalizer.js';

/**
 * Computes pure dashboard summary counts for status rows, TE contacts,
 * and pending site override changes scoped by the active region filter.
 */
export function computeDashboardMetrics({
  regionFilter = 'ALL',
  statusData = [],
  contacts = [],
  siteChanges = { overrides: {} },
  lastLoadedChangesFileName = '',
} = {}) {
  const normalizedRegion = regionFilter || 'ALL';

  const scopedSites = normalizedRegion === 'ALL'
    ? statusData
    : statusData.filter((site) => detectRegion(site) === normalizedRegion);

  let upCount = 0;
  let downCount = 0;
  for (const site of scopedSites) {
    if (site.status === 'UP') {
      upCount += 1;
    } else {
      downCount += 1;
    }
  }

  const scopedContacts = normalizedRegion === 'ALL'
    ? contacts
    : contacts.filter((contact) =>
        detectRegion({
          cluster: contact.cluster,
          siteName: '',
          remark: '',
          pic: contact.name,
        }) === normalizedRegion
      );

  const contactTotal = scopedContacts.length;
  const contactValid = scopedContacts.filter((contact) => Boolean(normalizeWhatsAppNumber(contact.phone))).length;
  const contactUnset = contactTotal - contactValid;
  const contactClusters = new Set(
    scopedContacts
      .map((contact) => String(contact.cluster || '').trim().toUpperCase())
      .filter(Boolean)
  ).size;

  const overridesCount = Object.keys(siteChanges?.overrides || {}).length;

  let changesSummaryText = '0 diubah';
  let changesSummaryTitle = 'Belum ada site diubah';
  let changesTone = 'empty';

  if (lastLoadedChangesFileName) {
    changesSummaryText = `📁 ${lastLoadedChangesFileName}`;
    changesSummaryTitle = `${lastLoadedChangesFileName} (${overridesCount} site)`;
    changesTone = 'loaded';
  } else if (overridesCount > 0) {
    changesSummaryText = `${overridesCount} site diubah`;
    changesSummaryTitle = `${overridesCount} site diubah di sesi ini`;
    changesTone = 'dirty';
  }

  return {
    downCount,
    upCount,
    contactTotal,
    contactValid,
    contactUnset,
    contactClusters,
    overridesCount,
    changesSummaryText,
    changesSummaryTitle,
    changesTone,
  };
}

