import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("флаги исполнения тикета", () => {
  test("IOC виден, но нажать его нельзя", async ({ page, world }) => {
    const { trade } = await enterTerminal(page, world);

    // Флажок показан — макет его просит, — но срок действия шлюз не
    // принимает, и заказанный IOC исполнился бы как GTC. Рабочий вид
    // сказал бы неправду о том, как исполнится ордер.
    await expect(trade.iocFlag).toBeVisible();
    await expect(trade.iocFlag).toBeDisabled();
    await expect(trade.iocFlag).toHaveAttribute("data-state", "unchecked");
  });

  test("Post Only живёт только на лимитной вкладке", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);

    // Рыночная вкладка: шлюз отвечает отказом на post-only у рыночных видов.
    await expect(trade.postOnlyFlag).toBeDisabled();

    await trade.selectTab("limit");
    await expect(trade.postOnlyFlag).toBeEnabled();
    await trade.postOnlyFlag.click();
    await expect(trade.postOnlyFlag).toHaveAttribute("data-state", "checked");

    // Возврат на рыночную снимает отметку вместе с доступностью: иначе тикет
    // показывал бы взведённый флаг, которого в ордере не будет.
    await trade.selectTab("market");
    await expect(trade.postOnlyFlag).toHaveAttribute("data-state", "unchecked");
  });

  test("Reduce Only доезжает до шлюза рыночным ордером", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);

    await trade.reduceOnlyFlag.click();
    await expect(trade.reduceOnlyFlag).toHaveAttribute("data-state", "checked");
    await trade.setSize("0.5");
    await trade.submit();

    await expect.poll(() => world.submittedOrders.length).toBe(1);
    expect(world.submittedOrders[0].reduceOnly).toBe(true);
  });

  test("Reduce Only доезжает до шлюза лимитным ордером", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);

    await trade.selectTab("limit");
    await trade.limitPriceInput.fill("69000");
    await trade.reduceOnlyFlag.click();
    await trade.setSize("0.5");
    await trade.submit();

    await expect.poll(() => world.submittedOrders.length).toBe(1);
    expect(world.submittedOrders[0].orderType).toBe("LIMIT");
    expect(world.submittedOrders[0].reduceOnly).toBe(true);
  });

  test("невзведённый Reduce Only уходит как false, а не молчанием", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);

    await trade.setSize("0.5");
    await trade.submit();

    await expect.poll(() => world.submittedOrders.length).toBe(1);
    expect(world.submittedOrders[0].reduceOnly).toBe(false);
  });

  test("TP/SL прячется на условной вкладке — прикреплять его не к чему", async ({
    page,
    world,
  }) => {
    const { trade } = await enterTerminal(page, world);

    await expect(trade.tpslToggle).toBeVisible();
    await trade.selectTab("stop");
    await expect(trade.tpslToggle).toBeHidden();
    await trade.selectTab("limit");
    await expect(trade.tpslToggle).toBeVisible();
  });
});
