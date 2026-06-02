import { Side } from "@liqcx/liq-sdk";

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
