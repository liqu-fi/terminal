import { Price, Qty, Side, Usd } from "@liq/sdk";

const WAD = 10n ** 18n;

/** Signed size delta: positive long (BUY), negative short (SELL). */
export function computeSizeDelta(sizeMagnitude: bigint, side: Side): bigint {
  return side === Side.BUY ? sizeMagnitude : -sizeMagnitude;
}

/** Market slippage guard: markPrice ± (markPrice * slippageBps / 10000). */
export function acceptablePrice(
  markPrice: bigint,
  side: Side,
  slippageBps: bigint,
): bigint {
  const delta = (markPrice * slippageBps) / 10_000n;
  return side === Side.BUY ? markPrice + delta : markPrice - delta;
}

/** Size (18-dec) implied by spending `availableUsd` at `leverage` against `markPrice`. */
export function leverageToSize(input: {
  availableUsd: bigint;
  leverage: number;
  markPrice: bigint;
}): bigint {
  if (input.markPrice === 0n) return 0n;
  return (input.availableUsd * BigInt(input.leverage) * WAD) / input.markPrice;
}

/**
 * Buying-power ceiling in base units: the largest position size openable with
 * `availableUsd` of margin at `leverage` against `markPrice`. Alias of
 * {@link leverageToSize} with the trading-domain name used by the size picker.
 */
export function maxSizeQty(input: {
  availableUsd: bigint;
  leverage: number;
  markPrice: bigint;
}): bigint {
  return leverageToSize(input);
}

/** Base size for a percentage (0–100) of the buying-power ceiling. */
export function pctToSize(pct: number, maxSize: bigint): bigint {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (maxSize * BigInt(clamped)) / 100n;
}

/** Percentage (0–100) of the buying-power ceiling that `size` represents,
 * rounded to the nearest whole percent (so a size truncated to the min-size
 * step still reads back as the percent that produced it). */
export function sizeToPct(size: bigint, maxSize: bigint): number {
  if (maxSize <= 0n) return 0;
  const basisPoints = Number((size * 10_000n) / maxSize); // 0.01% resolution
  return Math.max(0, Math.min(100, Math.round(basisPoints / 100)));
}

/** USD notional → base size at `markPrice` (`Usd / Price → Qty`). */
export function usdToSize(usdWad: bigint, markPrice: bigint): bigint {
  if (markPrice === 0n) return 0n;
  return Price.div(Usd(usdWad), Price(markPrice));
}

/** Base size → USD notional at `markPrice` (`Price × Qty → Usd`). */
export function sizeToUsd(sizeWad: bigint, markPrice: bigint): bigint {
  return Price.mul(Price(markPrice), Qty(sizeWad));
}

/** Margin required to back `notional` at `leverage` (the position's cost). */
export function marginCost(notionalWad: bigint, leverage: number): bigint {
  if (leverage <= 0) return notionalWad;
  return notionalWad / BigInt(leverage);
}

export type OrderValidation = { ok: boolean; reason?: string; warn?: string };

/**
 * Gate an order. Hard failures (`ok:false`) block submit; for the *actionable*
 * ones a short reason labels the button (`Min 0.001`, `Max 25×`). "Not ready"
 * states — no mark price, empty size — return `ok:false` with no reason (the
 * button keeps its default label, disabled).
 *
 * Affordability is a **soft** `warn`, not a block: the client cannot
 * authoritatively reproduce Synthetix's initial-margin requirement (IMF, skew,
 * existing cross-margin positions), so a simple `notional / leverage` estimate
 * exceeding `available` is surfaced as a warning while the gateway/chain remain
 * the authority on acceptance.
 */
export function validateOrder(input: {
  markPrice: bigint;
  sizeQty: bigint; // magnitude (>= 0)
  minSize: bigint;
  leverage: number;
  maxLeverage: number;
  available: bigint;
  marginCost: bigint;
}): OrderValidation {
  if (input.markPrice <= 0n) return { ok: false };
  if (input.sizeQty <= 0n) return { ok: false };
  if (input.minSize > 0n && input.sizeQty < input.minSize) {
    return { ok: false, reason: `Min ${Qty.fmt(Qty(input.minSize))}` };
  }
  if (input.leverage > input.maxLeverage) {
    return { ok: false, reason: `Max ${input.maxLeverage}×` };
  }
  if (input.available > 0n && input.marginCost > input.available) {
    return { ok: true, warn: "Exceeds available margin" };
  }
  return { ok: true };
}
