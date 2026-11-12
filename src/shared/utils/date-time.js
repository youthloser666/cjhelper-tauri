export const MONTH_SHORT_NAMES = Object.freeze([
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]);

const MONTH_NAME_INDEX = Object.freeze({
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  mei: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  agu: 7,
  sep: 8,
  oct: 9,
  okt: 9,
  nov: 10,
  dec: 11,
  des: 11,
});

function padTwoDigits(numberValue) {
  return String(numberValue).padStart(2, '0');
}

function parseFlexibleTimestamp(rawDateInput) {
  if (!rawDateInput) return null;
  if (rawDateInput instanceof Date) {
    return Number.isNaN(rawDateInput.getTime()) ? null : rawDateInput;
  }

  const trimmed = String(rawDateInput).trim();
  if (!trimmed) return null;

  // YYYY-MM-DD HH:mm(:ss)? or YYYY-MM-DDTHH:mm(:ss)? without timezone offset
  const isoLocalMatch = trimmed.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (isoLocalMatch) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = isoLocalMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
  }

  // DD/MM/YYYY HH:mm(:ss)? or DD-MM-YYYY
  const dmyNumericMatch = trimmed.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmyNumericMatch) {
    const [, day, month, yearRaw, hour = '0', minute = '0', second = '0'] = dmyNumericMatch;
    const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
    return new Date(
      year,
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
  }

  // DD-MMM-YY(YY) HH:mm(:ss)?
  const dmyNamedMonthMatch = trimmed.match(
    /^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmyNamedMonthMatch) {
    const [, day, monthName, yearRaw, hour = '0', minute = '0', second = '0'] = dmyNamedMonthMatch;
    const monthIndex = MONTH_NAME_INDEX[monthName.toLowerCase()];
    if (monthIndex !== undefined) {
      const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
      return new Date(
        year,
        monthIndex,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      );
    }
  }

  const parsedFallback = new Date(trimmed);
  return Number.isNaN(parsedFallback.getTime()) ? null : parsedFallback;
}

function formatIsoParts(date, { useUtc = false, includeSeconds = false } = {}) {
  const year = useUtc ? date.getUTCFullYear() : date.getFullYear();
  const month = padTwoDigits((useUtc ? date.getUTCMonth() : date.getMonth()) + 1);
  const day = padTwoDigits(useUtc ? date.getUTCDate() : date.getDate());
  const hour = padTwoDigits(useUtc ? date.getUTCHours() : date.getHours());
  const minute = padTwoDigits(useUtc ? date.getUTCMinutes() : date.getMinutes());
  if (!includeSeconds) {
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }
  const second = padTwoDigits(useUtc ? date.getUTCSeconds() : date.getSeconds());
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Formats a Date or date string into title-case "DD-Mmm-YYYY" (e.g., "12-Nov-2026").
 */
export function formatShortMonthDate(rawDateInput = new Date()) {
  const parsedDate =
    rawDateInput instanceof Date
      ? Number.isNaN(rawDateInput.getTime())
        ? null
        : rawDateInput
      : parseFlexibleTimestamp(rawDateInput);
  if (!parsedDate) return '';

  const day = padTwoDigits(parsedDate.getDate());
  const month = MONTH_SHORT_NAMES[parsedDate.getMonth()];
  const year = parsedDate.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Formats an input date string as "YYYY-MM-DD HH:mm".
 * Returns empty string for empty input and preserves unparseable raw text.
 */
export function formatPivotDate(rawDateInput) {
  const trimmed = String(rawDateInput ?? '').trim();
  if (!trimmed) return '';

  const parsedDate = parseFlexibleTimestamp(trimmed);
  if (!parsedDate) return trimmed;

  return formatIsoParts(parsedDate);
}

/**
 * Formats an epoch timestamp (UTC seconds) or flexible date string into "YYYY-MM-DD HH:mm:ss".
 * Returns empty string for empty input and preserves unparseable raw text.
 */
export function formatBroadcastIsoTimestamp(startTimestamp, fallbackTime = '') {
  const numericEpoch = Number(startTimestamp);
  if (
    startTimestamp !== '' &&
    startTimestamp !== null &&
    startTimestamp !== undefined &&
    Number.isFinite(numericEpoch) &&
    numericEpoch > 0
  ) {
    return formatIsoParts(new Date(numericEpoch * 1000), { useUtc: true, includeSeconds: true });
  }

  const candidateRaw =
    typeof startTimestamp === 'string' && !(numericEpoch > 0) ? startTimestamp : fallbackTime;
  const trimmed = String(candidateRaw ?? '').trim();
  if (!trimmed) return '';

  const normalized = trimmed.replace(/\s*\|\s*/, ' ');
  const parsedDate = parseFlexibleTimestamp(normalized);
  if (!parsedDate) return trimmed;

  return formatIsoParts(parsedDate, { includeSeconds: true });
}

/**
 * Computes the outage aging bucket against an injectable reference clock.
 */
export function calculatePivotAging(rawDateInput, { referenceNowMs = Date.now() } = {}) {
  const parsedDate = parseFlexibleTimestamp(rawDateInput);
  if (!parsedDate) return '0 - 2 Hours';

  const diffHours = Math.max(0, (referenceNowMs - parsedDate.getTime()) / (1000 * 60 * 60));

  if (diffHours < 2) return '0 - 2 Hours';
  if (diffHours < 4) return '2 - 4 Hours';
  if (diffHours < 8) return '4 - 8 Hours';
  if (diffHours < 24) return '8 - 24 Hours';
  return '> 24 Hours';
}

