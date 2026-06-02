import { formatUnits } from "viem";

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
