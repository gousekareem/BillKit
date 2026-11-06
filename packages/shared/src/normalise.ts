/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * Normalisation helpers used identically by the pipeline, the API and the
 * evaluation harness, so that "correct" means the same thing everywhere.
 */

/* ------------------------------------------------------------------ */
/* Amounts                                                             */
/* ------------------------------------------------------------------ */

export interface ParsedAmount {
  value: number;
  raw: string;
  negative: boolean;
}

/** Common OCR confusions inside numeric tokens only (never applied to words). */
function repairNumericToken(token: string): string {
  return token
    .replace(/[Oo]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/S(?=\d)/g, '5')
    .replace(/B(?=\d)/g, '8');
}

/**
 * Parse a monetary amount from a short string such as "₹1,25,000.00", "Rs. 450/-",
 * "1.234,56", "(12.00)" or "12.00-". Returns null when the string is not an amount.
 */
export function parseAmount(input: string): ParsedAmount | null {
  if (!input) return null;
  let s = input.trim();
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s
    .replace(/(?:₹|rs\.?|inr|usd|eur|gbp|aed|sgd|\$|€|£|¥)/gi, '')
    .replace(/\/-$/, '')
    .trim();
  if (/^-/.test(s) || /-$/.test(s) || /\bcr\b/i.test(s)) negative = true;
  s = s.replace(/^-|-$/g, '').replace(/\bcr\b/i, '').trim();
  s = s.replace(/\s+/g, '');
  if (!/^[0-9OoIl|SB.,]+$/.test(s)) return null;
  if (!/\d/.test(s)) return null;
  s = repairNumericToken(s);
  if (!/^[0-9.,]+$/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalised: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // Whichever separator comes last is the decimal separator.
    normalised = lastDot > lastComma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    const commaCount = (s.match(/,/g) ?? []).length;
    // "12,50" → 12.50 ; "1,250" / "1,25,000" → grouping
    normalised = commaCount === 1 && decimals === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const dotCount = (s.match(/\./g) ?? []).length;
    const decimals = s.length - lastDot - 1;
    // "1.234.567" → grouping ; "1.234" with exactly 3 decimals is ambiguous: keep as decimal (receipts rarely use dot grouping in INR/USD)
    normalised = dotCount > 1 && decimals === 3 ? s.replace(/\./g, '') : s;
    if (dotCount > 1 && decimals !== 3) {
      // e.g. "1.250.00" (OCR double dot) → keep last as decimal
      const head = s.slice(0, lastDot).replace(/\./g, '');
      normalised = `${head}.${s.slice(lastDot + 1)}`;
    }
  } else {
    normalised = s;
  }
  if (!/^\d+(\.\d+)?$/.test(normalised)) return null;
  const value = Number.parseFloat(normalised);
  if (!Number.isFinite(value)) return null;
  return { value: negative ? -value : value, raw: input.trim(), negative };
}

/** Round to 2 decimals using a numerically stable approach. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function amountsEqual(a: number | null | undefined, b: number | null | undefined, tolerance = 0.01): boolean {
  if (a == null || b == null) return false;
  return Math.abs(round2(a) - round2(b)) <= tolerance + 1e-9;
}

/** Regex that finds money-like tokens inside a line. */
export const MONEY_TOKEN_RE =
  /(?:₹|rs\.?\s?|inr\s?|\$|€|£)?\s?\(?-?(?:\d{1,3}(?:[,]\d{2,3})+|\d+)(?:[.,]\d{1,2})?\)?(?:\/-|-)?(?![\d%])/gi;

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export type DateOrder = 'DMY' | 'MDY';

