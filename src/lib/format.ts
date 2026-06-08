import { formatUnits } from "viem";

/**
 * Parse a gateway numeric string into a bigint, tolerating the **scientific
 * notation** the order-gateway emits for large values.
 *
 * The gateway round-trips 18-dec WAD fields through a JS `number`, so any
 * `limitPrice` / `triggerPrice` ≥ 1e21 (a price ≥ \$1000 in 18 decimals) comes
 * back as e.g. `"1e+21"` instead of a plain integer string. Plain `BigInt()`
 * throws on that (`Cannot convert 1e+21 to a BigInt`) — and an uncaught throw
 * in a render (e.g. the open-orders table) blanks the subtree. This is the
 * display layer's safety net: it must NEVER throw. The gateway should also be
 * fixed to send plain integer strings; until then this keeps the UI alive.
 */
export function parseWadLoose(value: string): bigint {
  if (/^-?\d+$/.test(value)) return BigInt(value); // already a plain integer
  // mantissa (with optional fraction) + exponent, e.g. "-1.5e+21".
  const m = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(value);
  if (m) {
    const [, sign, intPart, frac = "", expPart] = m;
    const shift = Number(expPart) - frac.length;
    const digits = intPart + frac;
    if (shift >= 0) return BigInt(sign + digits + "0".repeat(shift));
    // Negative net exponent → a fractional WAD; truncate toward zero (display).
    const kept = digits.slice(0, digits.length + shift);
    return BigInt(sign + (kept || "0"));
  }
  // Anything else: stay alive with a lossy fallback rather than throw.
  const n = Number(value);
  return Number.isFinite(n) ? BigInt(Math.trunc(n)) : 0n;
}

/** 18-decimal WAD bigint -> JS number (lossy; display only). */
export function toNum(wad: bigint): number {
  return Number(formatUnits(wad, 18));
}

export function fmtUsd(v: bigint): string {
  return `$${toNum(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtSignedUsd(v: bigint): string {
  const sign = v < 0n ? "-" : "+";
  return `${sign}$${Math.abs(toNum(v)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPrice(v: bigint): string {
  return toNum(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function fmtQty(v: bigint): string {
  // trim trailing zeros from the 18-dec decimal string
  return formatUnits(v, 18).replace(/\.?0+$/, "") || "0";
}

/** Bps is RAW (100 = 1%), not 18-decimal. */
export function fmtPctFromBps(bps: bigint): string {
  return `${(Number(bps) / 100).toFixed(2)}%`;
}
