import { describe, expect, it } from "vitest";

import { shouldAdoptLevel } from "../shouldAdoptLevel";

describe("shouldAdoptLevel", () => {
  // Настоящая цена гварда. Листенер стора зовётся на КАЖДУЮ запись, а в Ф2 на
  // этот же стор садится весь тикет: без отказа первый же `setSide` вернул бы
  // вкладку Limit и затёр цену, введённую руками.
  it("цена не менялась — запись не наша", () => {
    expect(shouldAdoptLevel(69_990n, 69_990n)).toBe(false);
    expect(shouldAdoptLevel(null, null)).toBe(false);
    expect(shouldAdoptLevel(undefined, undefined)).toBe(false);
  });

  it("цена сменилась на настоящее значение — принимаем", () => {
    expect(shouldAdoptLevel(undefined, 69_990n)).toBe(true);
    expect(shouldAdoptLevel(null, 69_990n)).toBe(true);
    expect(shouldAdoptLevel(69_990n, 69_980n)).toBe(true);
  });

  // Так пишет `setOrderType`: `limitPrice: type === MARKET ? null : undefined`.
  it("цена сменилась в «нет значения» — не принимаем", () => {
    expect(shouldAdoptLevel(69_990n, undefined)).toBe(false);
    expect(shouldAdoptLevel(69_990n, null)).toBe(false);
  });

  // Ровно последовательность `pickLevel`: сперва `setOrderType(LIMIT)` гасит
  // цену, потом `setLimitPrice` ставит ту же самую. Повторный клик по уже
  // выбранному уровню обязан доехать до поля, даже если поле правили руками.
  it("повторный выбор того же уровня доезжает через промежуточный сброс", () => {
    expect(shouldAdoptLevel(69_990n, undefined)).toBe(false);
    expect(shouldAdoptLevel(undefined, 69_990n)).toBe(true);
  });
});
