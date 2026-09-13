import type {
  PortfolioCollateralEvent,
  PortfolioPoint,
  SettlementLedgerRow,
} from "@liq/api-client";
import { describe, expect, it } from "vitest";

import {
  activityCsv,
  activityRows,
  filterActivity,
  marginUsage,
  periodWindow,
  pnlSeries,
  sumWhenAllLoaded,
  windowPnl,
  withinWindow,
} from "../accountPage";

const WAD = 10n ** 18n;
const DAY = 86_400_000;

function point(over: Partial<PortfolioPoint>): PortfolioPoint {
  return {
    timestamp: 1_700_000_000,
    equityUsd: 1_000,
    realizedPnlUsd: 0,
    unrealizedPnlUsd: 0,
    netDepositsUsd: 1_000,
    ...over,
  };
}

function ledger(over: Partial<SettlementLedgerRow>): SettlementLedgerRow {
  return {
    timestampMs: 1_700_000_000_000,
    txHash: "0x" + "ab".repeat(32),
    logIndex: 1,
    marketId: 100n,
    kind: "settlement",
    sizeDelta: -WAD,
    newSize: 0n,
    fillPrice: 70_000n * WAD,
    pricePnl: 100n * WAD,
    accruedFunding: -2n * WAD,
    interest: 0n,
    totalFees: WAD,
    netBalanceDelta: 99n * WAD,
    ...over,
  } as SettlementLedgerRow;
}

const deposit: PortfolioCollateralEvent = {
  timestamp: 1_700_000_100,
  amountUsd: 2_500,
  type: "deposit",
  collateralId: "2",
};

describe("окно периода", () => {
  it("даёт from/to назад от now, all — без границ", () => {
    const now = 1_800_000_000_000;
    expect(periodWindow("7d", now)).toEqual({
      from: new Date(now - 7 * DAY),
      to: new Date(now),
    });
    expect(periodWindow("all", now)).toEqual({});
  });
});

describe("PnL окна", () => {
  it("депозит посреди окна прибылью не считается", () => {
    const pnl = windowPnl([
      point({ equityUsd: 1_000, netDepositsUsd: 1_000 }),
      point({ equityUsd: 2_050, netDepositsUsd: 2_000 }),
    ]);
    expect(pnl).toEqual({ pnlUsd: 50, pct: 0.05 });
  });

  it("меньше двух точек — неизвестно, а не ноль", () => {
    expect(windowPnl([])).toBeUndefined();
    expect(windowPnl([point({})])).toBeUndefined();
  });

  it("пустой стартовый счёт — процент неизвестен", () => {
    const pnl = windowPnl([
      point({ equityUsd: 0, netDepositsUsd: 0 }),
      point({ equityUsd: 10, netDepositsUsd: 0 }),
    ]);
    expect(pnl).toEqual({ pnlUsd: 10, pct: null });
  });

  it("серия — equity минус депозиты, по возрастанию времени, без дублей", () => {
    const s = pnlSeries([
      point({ timestamp: 20, equityUsd: 1_200, netDepositsUsd: 1_000 }),
      point({ timestamp: 10, equityUsd: 1_000, netDepositsUsd: 1_000 }),
      point({ timestamp: 20, equityUsd: 1_300, netDepositsUsd: 1_000 }),
    ]);
    expect(s).toEqual([
      { time: 10, value: 0 },
      { time: 20, value: 300 },
    ]);
  });
});

describe("использование маржи", () => {
  it("1 − withdrawable/available, в пределах [0, 1]", () => {
    expect(marginUsage(1_000n * WAD, 714n * WAD)).toBeCloseTo(0.286, 3);
    expect(marginUsage(1_000n * WAD, 1_500n * WAD)).toBe(0);
    expect(marginUsage(1_000n * WAD, -5n * WAD)).toBe(1);
  });

  it("нечем измерять — undefined", () => {
    expect(marginUsage(0n, 0n)).toBeUndefined();
    expect(marginUsage(-1n, 0n)).toBeUndefined();
  });
});

describe("сумма остатков коллатералов", () => {
  it("все прочитаны — сумма; хоть один в полёте или список пуст — undefined", () => {
    expect(sumWhenAllLoaded([1n * WAD, 2n * WAD, 3n * WAD])).toBe(6n * WAD);
    expect(sumWhenAllLoaded([1n * WAD, undefined, 3n * WAD])).toBeUndefined();
    expect(sumWhenAllLoaded([])).toBeUndefined();
  });
});

describe("лента активности", () => {
  it("сливает секунды событий с миллисекундами леджера, новые сверху", () => {
    const rows = activityRows(
      [deposit],
      [ledger({ timestampMs: 1_700_000_000_000 })],
    );
    expect(rows.map((r) => r.kind)).toEqual(["deposit", "trade"]);
    expect(rows[0].timestampMs).toBe(1_700_000_100_000);
    expect(rows[0].amountUsd).toBe(2_500);
    expect(rows[1].amountUsd).toBe(99);
    expect(rows[1].marketId).toBe(100n);
  });

  it("вывод — со знаком минус независимо от знака на проводе", () => {
    const [row] = activityRows(
      [{ ...deposit, type: "withdrawal", amountUsd: 500 }],
      [],
    );
    expect(row.kind).toBe("withdrawal");
    expect(row.amountUsd).toBe(-500);
  });

  it("ликвидация — своим типом; недоказуемая сумма — null", () => {
    const [row] = activityRows(
      [],
      [ledger({ kind: "liquidation", netBalanceDelta: null })],
    );
    expect(row.kind).toBe("liquidation");
    expect(row.amountUsd).toBeNull();
  });

  it("фильтр по типу и по окну", () => {
    const rows = activityRows([deposit], [ledger({})]);
    expect(filterActivity(rows, "deposit")).toHaveLength(1);
    expect(filterActivity(rows, "all")).toHaveLength(2);
    expect(
      withinWindow(rows, {
        from: new Date(1_700_000_050_000),
        to: new Date(1_700_000_200_000),
      }),
    ).toHaveLength(1);
    expect(withinWindow(rows, {})).toHaveLength(2);
  });

  it("CSV: заголовок, ISO-время, символ рынка, пустые ячейки для «нет»", () => {
    const rows = activityRows(
      [deposit],
      [ledger({ netBalanceDelta: null })],
    );
    const csv = activityCsv(rows, () => "BTC,USD");
    const lines = csv.split("\n");
    expect(lines[0]).toBe("time,type,market,amount_usd,tx");
    expect(lines[1]).toBe("2023-11-14T22:15:00.000Z,Deposit,,2500.00,");
    expect(lines[2]).toBe(
      `2023-11-14T22:13:20.000Z,Trade,"BTC,USD",,0x${"ab".repeat(32)}`,
    );
  });
});
