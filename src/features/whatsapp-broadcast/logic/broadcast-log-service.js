import { STORAGE_KEYS } from '../../../shared/state/storage-keys.js';

export function getTodayLogDateString(now = new Date()) {
  return now.toLocaleDateString('id-ID');
}

/**
 * Loads daily broadcast history from storage, automatically resetting if the calendar date changed.
 */
export function loadBroadcastLogs(storageAdapter, todayStr = getTodayLogDateString()) {
  const saved = storageAdapter?.getJson(STORAGE_KEYS.BROADCAST_LOGS, null);
  if (saved && saved.date === todayStr && Array.isArray(saved.logs)) {
    return [...saved.logs];
  }
  return [];
}

/**
 * Appends a broadcast run entry and persists today's log envelope.
 */
export function appendBroadcastLog(
  storageAdapter,
  currentLogs = [],
  {
    success = 0,
    total = 0,
    groups = [],
    dateStr = getTodayLogDateString(),
    timeStr = new Date().toLocaleTimeString('id-ID'),
  } = {}
) {
  const nextLogs = [
    ...(Array.isArray(currentLogs) ? currentLogs : []),
    { time: timeStr, success, total, groups },
  ];
  storageAdapter?.setJson(STORAGE_KEYS.BROADCAST_LOGS, {
    date: dateStr,
    logs: nextLogs,
  });
  return nextLogs;
}

/**
 * Formats daily broadcast log entries newest-first for the log textarea.
 */
export function formatBroadcastLogsDisplay(logs = []) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return 'Belum ada broadcast hari ini.';
  }

  return [...logs]
    .reverse()
    .map((entry) => {
      const icon = entry.success === entry.total ? '✅' : '⚠️';
      const groupsLabel = Array.isArray(entry.groups) ? entry.groups.join(', ') : entry.groups;
      return `[${entry.time}]  ${icon}  ${entry.success}/${entry.total} berhasil  →  ${groupsLabel}\n`;
    })
    .join('');
}

