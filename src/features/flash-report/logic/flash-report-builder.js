import { formatShortMonthDate } from '../../../shared/utils/date-time.js';

function formatPositionPgLine(entry) {
  const clusterValue = (entry.fmOffice || entry.cluster || entry.mcCluster || '-').trim();
  const siteNameClean = (entry.siteName || '').trim();
  const siteIdClean = (entry.siteId || '').trim();
  const combinedSite =
    siteNameClean && siteNameClean.toUpperCase().includes(siteIdClean.toUpperCase())
      ? siteNameClean
      : `${siteIdClean}_${siteNameClean || siteIdClean}`;
  const hubValue = (entry.hubType || entry.category || 'SMALL HUB SITE').trim();
  const remarkValue = (entry.remark || '-').trim();
  return `- ${clusterValue} / ${combinedSite} / ${hubValue} | ${remarkValue}`;
}

function formatMcClusterList(mcList, delimiterMode) {
  if (delimiterMode === 'compact') return mcList.join('');
  if (delimiterMode === 'newline') return mcList.join('\n');
  if (delimiterMode === 'space') return mcList.join(' ');
  return mcList.length > 0 ? `${mcList.join(', ')}, ` : '';
}

/**
 * Generates formatted WhatsApp Flash Report text purely from filtered rows and form state.
 */
export function buildFlashReportText({
  filteredRows = [],
  manualEntries = [],
  timeStr = '21:00',
  titleRegion = 'Central Java',
  mcFormat = 'comma',
  count2g,
  count4g,
  dgRunning = 0,
  dgTotal = 0,
  teamMove = '',
  pgCompleted = '0',
  pgInstalled = '0',
  pgMovement = '0',
  referenceDate = new Date(),
} = {}) {
  const mcSet = new Set();
  for (const row of filteredRows) {
    if (row.mcCluster && row.mcCluster.trim()) {
      mcSet.add(row.mcCluster.trim());
    }
  }
  const mcList = Array.from(mcSet);
  const mcText = formatMcClusterList(mcList, mcFormat);

  const posPgLines = [];
  for (const row of filteredRows) {
    if (row.matchesFilter) {
      posPgLines.push(formatPositionPgLine(row));
    }
  }
  for (const manualEntry of manualEntries) {
    posPgLines.push(formatPositionPgLine(manualEntry));
  }

  const resolvedPgCompleted = String(pgCompleted ?? '').trim() || '0';
  const resolvedPgInstalled = String(pgInstalled ?? '').trim() || '0';
  const resolvedPgMovement = String(pgMovement ?? '').trim() || '0';
  const resolvedTeamMove = String(teamMove ?? '').trim();

  const summaryPg = resolvedTeamMove
    ? `Team Move : ${resolvedTeamMove} | PG Completed : ${resolvedPgCompleted} | PG Installed : ${resolvedPgInstalled} | PG Movement : ${resolvedPgMovement}`
    : `PG Completed : ${resolvedPgCompleted} | PG Installed : ${resolvedPgInstalled} | PG Movement : ${resolvedPgMovement}`;

  const formattedDate = formatShortMonthDate(referenceDate);

  const resolved2g = count2g ?? filteredRows.length;
  const resolved4g = count4g ?? filteredRows.length;

  let output = `${timeStr}\n\n`;
  output += `*Template flash report: ${titleRegion} ${formattedDate} ${timeStr}*\n\n\n`;
  output += '==================\n';
  output += `🔷 *MC impact:  ${mcList.length} MC*\n`;
  output += `${mcText || '(Belum ada MC impact)'}\n\n`;
  output += '🔷 *SITE DOWN :*\n';
  output += `🔹 *2G : ${resolved2g}*\n`;
  output += `🔹 *4G : ${resolved4g}*\n\n`;
  output += '🔷 *DG Status*\n';
  output += `🔹 ${dgRunning} of ${dgTotal} Running*\n\n`;
  output += '🔷 *POSISION PG*\n';
  output += `${summaryPg}\n`;

  if (posPgLines.length > 0) {
    output += `${posPgLines.join('\n')}\n`;
  }

  return output.trim();
}

/**
 * Computes the default rounded hour timestamp ("HH:00") for Flash Report initialization.
 */
export function computeDefaultFlashReportTime(referenceDate = new Date()) {
  const roundedDate = new Date(referenceDate.getTime());
  if (roundedDate.getMinutes() >= 30) {
    roundedDate.setHours(roundedDate.getHours() + 1);
  }
  roundedDate.setMinutes(0, 0, 0);
  const hour = String(roundedDate.getHours()).padStart(2, '0');
  return `${hour}:00`;
}

