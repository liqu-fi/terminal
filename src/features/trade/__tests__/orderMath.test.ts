import { Side } from "@liq/sdk";
import { describe, expect, it } from "vitest";
import {
  acceptablePrice,
  computeSizeDelta,
  leverageToSize,
  marginCost,
  maxSizeQty,
  pctToSize,
  sizeToPct,
  sizeToUsd,
  usdToSize,
  validateOrder,
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

  it("maxSizeQty mirrors leverageToSize (buying-power ceiling)", () => {
    const args = {
      availableUsd: 5000n * WAD,
      leverage: 2,
      markPrice: 70000n * WAD,
    };
    expect(maxSizeQty(args)).toBe(leverageToSize(args));
  });

  it("pctToSize / sizeToPct round-trip and clamp to 0–100", () => {
    const max = 1000n * WAD;
    expect(pctToSize(50, max)).toBe(500n * WAD);
    expect(pctToSize(150, max)).toBe(max); // clamped to 100
    expect(pctToSize(-10, max)).toBe(0n); // clamped to 0
    expect(sizeToPct(250n * WAD, max)).toBe(25);
    expect(sizeToPct(0n, 0n)).toBe(0); // no buying power → 0, no div-by-zero
    expect(sizeToPct(2n * max, max)).toBe(100); // over-max clamps to 100
  });

  it("usdToSize / sizeToUsd convert through markPrice", () => {
    const mark = 70000n * WAD;
    // 35,000 USD / 70,000 = 0.5 base
    expect(usdToSize(35000n * WAD, mark)).toBe(5n * 10n ** 17n);
    // 0.5 base * 70,000 = 35,000 USD
    expect(sizeToUsd(5n * 10n ** 17n, mark)).toBe(35000n * WAD);
    expect(usdToSize(1000n * WAD, 0n)).toBe(0n); // no price → 0
  });

  it("marginCost = notional / leverage", () => {
    expect(marginCost(35000n * WAD, 2)).toBe(17500n * WAD);
    expect(marginCost(35000n * WAD, 0)).toBe(35000n * WAD); // guard: no div-by-zero
  });

  describe("validateOrder", () => {
    const base = {
      markPrice: 70000n * WAD,
      sizeQty: 5n * 10n ** 17n, // 0.5
      minSize: WAD / 1000n, // 0.001
      leverage: 2,
      maxLeverage: 25,
      available: 100000n * WAD,
      marginCost: 17500n * WAD,
    };

    it("accepts an affordable, in-bounds order", () => {
      expect(validateOrder(base)).toEqual({ ok: true });
    });
    it("blocks (no reason) when there is no mark price or no size", () => {
      expect(validateOrder({ ...base, markPrice: 0n })).toEqual({ ok: false });
      expect(validateOrder({ ...base, sizeQty: 0n })).toEqual({ ok: false });
    });
    it("blocks below the minimum size with a Min reason", () => {
      const r = validateOrder({ ...base, sizeQty: WAD / 2000n }); // 0.0005
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/^Min/);
    });
    it("blocks above max leverage with a Max reason", () => {
      const r = validateOrder({ ...base, leverage: 30 });
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("Max 25×");
    });
    it("warns (does not block) when the cost exceeds available margin", () => {
      const r = validateOrder({ ...base, available: 5000n * WAD });
      expect(r.ok).toBe(true);
      expect(r.warn).toBe("Exceeds available margin");
    });
  });
});
