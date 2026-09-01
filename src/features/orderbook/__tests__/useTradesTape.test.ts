import { describe, expect, it } from "vitest";

import { freshLiveRows, type TapeRow } from "../useTradesTape";

const row = (over: Partial<TapeRow>): TapeRow => ({
  key: "k",
  timestamp: 0,
  price: 1n,
  size: 1n,
  side: "BUY",
  txHash: null,
  ...over,
});

describe("freshLiveRows", () => {
  it("пропускает живую строку новее самой свежей REST-строки", () => {
    const live = [row({ key: "live", timestamp: 200 })];
    const rest = [row({ key: "rest", timestamp: 100 })];
    expect(freshLiveRows(live, rest)).toEqual(live);
  });

  // Мутация «снять фильтр по timestamp» — ни одна из живых e2e-сцен её не
  // ловит (там либо нет REST-строки, либо живое событие заведомо новее);
  // этот тест целится ровно в границу, юнитом, а не через таймингы SSE.
  it("отбрасывает живую строку старше самой свежей REST-строки", () => {
    const live = [row({ key: "live", timestamp: 50 })];
    const rest = [row({ key: "rest", timestamp: 100 })];
    expect(freshLiveRows(live, rest)).toEqual([]);
  });

  it("строгое >: тик с тем же timestamp, что и REST-строка, не проходит", () => {
    const live = [row({ key: "live", timestamp: 100 })];
    const rest = [row({ key: "rest", timestamp: 100 })];
    expect(freshLiveRows(live, rest)).toEqual([]);
  });

  it("пустая REST-страница не ставит границы — проходит любая живая строка", () => {
    const live = [row({ key: "live", timestamp: 0 })];
    expect(freshLiveRows(live, [])).toEqual(live);
  });

  it("фильтрует каждую строку по отдельности, а не всё-или-ничего", () => {
    const live = [
      row({ key: "new", timestamp: 200 }),
      row({ key: "old", timestamp: 50 }),
    ];
    const rest = [row({ key: "rest", timestamp: 100 })];
    expect(freshLiveRows(live, rest)).toEqual([live[0]]);
  });
});
