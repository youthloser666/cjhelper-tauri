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

/**
 * Formats an input date string as "YYYY-MM-DD HH:mm".
 * Returns empty string for empty input and preserves unparseable raw text.
 */
export function formatPivotDate(rawDateInput) {
  const trimmed = String(rawDateInput ?? '').trim();
  if (!trimmed) return '';

  const parsedDate = parseFlexibleTimestamp(trimmed);
  if (!parsedDate) return trimmed;

  const year = parsedDate.getFullYear();
  const month = padTwoDigits(parsedDate.getMonth() + 1);
  const day = padTwoDigits(parsedDate.getDate());
  const hour = padTwoDigits(parsedDate.getHours());
  const minute = padTwoDigits(parsedDate.getMinutes());

  return `${year}-${month}-${day} ${hour}:${minute}`;
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

