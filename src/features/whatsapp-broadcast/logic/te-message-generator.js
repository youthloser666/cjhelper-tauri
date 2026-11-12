import { detectRegion } from '../../../shared/utils/region-detector.js';
import { DEFAULT_BC_FORMAT, DEFAULT_MSG_FORMAT } from '../../messages/logic/format-config.js';
import {
  formatSingleLine,
  convertPivotRowToSiteItem,
  formatPivotSiteLine,
} from '../../messages/logic/line-formatter.js';
import {
  DEFAULT_BLAST_FILTER_CONFIG,
  classifySiteOutageCategory,
  isBlastSiteSelected,
} from './blast-filter.js';

const UNTITLED_TE_VALUES = new Set(['—', '-', '0', 'nan', 'unknown te', 'te unknown', 'null']);

function naturalCompare(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function isUntitledTeName(rawTe) {
  const trimmed = String(rawTe || '').trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return UNTITLED_TE_VALUES.has(lower) || lower.includes('untitled');
}

function mapNetdroneRowsToDownSites(netdroneData = [], regionFilter = 'ALL') {
  const mapped = [];
  for (const row of netdroneData) {
    if (!row || row.skipped || !row.matchedDb) continue;
    const siteObj = {
      status: 'DOWN',
      impact: 'Full Sitedown',
      new_site: row.siteId,
      old_site: '',
      site_name: row.siteName,
      cluster: row.cluster || 'UNKNOWN',
      pic: row.pic || '',
      rts: row.rts || '',
      start_time: row.startTime || '',
      start_timestamp: 0,
      agging: '',
      remark: row.remark || '',
      category: row.category || '',
      site_class: row.siteClass || '',
      vendor: row.vendor || '',
      te_phone: row.tePhone || '',
      is_netdrone: true,
    };

    if (!regionFilter || regionFilter === 'ALL' || detectRegion(siteObj) === regionFilter) {
      mapped.push(siteObj);
    }
  }
  return mapped;
}

function splitSelectedTeItems(sites = [], { selectionMap = {}, filterConfig, formatConfig } = {}) {
  const sitedown = [];
  const celldown = [];
  const bcch = [];

  for (const site of sites) {
    const category = classifySiteOutageCategory(site, formatConfig);
    const selected = isBlastSiteSelected(site, selectionMap, filterConfig, formatConfig);
    if (!selected) continue;

    if (category === 'sitedown' && filterConfig.enableSitedown) {
      sitedown.push(site);
    } else if (category === 'bcch' && filterConfig.enableBcch) {
      bcch.push(site);
    } else if (category === 'celldown' && filterConfig.enableCelldown) {
      celldown.push(site);
    }
  }

  return { sitedown, celldown, bcch };
}

function filterPivotRowsForCluster(pivotData = [], clusterString = '', filterConfig = {}) {
  const clusterUpper = String(clusterString || '').toUpperCase();
  const inCluster = (row) => String(row?.cluster || '').toUpperCase() === clusterUpper;

  const stollenRows = filterConfig.enableStolen
    ? pivotData.filter((row) => row?.monitoring === 'STOLLEN' && inCluster(row))
    : [];
  const cableStollenRows = filterConfig.enableStolen
    ? pivotData.filter((row) => row?.monitoring === 'CABLE STOLLEN' && inCluster(row))
    : [];
  const envaAlarmRows = filterConfig.enableEnva
    ? pivotData.filter((row) => {
        const mon = String(row?.monitoring || '');
        return (mon.includes('POWER') || mon.includes('ENVA')) && !mon.includes('NETECO') && inCluster(row);
      })
    : [];
  const envaNetecoRows = filterConfig.enableEnva
    ? pivotData.filter((row) => String(row?.monitoring || '').includes('NETECO') && inCluster(row))
    : [];

  return { stollenRows, cableStollenRows, envaAlarmRows, envaNetecoRows };
}

/**
 * Counts how many qualifying items (outage sites + enabled Pivot alarms) exist for a TE group.
 */
export function getTeMessageItemCount(
  sites = [],
  cluster = '',
  {
    pivotData = [],
    selectionMap = {},
    filterConfig = DEFAULT_BLAST_FILTER_CONFIG,
    formatConfig = DEFAULT_MSG_FORMAT,
  } = {}
) {
  const { sitedown, celldown, bcch } = splitSelectedTeItems(sites, {
    selectionMap,
    filterConfig,
    formatConfig,
  });
  const { stollenRows, cableStollenRows, envaAlarmRows, envaNetecoRows } =
    filterPivotRowsForCluster(pivotData, cluster, filterConfig);

  return {
    total:
      sitedown.length +
      celldown.length +
      bcch.length +
      stollenRows.length +
      cableStollenRows.length +
      envaAlarmRows.length +
      envaNetecoRows.length,
  };
}

/**
 * Aggregates down sites (plus Netdrone matches when enabled) into per-TE groups for WA Blast TE.
 */
export function buildTeGroups({
  statusData = [],
  netdroneData = [],
  pivotData = [],
  savedTeContacts = [],
  regionFilter = 'ALL',
  selectionMap = {},
  filterConfig = DEFAULT_BLAST_FILTER_CONFIG,
  formatConfig = DEFAULT_MSG_FORMAT,
} = {}) {
  const downSites = statusData.filter((site) => site?.status === 'DOWN');
  if (filterConfig.enableNetdrone && netdroneData.length > 0) {
    downSites.push(...mapNetdroneRowsToDownSites(netdroneData, regionFilter));
  }

  const groups = {};

  for (const site of downSites) {
    const rawTe = String(site.pic || '').trim();
    const cluster = String(site.cluster || '').trim();
    const isUnassigned = isUntitledTeName(rawTe);
    const clusterLabel = cluster || 'Tanpa Cluster';

    const teDisplayName = isUnassigned ? `[Belum Ada TE] ${clusterLabel}` : rawTe;
    const groupKey = isUnassigned
      ? `UNASSIGNED_${clusterLabel.toUpperCase()}`
      : rawTe.toUpperCase();

    const matchedContact = savedTeContacts.find((contact) => {
      const contactName = String(contact?.name || '').trim().toUpperCase();
      const contactCluster = String(contact?.cluster || '').trim().toUpperCase();
      if (isUnassigned) {
        return (
          contactCluster === cluster.toUpperCase() &&
          (contactName.includes('BELUM ADA') ||
            contactName.includes('NO TE') ||
            contactName.includes('PIC'))
        );
      }
      return contactName === teDisplayName.toUpperCase();
    });

    let tePhone = String(matchedContact?.phone || '').trim();
    if (
      !tePhone &&
      site.te_phone &&
      site.te_phone !== '0' &&
      String(site.te_phone).toLowerCase() !== 'nan'
    ) {
      tePhone = String(site.te_phone).trim();
    }

    if (!groups[groupKey]) {
      groups[groupKey] = {
        name: teDisplayName,
        rawName: rawTe,
        clusters: new Set(),
        phone: tePhone,
        sites: [],
        isUnassigned,
      };
    }

    if (cluster) groups[groupKey].clusters.add(cluster);
    if (!groups[groupKey].phone && tePhone) groups[groupKey].phone = tePhone;
    groups[groupKey].sites.push(site);
  }

  for (const key of Object.keys(groups)) {
    const sortedClusters = Array.from(groups[key].clusters)
      .filter(Boolean)
      .sort(naturalCompare);
    groups[key].cluster = sortedClusters.join(', ') || '—';

    const counts = getTeMessageItemCount(groups[key].sites, groups[key].cluster, {
      pivotData,
      selectionMap,
      filterConfig,
      formatConfig,
    });
    if (counts.total === 0) {
      delete groups[key];
    }
  }

  return groups;
}

/**
 * Generates the direct WhatsApp blast message body for an individual TE.
 */
export function generateTeMessage(
  sites = [],
  cluster = '',
  {
    pivotData = [],
    statusData = [],
    selectionMap = {},
    filterConfig = DEFAULT_BLAST_FILTER_CONFIG,
    formatConfig = DEFAULT_MSG_FORMAT,
  } = {}
) {
  const { sitedown, celldown, bcch } = splitSelectedTeItems(sites, {
    selectionMap,
    filterConfig,
    formatConfig,
  });
  const { stollenRows, cableStollenRows, envaAlarmRows, envaNetecoRows } =
    filterPivotRowsForCluster(pivotData, cluster, filterConfig);

  const parts = [];
  const appendSection = (heading, lines) => {
    if (!lines.length) return;
    parts.push(heading, ...lines, '');
  };

  appendSection(
    `*STOLEN BATTERY :: ${stollenRows.length}*`,
    stollenRows.map((row) =>
      formatPivotSiteLine(row, formatConfig, { statusData, categoryOverride: 'STOLEN BATTERY' })
    )
  );
  appendSection(
    `*STOLEN CABLE :: ${cableStollenRows.length}*`,
    cableStollenRows.map((row) =>
      formatPivotSiteLine(row, formatConfig, { statusData, categoryOverride: 'STOLEN CABLE' })
    )
  );
  appendSection(
    `*SITEDOWN :: ${sitedown.length}*`,
    sitedown.map((site) => formatSingleLine(site, formatConfig).waLine)
  );
  appendSection(
    `*CELLDOWN :: ${celldown.length}*`,
    celldown.map((site) => formatSingleLine(site, formatConfig).waLine)
  );
  appendSection(
    `*CELLDOWN BCCH :: ${bcch.length}*`,
    bcch.map((site) => formatSingleLine(site, formatConfig).waLine)
  );
  appendSection(
    `*ENVA ALARM :: ${envaAlarmRows.length}*`,
    envaAlarmRows.map((row) => formatPivotSiteLine(row, formatConfig, { statusData }))
  );
  appendSection(
    `*ENVA NETECO :: ${envaNetecoRows.length}*`,
    envaNetecoRows.map((row) => formatPivotSiteLine(row, formatConfig, { statusData }))
  );

  return parts.join('\n').trim();
}

function formatBroadcastLine(site, formatConfig, showRemark) {
  // Broadcast formatter keeps {old} empty and appends msg_remark inline when showRemark is true.
  const baseLine = formatSingleLine(
    { ...site, old_site: '', rts: site.rts || site.pic || '' },
    formatConfig,
    false
  ).waLine;

  const remarkTpl = formatConfig.msg_remark || ' / {remark}';
  if (showRemark && site.remark && !site.is_pivot && remarkTpl.trim()) {
    return baseLine + remarkTpl.replace(/\{remark\}/g, site.remark || '');
  }
  return baseLine;
}

function appendVendorBuckets(parts, sectionTitle, items, formatConfig, showRemark, emptyFallback) {
  const huawei = items.filter((entry) => String(entry.vendor || '').toUpperCase().includes('HUA'));
  const nokia = items.filter((entry) => String(entry.vendor || '').toUpperCase().includes('NOK'));
  const others = items.filter((entry) => {
    const vendor = String(entry.vendor || '').toUpperCase();
    return !vendor.includes('HUA') && !vendor.includes('NOK');
  });

  const formatBucket = (rows) => rows.map((row) => formatBroadcastLine(row, formatConfig, showRemark)).join('\n');

  if (huawei.length > 0) {
    parts.push(`*${sectionTitle} MOCN HUAWEI :: ${huawei.length}*`, formatBucket(huawei), '');
  }
  if (nokia.length > 0) {
    parts.push(`*${sectionTitle} MOCN NOKIA :: ${nokia.length}*`, formatBucket(nokia), '');
  }
  if (others.length > 0) {
    parts.push(`*${sectionTitle}*`, formatBucket(others), '');
  }
  if (items.length === 0 && emptyFallback) {
    parts.push(`*${sectionTitle}*`, emptyFallback, '');
  }
}

/**
 * Generates the regional WhatsApp group broadcast message (`generateShareWA` parity).
 */
export function generateShareBroadcastMessage(
  statuses = [],
  {
    region = 'CJN',
    formatConfig = DEFAULT_BC_FORMAT,
    netdroneData = [],
    pivotData = [],
    enableNetdrone = false,
    nowDate = new Date(),
  } = {}
) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return 'Belum ada data Master.';
  }

  const rounded = new Date(nowDate.getTime());
  if (rounded.getMinutes() >= 30) {
    rounded.setHours(rounded.getHours() + 1);
  }
  rounded.setMinutes(0, 0, 0);

  const showRemark = rounded.getHours() % 2 === 0;
  const dateStr = rounded
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
    .replace(/ /g, '-');
  const timeStr = rounded
    .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    .replace(/\./g, ':');

  const sortByRts = (arr) => [...arr].sort((a, b) => naturalCompare(a.rts, b.rts));

  const downSites = statuses.filter((site) => site?.status === 'DOWN');
  if (enableNetdrone && netdroneData.length > 0) {
    downSites.push(...mapNetdroneRowsToDownSites(netdroneData, region));
  }

  const fullyDown = sortByRts(
    downSites.filter((site) => classifySiteOutageCategory(site, formatConfig) === 'sitedown')
  );
  const cellAll = sortByRts(
    downSites.filter((site) => classifySiteOutageCategory(site, formatConfig) !== 'sitedown')
  );

  const bcchKeyword = String(formatConfig.key_bcch || 'BCCH').toUpperCase();
  const cellBcch = cellAll.filter((site) =>
    String(site.remark || '').toUpperCase().includes(bcchKeyword)
  );
  const cellNormal = cellAll.filter(
    (site) => !String(site.remark || '').toUpperCase().includes(bcchKeyword)
  );

  const secSd = String(formatConfig.lbl_sd || 'SITE DOWN :').replace(/:/g, '').trim();
  const secCd = String(formatConfig.lbl_cd || 'CELLS DOWN :').replace(/:/g, '').trim();
  const secBcch = String(formatConfig.lbl_bcch || 'CELL DOWN BCCH Missing NOKIA :').trim();

  const headerTemplate =
    formatConfig.msg_hdr || '*SITE FULLY DOWN {region}  {date} {jam}*\n*TOTAL SITEDOWN : {total_sd}*';
  const headerText = headerTemplate
    .replace(/{region}/g, region)
    .replace(/{date}/g, dateStr)
    .replace(/{jam}/g, timeStr)
    .replace(/{total_sd}/g, String(fullyDown.length))
    .replace(/{total_cd}/g, String(cellNormal.length));

  const parts = [headerText, ''];

  const appendPivotGroup = (rows, headingFactory, categoryOverride = null) => {
    const systems = [...new Set(rows.map((row) => row.system))];
    for (const sys of systems) {
      const sysRows = rows.filter((row) => row.system === sys);
      if (!sysRows.length) continue;
      const lines = sysRows.map((row) => {
        const item = convertPivotRowToSiteItem(row, statuses);
        if (categoryOverride) item.category = categoryOverride;
        return formatBroadcastLine(item, formatConfig, showRemark);
      });
      parts.push(headingFactory(sys, sysRows.length), lines.join('\n'), '');
    }
  };

  if (pivotData.length > 0) {
    appendPivotGroup(
      pivotData.filter((row) => row.monitoring === 'STOLLEN'),
      (sys) => `*ALARM STOLLEN BATTERY ${sys} : *`,
      'STOLEN BATTERY'
    );
    appendPivotGroup(
      pivotData.filter((row) => row.monitoring === 'CABLE STOLLEN'),
      (sys) => `*INDIKASI CABLE STOLLEN ${sys}*`,
      'STOLEN CABLE'
    );
  }

  appendVendorBuckets(parts, secSd, fullyDown, formatConfig, showRemark, '- Nihil -');

  if (pivotData.length > 0) {
    appendPivotGroup(
      pivotData.filter((row) => {
        const mon = String(row.monitoring || '');
        return mon === 'POWER NOW' || mon.includes('POWER') || mon.includes('ENVA');
      }),
      (sys, count) => `*ENVA POWER ${sys} : : ${count}*`
    );
  }

  appendVendorBuckets(parts, secCd, cellNormal, formatConfig, showRemark, '- Nihil -');

  if (cellBcch.length > 0) {
    parts.push(
      `*${secBcch} (${cellBcch.length})*`,
      cellBcch.map((site) => formatBroadcastLine(site, formatConfig, showRemark)).join('\n')
    );
  }

  return parts.join('\n').trim();
}

