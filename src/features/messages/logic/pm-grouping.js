import { detectRegion } from '../../../shared/utils/region-detector.js';
import { formatSingleLine } from './line-formatter.js';
import { classifyRemarkClarity, matchesRemarkClarityFilter } from './remark-clarity.js';

function isUntitledPic(rawPic) {
  const normalized = (rawPic || '').trim().toLowerCase();
  return (
    !normalized ||
    normalized === '—' ||
    normalized === '-' ||
    normalized === '0' ||
    normalized === 'nan' ||
    normalized.includes('untitled') ||
    normalized === 'unknown te' ||
    normalized === 'te unknown' ||
    normalized === 'null'
  );
}

/**
 * Combines down sites from Master and matched Netdrone data, formats each entry,
 * and groups them by Cluster/TE PIC or RTS with search filtering applied.
 */
export function buildPmGroups({
  statusData = [],
  netdroneData = [],
  regionFilter = 'ALL',
  pmMode = 'cluster',
  filters = {},
  fmtMsg,
  showRemark = true,
} = {}) {
  const clusterFilter = (filters.cluster || '').toLowerCase();
  const newSiteFilter = (filters.newSite || '').toLowerCase();
  const remarkFilter = (filters.remark || '').toLowerCase();
  const clarityFilter = (filters.clarity || 'all').toLowerCase();

  const downSites = (statusData || []).filter((site) => site.status === 'DOWN');

  if (Array.isArray(netdroneData) && netdroneData.length > 0) {
    netdroneData
      .filter((row) => !row.skipped && row.matchedDb)
      .forEach((netdroneRow) => {
        const mappedSite = {
          status: 'DOWN',
          impact: 'Full Sitedown',
          new_site: netdroneRow.siteId,
          old_site: '',
          site_name: netdroneRow.siteName,
          cluster: netdroneRow.cluster || 'UNKNOWN',
          pic: netdroneRow.pic || '',
          rts: netdroneRow.rts || '',
          start_time: netdroneRow.startTime || '',
          agging: '',
          remark: netdroneRow.remark || '',
          category: netdroneRow.category || '',
          traffic: netdroneRow.traffic || netdroneRow.siteClass || '',
          site_class: netdroneRow.siteClass || '',
          vendor: netdroneRow.vendor || '',
          te_phone: netdroneRow.tePhone || '',
          is_netdrone: true,
        };
        if (!regionFilter || regionFilter === 'ALL' || detectRegion(mappedSite) === regionFilter) {
          downSites.push(mappedSite);
        }
      });
  }

  const rawGroupsMap = {};

  if (pmMode === 'cluster') {
    downSites.forEach((site) => {
      const rawPic = (site.pic || site.te_name || '').trim();
      const resolvedPic = isUntitledPic(rawPic)
        ? `TE UNKNOWN (${site.cluster || 'UNKNOWN'})`
        : rawPic;

      if (!rawGroupsMap[resolvedPic]) {
        rawGroupsMap[resolvedPic] = {
          pic: resolvedPic,
          te: resolvedPic,
          rts: site.rts || '',
          clusters: new Set(),
          entries: [],
        };
      }

      if (site.cluster) rawGroupsMap[resolvedPic].clusters.add(site.cluster);
      const formatted = formatSingleLine(site, fmtMsg, showRemark);
      rawGroupsMap[resolvedPic].entries.push({
        ...site,
        ...formatted,
        remarkClarity: classifyRemarkClarity(site.remark),
      });

      if (!rawGroupsMap[resolvedPic].rts && site.rts) {
        rawGroupsMap[resolvedPic].rts = site.rts;
      }
    });

    for (const groupKey of Object.keys(rawGroupsMap)) {
      const sortedClusters = Array.from(rawGroupsMap[groupKey].clusters)
        .filter(Boolean)
        .sort((first, second) =>
          first.localeCompare(second, undefined, { numeric: true, sensitivity: 'base' })
        );
      rawGroupsMap[groupKey].cluster = sortedClusters.join(', ') || 'UNKNOWN';
    }
  } else {
    downSites.forEach((site) => {
      const resolvedRts = site.rts || '(Tanpa RTS)';
      const resolvedPic = site.pic || '';

      if (!rawGroupsMap[resolvedRts]) {
        rawGroupsMap[resolvedRts] = {
          rts: resolvedRts,
          pic: resolvedPic,
          te: resolvedPic,
          cluster: '',
          clusters: new Set(),
          entries: [],
        };
      }

      if (!rawGroupsMap[resolvedRts].pic && resolvedPic) {
        rawGroupsMap[resolvedRts].pic = resolvedPic;
        rawGroupsMap[resolvedRts].te = resolvedPic;
      }

      if (site.cluster) rawGroupsMap[resolvedRts].clusters.add(site.cluster);
      const formatted = formatSingleLine(site, fmtMsg, showRemark);
      rawGroupsMap[resolvedRts].entries.push({
        ...site,
        ...formatted,
        remarkClarity: classifyRemarkClarity(site.remark),
      });
    });

    for (const groupKey of Object.keys(rawGroupsMap)) {
      const sortedClusters = Array.from(rawGroupsMap[groupKey].clusters).sort((first, second) =>
        first.localeCompare(second, undefined, { numeric: true, sensitivity: 'base' })
      );
      rawGroupsMap[groupKey].cluster = sortedClusters.join(', ');
    }
  }

  const groups = [];
  for (const [groupKey, rawGroup] of Object.entries(rawGroupsMap)) {
    if (clusterFilter && !rawGroup.cluster.toLowerCase().includes(clusterFilter)) continue;

    let entries = rawGroup.entries;
    if (newSiteFilter || remarkFilter || (clarityFilter && clarityFilter !== 'all')) {
      entries = entries.filter((entry) => {
        if (newSiteFilter && !(entry.new_site || '').toLowerCase().includes(newSiteFilter)) {
          return false;
        }
        if (remarkFilter && !(entry.remark || '').toLowerCase().includes(remarkFilter)) {
          return false;
        }
        if (!matchesRemarkClarityFilter(entry.remark, clarityFilter)) {
          return false;
        }
        return true;
      });
      if (entries.length === 0) continue;
    }

    const fully = entries.filter((entry) => entry.isFully);
    const cellBcch = entries.filter((entry) => !entry.isFully && entry.isBcch);
    const cell = entries.filter((entry) => !entry.isFully && !entry.isBcch);

    const header =
      pmMode === 'cluster'
        ? rawGroup.pic
          ? `${rawGroup.cluster}  |  ${rawGroup.pic}  |  RTS: ${rawGroup.rts}`
          : `${rawGroup.cluster}  |  RTS: ${rawGroup.rts}`
        : `RTS: ${rawGroup.rts}`;

    groups.push({
      key: groupKey,
      cluster: rawGroup.cluster,
      pic: rawGroup.pic,
      te: rawGroup.pic,
      rts: rawGroup.rts || '',
      header,
      fully,
      cell,
      cellBcch,
      allEntries: [...fully, ...cell, ...cellBcch],
    });
  }

  return groups.sort((first, second) => first.header.localeCompare(second.header));
}

