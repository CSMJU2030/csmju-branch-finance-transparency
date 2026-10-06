/**
 * Money is an integer number of satang everywhere (data-dictionary.md 5, rule
 * DD-05): the API sends and takes `amountSatang`, never a float. People type baht,
 * so this is the one place that converts - with integer arithmetic only, so
 * 0.1 + 0.2 baht can never become 0.30000000000000004.
 */

/** Largest amount one transaction can carry (the backend's INTEGER column). */
export const MAX_AMOUNT_SATANG = 2_000_000_000;

/**
 * "1,250.50" -> 125050. Accepts digits with optional thousands commas and at most
 * two decimals. Returns null for anything else (negative, letters, a third decimal,
 * empty, zero, above the limit) instead of guessing.
 */
export function parseBahtToSatang(input: string): number | null {
  const text = input.trim().replace(/,/g, "");
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;

  const baht = Number(match[1]);
  const satang = Number((match[2] ?? "").padEnd(2, "0") || "0");
  const total = baht * 100 + satang;
  return total >= 1 && total <= MAX_AMOUNT_SATANG ? total : null;
}

/** 125050 -> "1,250.50" (no currency sign). Works on negatives (a balance can be below zero). */
export function formatSatang(satang: number): string {
  const sign = satang < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(satang));
  const baht = Math.trunc(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}${baht.toLocaleString("en-US")}.${rest}`;
}

/** 125050 -> "฿1,250.50" */
export function formatBaht(satang: number): string {
  const text = formatSatang(satang);
  return text.startsWith("-") ? `-฿${text.slice(1)}` : `฿${text}`;
}
