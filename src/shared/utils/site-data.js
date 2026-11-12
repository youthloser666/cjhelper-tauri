const ROLE_PREFIX_TOKENS = new Set(['RTS', 'TE', 'CME']);

const DATABASE_COPY_FIELDS = Object.freeze([
  'Site ID (New)',
  'Old Site ID',
  'Site Name',
  'Host Name',
  'Cluster (MC)',
  'FM Office',
  'Area',
  'Vendor',
  'TE Name',
  'TE Phone',
  'TE Email',
  'Longitude',
  'Latitude',
  'RTS Name',
  'RTS Phone',
  'RTS NEW',
  'TLP',
  'CME Name',
  'CME Phone',
  'CME Email',
  'IP Mplane BTS',
  'Mplane IP Address',
  'Netact MRBTS',
]);

function hasNonEmptyValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function normalizeHeaderText(headerText) {
  return String(headerText ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Resolves a site database column value using exact key matches first,
 * followed by case-insensitive loose token matching without crossing role prefixes.
 */
export function getDatabaseFieldValue(row, keysOrTokens, fallback = '—') {
  if (!row || typeof row !== 'object') {
    return fallback;
  }

  const candidates = Array.isArray(keysOrTokens) ? keysOrTokens : [keysOrTokens];
  if (candidates.length === 0) {
    return fallback;
  }

  // Pass 1: Exact key lookup
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, key) && hasNonEmptyValue(row[key])) {
      return String(row[key]).trim();
    }
  }

  const rowEntries = Object.entries(row).map(([key, value]) => ({
    rawKey: key,
    normalizedKey: normalizeHeaderText(key),
    value,
  }));

  // Pass 2: Normalized exact header lookup (handles case/spacing differences)
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHeaderText(candidate);
    if (!normalizedCandidate) continue;

    const exactNormalizedMatch = rowEntries.find(
      (entry) => entry.normalizedKey === normalizedCandidate && hasNonEmptyValue(entry.value)
    );
    if (exactNormalizedMatch) {
      return String(exactNormalizedMatch.value).trim();
    }
  }

  // Pass 3: All-token match on the row header (e.g., ['TE', 'PHONE'] -> 'TE Phone')
  const normalizedTokens = candidates
    .map((token) => normalizeHeaderText(token))
    .filter(Boolean);

  if (normalizedTokens.length === 0) {
    return fallback;
  }

  const allTokenMatch = rowEntries.find((entry) =>
    hasNonEmptyValue(entry.value) &&
    normalizedTokens.every((token) => entry.normalizedKey.includes(token))
  );
  if (allTokenMatch) {
    return String(allTokenMatch.value).trim();
  }

  // Pass 4: Fallback for optional trailing synonym token such as ['SITE', 'ID', 'MSH']
  // Never drop a leading role token (RTS, TE, CME) so contacts cannot cross-match.
  const leadingToken = normalizedTokens[0];
  if (normalizedTokens.length >= 3 && !ROLE_PREFIX_TOKENS.has(leadingToken)) {
    const coreTokens = normalizedTokens.slice(0, normalizedTokens.length - 1);
    const coreTokenMatch = rowEntries.find((entry) =>
      hasNonEmptyValue(entry.value) &&
      coreTokens.every((token) => entry.normalizedKey.includes(token))
    );
    if (coreTokenMatch) {
      return String(coreTokenMatch.value).trim();
    }
  }

  return fallback;
}

/**
 * Formats a site database record into the 23-line clipboard summary string.
 */
export function buildSiteDatabaseCopyText(siteRow) {
  return DATABASE_COPY_FIELDS
    .map((fieldLabel) => `${fieldLabel}: ${getDatabaseFieldValue(siteRow, [fieldLabel], '—')}`)
    .join('\n');
}

