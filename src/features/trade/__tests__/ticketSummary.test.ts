import { Margin, Price, Qty, Usd } from "@liq/sdk";
import { describe, expect, it } from "vitest";

import { ticketSummary } from "../ticketSummary";

const MARK = Price.parse("2446.07");
const ONE = Qty.parse("1");
/** Поддерживающая доля 1% в WAD — как её отдаёт `maintenanceMarginBps` рынка. */
const MMF = 10n ** 16n;

describe("ticketSummary", () => {
  it("количество, объём и стоимость от стороны не зависят", () => {
    const s = ticketSummary({
      sizeQty: ONE,
      markPrice: MARK,
      leverage: 10,
      mmfWad: MMF,
    });
    expect(s.qty).toBe(ONE);
    expect(s.value).toBe(Usd.parse("2446.07"));
    expect(s.cost).toBe(Margin.parse("244.607"));
    expect(s.long.sizeDelta).toBe(ONE);
    expect(s.short.sizeDelta).toBe(-ONE);
  });

  it("ликвидация у лонга ниже марка, у шорта выше", () => {
    const s = ticketSummary({
      sizeQty: ONE,
      markPrice: MARK,
      leverage: 10,
      mmfWad: MMF,
    });
    expect(s.long.liqPrice).not.toBeNull();
    expect(s.short.liqPrice).not.toBeNull();
    expect(s.long.liqPrice!).toBeLessThan(MARK);
    expect(s.short.liqPrice!).toBeGreaterThan(MARK);
  });

  it("без поддерживающей доли уровня нет, но остальное считается", () => {
    const s = ticketSummary({
      sizeQty: ONE,
      markPrice: MARK,
      leverage: 10,
      mmfWad: undefined,
    });
    expect(s.long.liqPrice).toBeNull();
    expect(s.short.liqPrice).toBeNull();
    expect(s.value).toBe(Usd.parse("2446.07"));
  });

  it("пустой размер не выдумывает чисел", () => {
    const s = ticketSummary({
      sizeQty: Qty(0n),
      markPrice: MARK,
      leverage: 10,
      mmfWad: MMF,
    });
    expect(s.value).toBe(0n);
    expect(s.cost).toBe(0n);
    expect(s.long.liqPrice).toBeNull();
    expect(s.short.liqPrice).toBeNull();
  });

  it("стоимость, округлившаяся в ноль, уровня не получает", () => {
    // Марк в 0,001 USD: объём дробинки округляется в ноль, значит и маржа
    // нулевая. Без маржи уровня нет — иначе тикет назвал бы уровнем сам марк.
    const s = ticketSummary({
      sizeQty: Qty(1n),
      markPrice: Price.parse("0.001"),
      leverage: 10,
      mmfWad: MMF,
    });
    expect(s.cost).toBe(0n);
    expect(s.long.liqPrice).toBeNull();
    expect(s.short.liqPrice).toBeNull();
  });

  it("без марка объём не считается", () => {
    const s = ticketSummary({
      sizeQty: ONE,
      markPrice: Price(0n),
      leverage: 10,
      mmfWad: MMF,
    });
    expect(s.value).toBe(0n);
    expect(s.cost).toBe(0n);
  });
});
