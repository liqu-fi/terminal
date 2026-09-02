import { describe, expect, it } from "vitest";

import { changeFromBars } from "../useDailyChange";

const WAD = 10n ** 18n;
const bar = (close: bigint) => ({
  timestamp: 0,
  open: close,
  high: close,
  low: close,
  close,
  volume: null,
});

describe("changeFromBars", () => {
  it("считает процент и величину против первого бара окна", () => {
    expect(changeFromBars([bar(100n * WAD), bar(110n * WAD)])).toEqual({
      pct: 10,
      abs: 10n * WAD,
    });
  });

  it("падение приходит отрицательным", () => {
    expect(changeFromBars([bar(100n * WAD), bar(95n * WAD)])?.pct).toBeCloseTo(
      -5,
      6,
    );
  });

  it("одного бара мало — сравнивать не с чем", () => {
    expect(changeFromBars([bar(100n * WAD)])).toBeNull();
    expect(changeFromBars([])).toBeNull();
  });

  it("нулевое закрытие не делится", () => {
    // Ряд с нулём в основании — не «изменение на бесконечность», а отсутствие
    // основания для сравнения.
    expect(changeFromBars([bar(0n), bar(100n * WAD)])).toBeNull();
  });

  it("неизменившаяся цена даёт ноль, а не null", () => {
    expect(changeFromBars([bar(70_000n * WAD), bar(70_000n * WAD)])?.pct).toBe(
      0,
    );
  });
});
