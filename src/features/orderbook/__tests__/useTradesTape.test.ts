import type { TradeEventData } from "@liq/sdk";
import { describe, expect, it } from "vitest";

import { freshLiveRows, fromLiveEvent, type TapeRow } from "../useTradesTape";

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

  // Гейтвей сортирует страницу «новые первыми», но здесь это допущение не
  // делается: границей стоит максимум по странице. С `restRows[0]` страница,
  // отсортированная иначе, дала бы заниженную границу и пустила бы в ленту
  // устаревший тик.
  it("границу берёт максимум по странице, а не её первую строку", () => {
    const live = [row({ key: "live", timestamp: 150 })];
    const rest = [
      row({ key: "old", timestamp: 100 }),
      row({ key: "new", timestamp: 200 }),
    ];
    expect(freshLiveRows(live, rest)).toEqual([]);
  });
});

const liveEvent = (over: Partial<TradeEventData> = {}): TradeEventData => ({
  marketId: "200",
  price: "70000000000000000000000",
  size: "1000000000000000000",
  side: "BUY",
  timestamp: 1_717_200_000_000,
  ...over,
});

describe("fromLiveEvent", () => {
  // Два филла одного матча приходят с общим timestamp и общей ценой (ценой
  // лимитки мейкера), различающего поля в событии нет — ключ, выведенный из
  // полезной нагрузки, схлопнул бы их в один, и React потерял бы строку.
  it("одинаковые события получают разные ключи", () => {
    const a = fromLiveEvent(liveEvent(), 0);
    const b = fromLiveEvent(liveEvent(), 1);
    expect(a?.key).not.toBe(b?.key);
  });

  it("сторона события переносится как есть", () => {
    expect(fromLiveEvent(liveEvent({ side: "SELL" }), 0)?.side).toBe("SELL");
    expect(fromLiveEvent(liveEvent({ side: "BUY" }), 0)?.side).toBe("BUY");
  });

  // `side` на проводе — голая строка, гарантии двух литералов нет. Зелёная
  // строка — утверждение о рынке, поэтому нераспознанное не показывается
  // вовсе: та же сделка придёт следующей страницей REST уже типизированной.
  it("нераспознанная сторона не становится строкой ленты", () => {
    expect(fromLiveEvent(liveEvent({ side: "UNKNOWN" }), 0)).toBeNull();
    expect(fromLiveEvent(liveEvent({ side: "" }), 0)).toBeNull();
    expect(fromLiveEvent(liveEvent({ side: "buy" }), 0)).toBeNull();
  });
});
