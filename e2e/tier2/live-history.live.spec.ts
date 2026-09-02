import { AppPage } from "../pages/AppPage";
import { UserInfoPanel } from "../pages/TerminalPanels";
import { liveConfigured } from "./env";
import { expect, test } from "./liveFixtures";

const TABS = [
  "trade-history",
  "order-history",
  "position-history",
  "funding-history",
  "account-history",
] as const;

test.describe("live: истории счёта", () => {
  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
  });

  test("каждая вкладка истории отвечает без ошибки", async ({ page }) => {
    // Числа живой ярус не проверяет — на staging их никто не обещает.
    // Проверяется единственное, чего мок проверить не может: путь до шлюза
    // существует и ответ разбирается.
    const failures: string[] = [];
    page.on("response", (r) => {
      const u = r.url();
      if (
        /position-history|settlement-ledger|\/orders|\/trades/.test(u) &&
        r.status() >= 400
      ) {
        failures.push(`${r.status()} ${u}`);
      }
    });

    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();
    const userInfo = new UserInfoPanel(page);

    for (const tab of TABS) {
      await userInfo.selectTab(tab);
      // Либо таблица, либо честное «пусто» / «источник молчит» — но не разрыв.
      await expect(
        page
          .locator(`[data-testid^="${tab}-table"]`)
          .or(page.getByTestId("position-history-unavailable")),
      ).toBeVisible({ timeout: 20_000 });
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });
});
