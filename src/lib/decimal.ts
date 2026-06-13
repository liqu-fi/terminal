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

/** USDC (the token a perps deposit spends) is a 6-decimal ERC-20. */
export const USDC_DECIMALS = 6;

/**
 * Scale a native 6-decimal USDC balance into the 18-decimal WAD domain the
 * money UI formats and compares in (`fmtUsd`, `wadToFixed`, `Margin.parse`).
 *
 * The deposit dialog must gate and cap on the wallet's **USDC** balance because
 * the deposit spends USDC — but everything else in the UI is 18-dec WAD, so we
 * lift USDC into that domain (×10^12) rather than special-casing 6-dec
 * formatting everywhere. The lift is exact (USDC has fewer decimals than WAD).
 */
export function usdcToWad(usdc6: bigint): bigint {
  return usdc6 * 10n ** BigInt(18 - USDC_DECIMALS);
}
