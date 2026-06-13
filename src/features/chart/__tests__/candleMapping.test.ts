import { describe, expect, it } from "vitest";
import { toLwcBar } from "../candleMapping";

const WAD = 10n ** 18n;

describe("toLwcBar", () => {
  it("keeps timestamp in seconds and converts OHLC bigint -> number", () => {
    const bar = toLwcBar({
      timestamp: 1_700_000_000,
      open: 74000n * WAD,
      high: 74500n * WAD,
      low: 73800n * WAD,
      close: 74250n * WAD,
      volume: 0n,
      tradeCount: 3,
      lastTradePrice: null,
    });
    expect(bar).toEqual({
      time: 1_700_000_000,
      open: 74000,
      high: 74500,
      low: 73800,
      close: 74250,
    });
  });
});
