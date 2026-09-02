import { describe, expect, it } from "vitest";

import { summarize } from "../useAccountSummary";

const WAD = 10n ** 18n;

describe("свод счёта", () => {
  it("плечо — это экспозиция к стоимости счёта", () => {
    const s = summarize({
      available: 1000n * WAD,
      locked: 0n,
      debt: 0n,
      positions: [{ unrealizedPnl: 0n, notional: 2000n * WAD }],
    });
    expect(s.leverage).toBe(2n * WAD);
  });

  it("не делит на ноль: пустой счёт не имеет плеча", () => {
    // Ноль здесь читался бы как «плеча нет», что для счёта без залога неверно:
    // плеча не «нет», его нечем измерить.
    const s = summarize({
      available: 0n,
      locked: 0n,
      debt: 0n,
      positions: [{ unrealizedPnl: 0n, notional: 5n * WAD }],
    });
    expect(s.leverage).toBeUndefined();
  });

  it("equity вычитает офчейн-лок, а не долг", () => {
    const s = summarize({
      available: 1000n * WAD,
      locked: 40n * WAD,
      debt: 7n * WAD,
      positions: [],
    });
    expect(s.accountValue).toBe(1000n * WAD);
    expect(s.equity).toBe(960n * WAD);
    expect(s.borrowed).toBe(7n * WAD);
  });

  it("складывает PnL и ноционал по всем позициям", () => {
    const s = summarize({
      available: 1000n * WAD,
      locked: 0n,
      debt: 0n,
      positions: [
        { unrealizedPnl: 5n * WAD, notional: 100n * WAD },
        { unrealizedPnl: -2n * WAD, notional: 300n * WAD },
      ],
    });
    expect(s.unrealizedPnl).toBe(3n * WAD);
    expect(s.exposure).toBe(400n * WAD);
  });

  it("неизвестный залог — неизвестны и стоимость, и equity, и плечо", () => {
    // `undefined` доезжает сюда, когда чтение маржи ещё в полёте или упало.
    // Ноль в этих трёх строках выглядел бы как обнулившийся счёт.
    const s = summarize({
      available: undefined,
      locked: 0n,
      debt: 0n,
      positions: [{ unrealizedPnl: 0n, notional: 100n * WAD }],
    });
    expect(s.accountValue).toBeUndefined();
    expect(s.equity).toBeUndefined();
    expect(s.leverage).toBeUndefined();
  });
});