export interface DateCandidate {
  iso: string;
  raw: string;
  ambiguous: boolean;
  format: string;
  index: number;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

function expandYear(y: number): number {
  if (y >= 100) return y;
  return y <= 69 ? 2000 + y : 1900 + y;
}

export function isValidDateParts(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function toIsoDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const MONTH_NAMES = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

/**
 * Find every date-like substring in text. Numeric dates where both day and month
 * are ≤ 12 (and differ) are flagged ambiguous and interpreted with `order`.
 */
export function findDateCandidates(input: string, order: DateOrder = 'DMY'): DateCandidate[] {
  // OCR often reads the "O" of "Oct" as zero and "l" in "Jul" as "1"; repair only inside date-like contexts.
  const text = input.replace(/(\d[-/ .]?)0(ct)\b/gi, '$1O$2').replace(/\b(ju)1\b/gi, '$1l');
  const out: DateCandidate[] = [];
  const seen = new Set<number>();
  const push = (c: DateCandidate) => {
    if (seen.has(c.index)) return;
    seen.add(c.index);
    out.push(c);
  };

  // 1. ISO-like yyyy-mm-dd / yyyy/mm/dd / yyyy.mm.dd
  for (const m of text.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (isValidDateParts(y, mo, d)) push({ iso: toIsoDate(y, mo, d), raw: m[0], ambiguous: false, format: 'YMD', index: m.index });
  }
  // 2. dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy (or mm/dd/yyyy)
  for (const m of text.matchAll(/\b(\d{1,2})\s?[-/.]\s?(\d{1,2})\s?[-/.]\s?(\d{4}|\d{2})\b/g)) {
    if (seen.has(m.index)) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = expandYear(Number(m[3]));
    const dmyValid = isValidDateParts(y, b, a);
    const mdyValid = isValidDateParts(y, a, b);
    if (!dmyValid && !mdyValid) continue;
    let iso: string;
    let ambiguous = false;
    let format: string;
    if (dmyValid && mdyValid && a !== b) {
      ambiguous = true;
      format = order;
      iso = order === 'DMY' ? toIsoDate(y, b, a) : toIsoDate(y, a, b);
    } else if (dmyValid) {
      format = 'DMY';
      iso = toIsoDate(y, b, a);
    } else {
      format = 'MDY';
      iso = toIsoDate(y, a, b);
    }
    push({ iso, raw: m[0], ambiguous, format, index: m.index });
  }
  // 3. 05 Jan 2026 / 5-JAN-26 / 05JAN2026
  const dMonY = new RegExp(`\\b(\\d{1,2})\\s?[-/ ,.]?\\s?(${MONTH_NAMES})[a-z]*\\.?\\s?[-/ ,.]?\\s?'?(\\d{4}|\\d{2})\\b`, 'gi');
  for (const m of text.matchAll(dMonY)) {
    const d = Number(m[1]);
    const mo = MONTHS[(m[2] ?? '').toLowerCase().slice(0, 3)] ?? MONTHS[(m[2] ?? '').toLowerCase()];
    const y = expandYear(Number(m[3]));
    if (mo && isValidDateParts(y, mo, d)) push({ iso: toIsoDate(y, mo, d), raw: m[0], ambiguous: false, format: 'D Mon Y', index: m.index });
  }
  // 4. Jan 05, 2026 / January 5 2026
  const monDY = new RegExp(`\\b(${MONTH_NAMES})[a-z]*\\.?\\s(\\d{1,2})(?:st|nd|rd|th)?,?\\s(\\d{4})\\b`, 'gi');
  for (const m of text.matchAll(monDY)) {
    const mo = MONTHS[(m[1] ?? '').toLowerCase().slice(0, 3)];
    const d = Number(m[2]);
    const y = Number(m[3]);
    if (mo && isValidDateParts(y, mo, d)) push({ iso: toIsoDate(y, mo, d), raw: m[0], ambiguous: false, format: 'Mon D Y', index: m.index });
  }
  return out.sort((x, y) => x.index - y.index);
}

/** Normalise a free-form date string (used by evaluation ground truth). */
export function normaliseDate(input: string | null | undefined, order: DateOrder = 'DMY'): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return findDateCandidates(trimmed, order)[0]?.iso ?? null;
}

export const TIME_RE = /\b([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.]([0-5]\d))?\s?([AaPp]\.?[Mm]\.?)?/;

export function parseTime(text: string): string | null {
  const m = TIME_RE.exec(text);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2];
  const ampm = m[4]?.toLowerCase().replace(/\./g, '');
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

/* ------------------------------------------------------------------ */
/* Merchant names                                                      */
/* ------------------------------------------------------------------ */

const LEGAL_SUFFIXES = /\b(private limited|pvt\.? ltd\.?|pvt|ltd\.?|limited|llp|inc\.?|co\.?|corp\.?|company|the)\b/g;

/** Canonical form for comparing merchant names (case/punctuation/legal-suffix insensitive). */
export function normaliseMerchant(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9ऀ-෿ ]+/g, ' ')
    .replace(LEGAL_SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein distance (iterative, O(n·m) time, O(m) memory). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/** Similarity in [0,1] based on normalised edit distance. */
export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length);
}

