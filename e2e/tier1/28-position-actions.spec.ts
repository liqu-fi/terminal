import { Qty } from "@liq/sdk";

import { enterTerminal } from "../pages/flows";
import { MARKET, MARKET_ETH, WAD } from "../support/constants";
import { expect, test } from "../support/fixtures";
import {
  conditionalOrderFixture,
  limitOrderFixture,
  longPositionFixture,
  readyWorld,
} from "../support/world";

/** Марк-цена фикстуры = 70 000; закрытие лонга бьёт вниз на 0,5 %. */
const CLOSE_ACCEPTABLE_SELL = ((70_000n * WAD * 9_950n) / 10_000n).toString();

test.describe("position actions", () => {
  test("closing a row submits a reduce-only market order the other way", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].positions = [longPositionFixture()];
      return w;
    });

    await userInfo.selectTab("positions");
    await userInfo.closePosition(MARKET.id).click();
    await expect(userInfo.closeDialog).toBeVisible();
    await userInfo.closeConfirm.click();

    await expect.poll(() => world.submittedOrders.length).toBe(1);
    const order = world.submittedOrders.at(-1)!;
    expect(order.orderType).toBe("MARKET");
    // Длинную на 1 BTC закрывает продажа на тот же размер, reduce-only —
    // без флага ордер, пришедший после уменьшения позиции, открыл бы шорт.
    expect(order.side).toBe("SELL");
    expect(order.sizeDelta).toBe((-Qty.parse("1")).toString());
    expect(order.reduceOnly).toBe(true);
    expect(order.acceptablePrice).toBe(CLOSE_ACCEPTABLE_SELL);
  });

  test("Close All submits one order per position", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () => {
      const w = readyWorld({ markets: [MARKET, MARKET_ETH] });
      w.accounts[0].positions = [
        longPositionFixture({ marketId: MARKET.id }),
        longPositionFixture({ marketId: MARKET_ETH.id, positionSize: -WAD }),
      ];
      return w;
    });

    await userInfo.selectTab("positions");
    await userInfo.closeAll.click();
    await expect(userInfo.closeDialog).toBeVisible();
    await userInfo.closeConfirm.click();

    await expect.poll(() => world.submittedOrders.length).toBe(2);
    const markets = world.submittedOrders.map((o) => o.marketId);
    expect(new Set(markets)).toEqual(new Set([MARKET.id, MARKET_ETH.id]));
    // Короткая закрывается покупкой — сторона берётся от позиции, а не общая.
    const eth = world.submittedOrders.find((o) => o.marketId === MARKET_ETH.id);
    expect(eth?.side).toBe("BUY");
  });

  test("closing cancels the position's brackets and leaves resting limits alone", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].positions = [longPositionFixture()];
      w.conditionalOrders = [
        conditionalOrderFixture({ id: "sl-1" }),
        conditionalOrderFixture({
          id: "tp-1",
          orderType: "TAKE_PROFIT_MARKET",
          triggerPrice: (90_000n * WAD).toString(),
        }),
      ];
      w.openOrders = [limitOrderFixture({ id: "rest-1" })];
      return w;
    });

    await userInfo.selectTab("positions");
    await userInfo.closePosition(MARKET.id).click();
    await userInfo.closeConfirm.click();

    await expect.poll(() => world.submittedOrders.length).toBe(1);
    // Осиротевший reduce-only триггер исполниться не может, но в списке
    // условных читается как живой — поэтому снимается вместе с позицией.
    expect(new Set(world.cancelledOrderIds)).toEqual(new Set(["sl-1", "tp-1"]));
    // А отдыхающая лимитка не трогается: кнопка про неё не говорила.
    expect(world.cancelledOrderIds).not.toContain("rest-1");
  });

  test("editing TP cancels the old trigger and submits a new one", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].positions = [longPositionFixture()];
      w.conditionalOrders = [
        conditionalOrderFixture({
          id: "tp-1",
          orderType: "TAKE_PROFIT_MARKET",
          triggerPrice: (90_000n * WAD).toString(),
        }),
      ];
      return w;
    });

    await userInfo.selectTab("positions");
    await userInfo.editTpSl(MARKET.id).click();
    await expect(userInfo.tpslDialog).toBeVisible();
    // Диалог показывает состояние, а не пустой бланк.
    await expect(userInfo.tpslTp).toHaveValue("90000");

    await userInfo.tpslTp.fill("95000");
    await userInfo.tpslSave.click();

    await expect.poll(() => world.submittedOrders.length).toBe(1);
    // Шлюз не умеет менять триггер на месте: правка — отмена и подача.
    expect(world.cancelledOrderIds).toContain("tp-1");
    const order = world.submittedOrders.at(-1)!;
    expect(order.orderType).toBe("TAKE_PROFIT_MARKET");
    expect(order.triggerPrice).toBe((95_000n * WAD).toString());
    // Длинная: TP срабатывает выше рынка.
    expect(order.triggerAbove).toBe(true);
    expect(order.reduceOnly).toBe(true);
  });

  test("clearing the SL field only cancels", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].positions = [longPositionFixture()];
      w.conditionalOrders = [conditionalOrderFixture({ id: "sl-1" })];
      return w;
    });

    await userInfo.selectTab("positions");
    await userInfo.editTpSl(MARKET.id).click();
    await expect(userInfo.tpslSl).toHaveValue("80000");

    await userInfo.tpslSl.fill("");
    await userInfo.tpslSave.click();

    await expect.poll(() => world.cancelledOrderIds).toContain("sl-1");
    // Пустое поле означает «снять», а не «оставить как было»: иначе снять
    // скобку было бы нечем.
    expect(world.submittedOrders).toHaveLength(0);
  });
});
