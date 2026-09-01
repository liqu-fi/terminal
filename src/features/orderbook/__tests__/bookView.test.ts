import { Price, Qty } from "@liq/sdk";
import { describe, expect, it } from "vitest";

import {
  askSlots,
  barPct,
  baseSymbolOf,
  bidSlots,
  fmtBookPrice,
  fmtBookSize,
  fmtBookTotal,
  padSlots,
  ratioPct,
} from "../bookView";

const row = (price: string, size: string, total: string) => ({
  price: Price.parse(price),
  size: Qty.parse(size),
  total: Qty.parse(total),
});

describe("padSlots", () => {
  it("добивает хвост пустыми слотами", () => {
    const out = padSlots([row("100", "1", "1")], 3, "end");
    expect(out.map((s) => s === null)).toEqual([false, true, true]);
  });

  it("добивает голову пустыми слотами", () => {
    const out = padSlots([row("100", "1", "1")], 3, "start");
    expect(out.map((s) => s === null)).toEqual([true, true, false]);
  });

  it("лишние строки отбрасывает, а не сжимает сетку", () => {
    const rows = [
      row("103", "1", "1"),
      row("102", "1", "2"),
      row("101", "1", "3"),
    ];
    expect(padSlots(rows, 2, "end")).toHaveLength(2);
  });
});

describe("askSlots", () => {
  it("лучший аск стоит последним — вплотную к спреду", () => {
    const asks = [row("101", "1", "1"), row("102", "1", "2")];
    const out = askSlots(asks, 3);
    expect(out).toHaveLength(3);
    expect(out[0]).toBeNull();
    expect(out[2]?.price).toBe(Price.parse("101"));
    expect(out[1]?.price).toBe(Price.parse("102"));
  });
});

describe("bidSlots", () => {
  it("лучший бид стоит первым, пустые слоты — снизу", () => {
    const bids = [row("100", "1", "1"), row("99", "1", "2")];
    const out = bidSlots(bids, 3);
    expect(out[0]?.price).toBe(Price.parse("100"));
    expect(out[2]).toBeNull();
  });
});

describe("fmtBookPrice", () => {
  it("печатает ровно столько знаков, сколько различает шаг", () => {
    expect(fmtBookPrice(Price.parse("2445.16"), Price.parse("0.01"))).toBe(
      "2,445.16",
    );
    expect(fmtBookPrice(Price.parse("2445.16"), Price.parse("1"))).toBe(
      "2,445",
    );
  });

  it("шаг в десять знаков не рисует разрядов, которых в группе нет", () => {
    expect(fmtBookPrice(Price.parse("2450"), Price.parse("10"))).toBe("2,450");
  });
});

describe("fmtBookSize", () => {
  it("мелкий объём показывает пятью знаками", () => {
    expect(fmtBookSize(Qty.parse("0.12345"))).toBe("0.12345");
  });

  // SDK-формат усекает дробную часть, а не округляет (см. TSDoc fmtBookSize) —
  // поэтому 12.3456 обрезается до 12.34, а не округляется до 12.35.
  it("крупный объём — двумя, усечением, а не округлением", () => {
    expect(fmtBookSize(Qty.parse("12.3456"))).toBe("12.34");
  });
});

describe("fmtBookTotal", () => {
  it("выше порога сжимает суффиксом", () => {
    expect(fmtBookTotal(Qty.parse("12500"))).toBe("12.5K");
  });

  it("ниже порога печатает как есть", () => {
    expect(fmtBookTotal(Qty.parse("999"))).toBe("999");
  });
});

describe("barPct", () => {
  it("доля кумулятива от максимума показанного", () => {
    expect(barPct(Qty.parse("5"), Qty.parse("20"))).toBe(25);
  });

  it("нулевой максимум не делит на ноль", () => {
    expect(barPct(Qty.parse("5"), Qty.parse("0"))).toBe(0);
  });

  it("больше ста процентов не бывает", () => {
    expect(barPct(Qty.parse("30"), Qty.parse("20"))).toBe(100);
  });
});

describe("ratioPct", () => {
  it("переводит WAD-долю в проценты", () => {
    expect(ratioPct(10n ** 18n / 4n)).toBe(25);
  });

  it("неизвестная доля — половина, а не ноль", () => {
    // `null` приходит на пустой книге: сторон нет, перевеса нет.
    expect(ratioPct(null)).toBe(50);
  });
});

describe("baseSymbolOf", () => {
  it("берёт базовый актив из символа рынка", () => {
    expect(baseSymbolOf("ETH-PERP")).toBe("ETH");
    expect(baseSymbolOf("btc/usd")).toBe("BTC");
  });

  it("без рынка возвращает пустую строку, а не выдуманный тикер", () => {
    expect(baseSymbolOf(undefined)).toBe("");
  });
});