/**
 * Merchant comparison rule used by evaluation: normalised exact match, or one contains
 * the other (≥ 4 chars), or similarity ≥ 0.85 (tolerates 1–2 OCR character errors).
 */
export function merchantsMatch(expected: string | null | undefined, actual: string | null | undefined): boolean {
  const e = normaliseMerchant(expected);
  const a = normaliseMerchant(actual);
  if (!e || !a) return false;
  if (e === a) return true;
  if (e.length >= 4 && a.length >= 4 && (e.includes(a) || a.includes(e))) return true;
  return stringSimilarity(e, a) >= 0.85;
}

/* ------------------------------------------------------------------ */
/* Currencies                                                          */
/* ------------------------------------------------------------------ */

export const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'SAR', 'MYR', 'LKR', 'NPR', 'BDT', 'IDR', 'CHF', 'CNY'] as const;

const CURRENCY_PATTERNS: Array<[RegExp, string, boolean?]> = [
  [/₹|\brs\.?\s?\d|\brs\.(?![a-z])|\(rs\.?\)|\binr\b|\brupees?\b/i, 'INR'],
  [/\bgstin?\b|\bc\.?gst\b|\bs\.?gst\b|\bigst\b/i, 'INR', true],
  [/\busd\b|\bus\$/i, 'USD'],
  [/€|\beur\b/i, 'EUR'],
  [/£|\bgbp\b/i, 'GBP'],
  [/\baed\b|\bdhs?\b/i, 'AED'],
  [/\bsgd\b|\bs\$/i, 'SGD'],
  [/\baud\b|\ba\$/i, 'AUD'],
  [/\bcad\b|\bc\$/i, 'CAD'],
  [/\bsar\b|\briyals?\b/i, 'SAR'],
  [/\brm\s?\d|\bmyr\b/i, 'MYR'],
  [/\blkr\b/i, 'LKR'],
  [/\brp\.?\s?\d|\bidr\b/i, 'IDR'],
  [/¥|\bjpy\b|\byen\b/i, 'JPY'],
  [/\$/, 'USD'],
];

export interface CurrencyDetection {
  code: string;
  evidence: string;
  /** True when no symbol/code is printed and the currency is implied (e.g. by Indian GST terms). */
  inferred: boolean;
}

/** Detect the currency from explicit symbols/codes in the text. Returns null rather than guessing. */
export function detectCurrency(text: string): CurrencyDetection | null {
  let implied: CurrencyDetection | null = null;
  for (const [re, code, inferred] of CURRENCY_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    if (inferred) implied ??= { code, evidence: m[0], inferred: true };
    else return { code, evidence: m[0], inferred: false };
  }
  return implied;
}

export function formatMoney(value: number | null | undefined, currency = 'INR', locale = 'en-IN'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatIsoDate(iso: string | null | undefined, format: 'DMY' | 'MDY' | 'YMD' = 'DMY'): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—';
  const [y, m, d] = iso.split('-');
  if (format === 'YMD') return iso;
  if (format === 'MDY') return `${m}/${d}/${y}`;
  return `${d}/${m}/${y}`;
}
