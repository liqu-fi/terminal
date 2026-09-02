import { describe, expect, it } from "vitest";

import { marketFilterFn } from "../features";

describe("фильтр по рынку", () => {
  it("пропускает всё, пока рынок не назван", () => {
    // Значение фильтра приходит из radix-меню, где «все рынки» — это отсутствие
    // выбора. Пустая строка и undefined обязаны значить одно и то же, иначе
    // сброс фильтра оставлял бы таблицу пустой.
    expect(marketFilterFn("200", undefined)).toBe(true);
    expect(marketFilterFn("200", "")).toBe(true);
    expect(marketFilterFn("200", ALL)).toBe(true);
  });

  it("сравнивает идентификаторы как строки, а не как числа", () => {
    // marketId доезжает и bigint-ом (позиции), и строкой (ордера). Строгое
    // равенство разных типов молча отфильтровало бы всё.
    expect(marketFilterFn("200", "200")).toBe(true);
    expect(marketFilterFn("201", "200")).toBe(false);
  });
});

const ALL = "all";
