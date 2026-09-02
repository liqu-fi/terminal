import { describe, expect, it } from "vitest";

import { fundingRows } from "../useAccountLedger";

const row = (accruedFunding: bigint | null, logIndex = 0) => ({
  timestampMs: 1_717_200_000_000,
  txHash: "0xabc",
  logIndex,
  marketId: 200n,
  kind: "settlement" as const,
  sizeDelta: null,
  newSize: null,
  fillPrice: null,
  pricePnl: null,
  accruedFunding,
  interest: null,
  totalFees: null,
  netBalanceDelta: null,
  liquidationTouched: false,
});

describe("строки фандинга", () => {
  it("берёт только расчёты, где фандинг действительно двигался", () => {
    expect(fundingRows([row(5n, 0), row(0n, 1)])).toHaveLength(1);
  });

  it("не считает недоказуемый фандинг нулевым и выбрасывает его", () => {
    // `null` — «не смогли доказать», а не «ноль». Строка с null в колонке
    // платежа показала бы прочерк там, где вкладка обещает список платежей.
    expect(fundingRows([row(null)])).toHaveLength(0);
  });

  it("оставляет отрицательный платёж — трейдер платил", () => {
    expect(fundingRows([row(-7n)])).toHaveLength(1);
  });
});
