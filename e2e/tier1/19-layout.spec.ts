import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("раскладка терминала", () => {
  test("чарт сворачивается и разворачивается", async ({ page, world }) => {
    const { layout } = await enterTerminal(page, world);
    await expect(layout.chartPanel).toBeVisible();

    await layout.toggleChart();
    await expect(layout.chartPanel).toBeHidden();

    await layout.toggleChart();
    await expect(layout.chartPanel).toBeVisible();
  });

  test("свёртка переживает перезагрузку", async ({ page, world }) => {
    const { app, layout } = await enterTerminal(page, world);
    await layout.toggleChart();
    await expect(layout.chartPanel).toBeHidden();

    await page.reload();
    // Раскладка — настройка рабочего места: она в persist-сторе, не в памяти.
    // Но терминал не возвращается мгновенно — JWT поднимается из localStorage,
    // wagmi переподключает кошелёк — так что сперва дождаться терминала на
    // экране, иначе "chart-panel скрыт" будет истиной ещё до отрисовки
    // раскладки и ничего не докажет (см. 15-session-persistence.spec.ts).
    await expect(app.terminal).toBeVisible({ timeout: 25_000 });
    await expect(layout.chartCollapseToggle).toBeVisible();
    await expect(layout.chartPanel).toBeHidden();
  });

  test("нижняя панель разворачивается на весь экран", async ({
    page,
    world,
  }) => {
    const { layout, trade } = await enterTerminal(page, world);
    await layout.toggleBottomFullscreen();
    await expect(layout.bottomPanel).toBeVisible();
    await expect(trade.root).toBeHidden();
  });
});