/**
 * Generates formatted plain text for one PM group using active formatting config and mode.
 */
export function generatePmGroupText(group, { formatConfig, pmMode = 'cluster', useBcFormat = false } = {}) {
  const ctx = {
    cluster: group.cluster,
    rts: group.rts,
    pic: group.pic,
    te: group.pic,
  };

  let headerText = (formatConfig.msg_hdr || '').replace(/\{(\w+)\}/g, (_, token) => ctx[token] || '');

  if (pmMode === 'rts' && !useBcFormat) {
    const clusterCount = group.cluster ? group.cluster.split(', ').length : 0;
    headerText = `RTS : ${group.rts} (${clusterCount} cluster: ${group.cluster}) | SD: ${group.fully.length} | CD: ${group.cell.length}`;
  }

  const lines = [headerText, ''];
  const useExtraSpacing = Boolean(formatConfig.spacing);

  const appendSection = (label, items) => {
    if (!items || items.length === 0) return;
    lines.push(label);
    items.forEach((item) => {
      lines.push(item.waLine);
      if (useExtraSpacing) lines.push('');
    });
    if (!useExtraSpacing) lines.push('');
  };

  appendSection(formatConfig.lbl_sd, group.fully);
  appendSection(formatConfig.lbl_cd, group.cell);
  appendSection(formatConfig.lbl_bcch, group.cellBcch);

  return lines.join('\n').trim();
}

