import { Side } from "@liqcx/liq-sdk";
import { describe, expect, it } from "vitest";
import {
  acceptablePrice,
  computeSizeDelta,
  leverageToSize,
} from "../orderMath";

const WAD = 10n ** 18n;

describe("orderMath", () => {
  it("computeSizeDelta is positive for BUY, negative for SELL", () => {
    expect(computeSizeDelta(2n * WAD, Side.BUY)).toBe(2n * WAD);
    expect(computeSizeDelta(2n * WAD, Side.SELL)).toBe(-2n * WAD);
  });
  it("acceptablePrice adds slippage for BUY, subtracts for SELL", () => {
    // 0.5% of 74000 = 370
    expect(acceptablePrice(74000n * WAD, Side.BUY, 50n)).toBe(74370n * WAD);
    expect(acceptablePrice(74000n * WAD, Side.SELL, 50n)).toBe(73630n * WAD);
  });
  it("leverageToSize = available * leverage / markPrice (18-dec)", () => {
    // 1000 USD * 5x / 74000 = 0.0675675…  -> floor
    expect(
      leverageToSize({
        availableUsd: 1000n * WAD,
        leverage: 5,
        markPrice: 74000n * WAD,
      }),
    ).toBe(67567567567567567n);
  });
  it("leverageToSize is 0 when markPrice is 0 (avoids div-by-zero)", () => {
    expect(
      leverageToSize({ availableUsd: 1000n * WAD, leverage: 5, markPrice: 0n }),
    ).toBe(0n);
  });
});
