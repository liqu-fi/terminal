import type { MarketFullRow } from "@liq/api-client";
import { describe, expect, it } from "vitest";

import { bareRow, marketRow } from "../useMarketRows";

const WAD = 10n ** 18n;

const base: MarketFullRow = {
  id: 200n,
  symbol: "BTC",
  pythFeedId: "0x00",
  isActive: true,
  initialMarginBps: 200n,
  maintenanceMarginBps: 50n,
  dynamic: null,
};

const dynamicStub = {
  skew: 0n,
  size: 0n,
  maxFundingVelocity: 0n,
  skewScale: 0n,
  makerFee: 0n,
  takerFee: 0n,
  currentFundingRate: null,
  currentFundingVelocity: null,
  indexPrice: null,
  openInterest: null,
  maxOpenInterest: null,
  updatedAt: 0,
};

describe("marketRow", () => {
  it("выводит плечо из начальной маржи", () => {
    // 200 bps = 2 % начальной маржи = 50x. `maxLeverage` из `/markets` не
    // приходит вовсе, и дефолт на его месте выдавал бы выдумку за конфигурацию.
    expect(marketRow(base, false).maxLeverage).toBe(50);
  });

  it("нулевая начальная маржа не даёт плеча", () => {
    expect(
      marketRow({ ...base, initialMarginBps: 0n }, false).maxLeverage,
    ).toBeNull();
  });

  it("различает три состояния объёма", () => {
    expect(marketRow(base, false).volumeUsd).toBeNull();
    expect(marketRow({ ...base, volume24h: null }, false).volumeUsd).toBeNull();
    expect(
      marketRow(
        {
          ...base,
          volume24h: {
            volumeUsd: 5n * WAD,
            volumeBase: 0n,
            trades: 0,
            windowStart: 0,
            windowEnd: 0,
          },
        },
        false,
      ).volumeUsd,
    ).toBe(5n * WAD);
  });

  it("несёт признак избранного и открытый интерес", () => {
    const row = marketRow(
      { ...base, dynamic: { ...dynamicStub, openInterest: 7n * WAD } },
      true,
    );
    expect(row.favorite).toBe(true);
    expect(row.openInterest).toBe(7n * WAD);
  });

  it("нулевой открытый интерес — это ноль, а не незнание", () => {
    const row = marketRow(
      { ...base, dynamic: { ...dynamicStub, openInterest: 0n } },
      false,
    );
    expect(row.openInterest).toBe(0n);
  });

  it("необогащённый рынок не выдумывает ни плеча, ни объёма", () => {
    // `/markets` назвал рынок, `/markets/full` его ещё не отдал: он существует,
    // но всё, кроме имени, о нём неизвестно.
    expect(bareRow(201n, "ETH", false)).toEqual({
      id: 201n,
      symbol: "ETH",
      maxLeverage: null,
      openInterest: null,
      volumeUsd: null,
      favorite: false,
    });
  });
});
