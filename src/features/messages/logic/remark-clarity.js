export const REMARK_CLARITY_MODES = Object.freeze(['all', 'unclear', 'empty', 'clear']);

const EMPTY_REMARK_PLACEHOLDERS = new Set([
  '',
  '-',
  '—',
  '--',
  '---',
  '0',
  'null',
  'nan',
  'n/a',
  'na',
  'none',
  'nil',
  '?',
  '??',
  '???',
  '...',
  '.',
  ',',
  '/',
]);

const CONCRETE_ACTION_OR_CAUSE_PATTERN =
  /\b(team\s*on\s*site|onsite|on\s*site|progress\s*req(?:uest)?|spare\s*part|sparepart|cpri|faulty|sfp|pln|genset|pg|battery|batt|baterai|recti|rectifier|fo|fiber|optic|cut|putus|mcb|kwh|stolen|theft|curian|dicuri|hilang|bcch|module|bbu|rru|mw|microwave|antenna|feeder|vsat|power|listrik|padam|mati|off|down|rusak|short|trip|overheat|alarm|permit|akses|kunci|gembok|banjir|hujan|petir|pohon|roboh|reset|reboot|restart|ganti|replace|sambung|splicing|tarik|repair|perbaikan|kirim|bawa|refuel|bbm|solar|backup|sudah\s+up|nyala)\b/i;

const CONCRETE_TICKET_OR_ELECTRICAL_PATTERN =
  /(?:\b\d+\s*(?:v|a|kva|kw)\b|\b(?:tt|inc|wo|sr)[-\s#:]*\d+|#[a-z0-9_-]{4,})/i;

const UNCLEAR_REMARK_PATTERN =
  /\b(follow\s*up(?:\s*team)?|followup(?:\s*team)?|fu(?:\s*team|\s*te)?|f\/u|team\s*otw|otw|eta|on\s*the\s*way|priority|cek|check|checking|recheck|monitor|monitoring|mon|pantau|koordinasi|coord|kordinasi|pending|wait|waiting|tunggu|menunggu|investigate|investigasi|analisa|analysis|tanya|konfirmasi|confirm|belum\s*(?:jelas|tau|tahu|ada|info|update)|blm\s*(?:jelas|tau|tahu|ada|info|update)|no\s*(?:info|update|respon|response)|tbd|wip|open|progress|in\s*progress|masih\s*dicek|proses\s*cek|hold)\b/i;

/**
 * Classifies an outage remark string for NOC triage into `'empty'` (No Remark),
 * `'unclear'` (Needs Follow-Up), or `'clear'` (Actionable).
 */
export function classifyRemarkClarity(rawRemark) {
  const trimmed = String(rawRemark ?? '').trim();
  const lower = trimmed.toLowerCase();

  if (EMPTY_REMARK_PLACEHOLDERS.has(lower)) {
    return 'empty';
  }

  if (
    CONCRETE_ACTION_OR_CAUSE_PATTERN.test(trimmed) ||
    CONCRETE_TICKET_OR_ELECTRICAL_PATTERN.test(trimmed)
  ) {
    return 'clear';
  }

  if (UNCLEAR_REMARK_PATTERN.test(trimmed)) {
    return 'unclear';
  }

  // Punctuation-only or 1-2 character noise tokens are ambiguous in operational logs
  const alnum = trimmed.replace(/[^a-z0-9]/gi, '');
  if (alnum.length <= 2) {
    return 'unclear';
  }

  return 'clear';
}

/**
 * Evaluates whether a remark matches the selected Smart Filter pill.
 */
export function matchesRemarkClarityFilter(rawRemark, filterMode = 'all') {
  const mode = String(filterMode || 'all').toLowerCase();
  if (mode === 'all' || !mode) return true;

  const clarity = classifyRemarkClarity(rawRemark);
  if (mode === 'empty') return clarity === 'empty';
  if (mode === 'unclear') return clarity === 'empty' || clarity === 'unclear';
  if (mode === 'clear') return clarity === 'clear';
  return true;
}

