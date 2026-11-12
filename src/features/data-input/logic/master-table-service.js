/**
 * Derives UI status & snapshot feedback messages from parse_pasted_table responses.
 */
export function formatMasterProcessFeedback(parseResult, timeLabel = '') {
  const count = parseResult?.count ?? 0;
  const status = parseResult?.status ?? '';

  if (status === 'UNCHANGED') {
    return {
      statusText: `⚠️ Data sama — ✅ snapshot dipertahankan. (${count} baris, ${timeLabel})`,
      snapshotText: null,
    };
  }
  if (status === 'UPDATED_DETAILS') {
    return {
      statusText: `✅ Details updated — snapshot maintained. (${count} rows, ${timeLabel})`,
      snapshotText: null,
    };
  }
  if (status === 'NEW_BASELINE') {
    return {
      statusText: `Done! Data: ${count} rows processed.`,
      snapshotText: `Baseline: ${count} rows (first run)`,
    };
  }
  if (status === 'UPDATED') {
    return {
      statusText: `Done! Data: ${count} rows processed.`,
      snapshotText: `Snapshot ${count} rows — saved at ${timeLabel}`,
    };
  }

  return {
    statusText: 'Done! Data is empty or format not recognized.',
    snapshotText: null,
  };
}

/**
 * Determines whether the hourly automatic snapshot window is eligible to fire.
 */
export function shouldTriggerAutoSnapshot({
  hour,
  minute,
  lastSnapshotHour,
  masterCount,
} = {}) {
  return (
    hour !== lastSnapshotHour &&
    minute < 2 &&
    Number(masterCount) > 0
  );
}

