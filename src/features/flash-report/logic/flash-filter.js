/**
 * Filters Flash Master rows by impact mode ("FULLY" | "ALL") and operating region ("ALL" | "CJN" | "CJS").
 */
export function filterFlashRows(rows = [], { region = 'ALL', impact = 'FULLY' } = {}) {
  let filtered = Array.isArray(rows) ? rows : [];
  if (impact === 'FULLY') {
    filtered = filtered.filter((row) => row.isFully);
  }
  if (region && region !== 'ALL') {
    filtered = filtered.filter((row) => row.region === region);
  }
  return filtered;
}

/**
 * Computes Flash Report dashboard KPI metrics from filtered rows and manual PG entries.
 */
export function computeFlashStats(filteredRows = [], manualEntries = []) {
  const mcClusters = new Set();
  let matchedFromRows = 0;

  for (const row of filteredRows) {
    if (row.mcCluster && row.mcCluster.trim()) {
      mcClusters.add(row.mcCluster.trim());
    }
    if (row.matchesFilter) {
      matchedFromRows += 1;
    }
  }

  const totalRows = filteredRows.length;
  const mcCount = mcClusters.size;
  const matchedTotal = matchedFromRows + (Array.isArray(manualEntries) ? manualEntries.length : 0);

  return {
    totalRows,
    mcCount,
    mcList: Array.from(mcClusters),
    siteDown2g: totalRows,
    siteDown4g: totalRows,
    matchedTotal,
  };
}

