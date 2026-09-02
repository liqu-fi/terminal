import { type PositionBrackets, Price, Qty, Side } from "@liq/sdk";
import { describe, expect, it } from "vitest";

import { tpslPlan } from "../tpslPlan";

const WAD = 10n ** 18n;
const LONG = { marketId: 200n, side: Side.BUY, size: Qty(2n * WAD) };
const NONE: PositionBrackets = { takeProfit: null, stopLoss: null };

function bracket(orderId: string, price: bigint) {
  return { orderId, triggerPrice: Price(price) };
}

describe("tpslPlan", () => {
  it("пустые скобки и заполненные поля — только подача", () => {
    const plan = tpslPlan({
      position: LONG,
      brackets: NONE,
      takeProfit: 80_000n * WAD,
      stopLoss: 60_000n * WAD,
    });

    expect(plan.cancel).toEqual([]);
    expect(plan.submit).toHaveLength(2);
    const [tp, sl] = plan.submit;
    // Длинная закрывается продажей; TP срабатывает выше рынка, SL ниже.
    expect(tp.side).toBe(Side.SELL);
    expect(tp.sizeDelta).toBe(-2n * WAD);
    expect(tp.triggerAbove).toBe(true);
    expect(sl.orderType).toBe("STOP_MARKET");
    expect(sl.triggerAbove).toBe(false);
    expect(sl.reduceOnly).toBe(true);
  });

  it("у короткой позиции направления зеркальны", () => {
    const plan = tpslPlan({
      position: { ...LONG, side: Side.SELL },
      brackets: NONE,
      takeProfit: 60_000n * WAD,
      stopLoss: 80_000n * WAD,
    });

    const [tp, sl] = plan.submit;
    expect(tp.side).toBe(Side.BUY);
    expect(tp.triggerAbove).toBe(false);
    expect(sl.triggerAbove).toBe(true);
  });

  it("изменённая цена — отмена старой заявки и подача новой", () => {
    const plan = tpslPlan({
      position: LONG,
      brackets: {
        takeProfit: bracket("tp-1", 80_000n * WAD),
        stopLoss: null,
      },
      takeProfit: 85_000n * WAD,
      stopLoss: 0n,
    });

    // Шлюз не умеет менять триггер на месте: правка — это отмена и подача.
    expect(plan.cancel).toEqual(["tp-1"]);
    expect(plan.submit).toHaveLength(1);
    expect(plan.submit[0].triggerPrice).toBe(85_000n * WAD);
  });

  it("очищенное поле снимает скобку и ничего не подаёт", () => {
    const plan = tpslPlan({
      position: LONG,
      brackets: { takeProfit: null, stopLoss: bracket("sl-2", 60_000n * WAD) },
      takeProfit: 0n,
      stopLoss: 0n,
    });

    expect(plan.cancel).toEqual(["sl-2"]);
    expect(plan.submit).toEqual([]);
  });

  it("неизменная цена не даёт ни отмены, ни подачи", () => {
    // Переподача той же скобки сожгла бы nonce и на секунду оставила позицию
    // без стопа — ровно в тот момент, когда его и просили сохранить.
    const plan = tpslPlan({
      position: LONG,
      brackets: {
        takeProfit: bracket("tp-1", 80_000n * WAD),
        stopLoss: bracket("sl-2", 60_000n * WAD),
      },
      takeProfit: 80_000n * WAD,
      stopLoss: 60_000n * WAD,
    });

    expect(plan).toEqual({ cancel: [], submit: [] });
  });

  it("у пустой позиции скобка только снимается", () => {
    const plan = tpslPlan({
      position: { ...LONG, size: Qty(0n) },
      brackets: { takeProfit: bracket("tp-1", 80_000n * WAD), stopLoss: null },
      takeProfit: 85_000n * WAD,
      stopLoss: 0n,
    });

    // Закрывать нечего — подавать закрывающий условный не от чего.
    expect(plan.cancel).toEqual(["tp-1"]);
    expect(plan.submit).toEqual([]);
  });
});
