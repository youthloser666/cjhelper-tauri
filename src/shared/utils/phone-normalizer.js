const PHONE_SPLIT_PATTERN = /[/,;]/;

/**
 * Cleans an Indonesian phone string into bare digits prefixed with country code 62.
 */
export function extractWhatsAppDigits(rawPhoneInput) {
  if (!rawPhoneInput) return '';

  const segments = String(rawPhoneInput)
    .split(PHONE_SPLIT_PATTERN)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    let digits = segment.replace(/[^0-9]/g, '');
    if (!digits) continue;

    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    }
    if (digits.startsWith('620')) {
      digits = `62${digits.slice(3)}`;
    } else if (digits.startsWith('0')) {
      digits = `62${digits.slice(1)}`;
    } else if (digits.startsWith('8')) {
      digits = `62${digits}`;
    }

    if (digits.length >= 8) {
      return digits;
    }
  }

  return '';
}

/**
 * Normalizes a raw phone number into a WhatsApp JID (`<digits>@s.whatsapp.net`)
 * or returns an empty string when no valid 8+ digit phone segment exists.
 */
export function normalizeWhatsAppNumber(rawPhoneInput) {
  const normalizedDigits = extractWhatsAppDigits(rawPhoneInput);
  if (!normalizedDigits) {
    return '';
  }
  return `${normalizedDigits}@s.whatsapp.net`;
}

