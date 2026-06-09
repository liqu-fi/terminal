/**
 * Sanitize a raw input string into a well-formed non-negative decimal: digits
 * and at most one dot, with the fraction capped at `maxDecimals`. Anything else
 * (letters, signs, scientific notation, extra dots) is stripped. An empty/blank
 * field stays empty so "no amount entered" remains distinguishable from "0".
 */
export function sanitizeDecimal(raw: string, maxDecimals: number): string {
  let s = raw.replace(/[^\d.]/g, ""); // keep digits + dots only (drops sign, e, etc.)
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    // collapse any dots after the first into nothing ("1.2.3" → "1.23")
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    const [int, frac = ""] = s.split(".");
    s = maxDecimals <= 0 ? int : `${int}.${frac.slice(0, maxDecimals)}`;
  }
  return s;
}
