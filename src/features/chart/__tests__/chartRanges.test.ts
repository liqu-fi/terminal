import { maxBarsPerRequest } from "@liq/core";
import { describe, expect, it } from "vitest";

import {
  barsForRange,
  CHART_RANGES,
  CHART_ROUTE,
  fitInterval,
} from "../chartRanges";

describe("chartRanges", () => {
  it("сутки часовыми барами — это 24 бара", () => {
    expect(barsForRange("1D", "1h")).toBe(24);
  });

  it("год минутными барами не влезает в маршрут", () => {
    // 525 600 баров против потолка: запрос отдал бы хвост окна и подписал бы
    // его «1Y» — это не год, это последние сутки под чужой подписью.
    expect(fitInterval("1Y", "1m")).not.toBe("1m");
  });

  it("поднятый интервал сам влезает", () => {
    const iv = fitInterval("1Y", "1m");
    expect(barsForRange("1Y", iv)).toBeLessThanOrEqual(
      maxBarsPerRequest(iv, CHART_ROUTE),
    );
  });

  it("интервал, который и так влезает, не поднимается", () => {
    expect(fitInterval("1D", "1h")).toBe("1h");
  });

  it("окна перечислены по возрастанию", () => {
    const values = Object.values(CHART_RANGES);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });
});
