import { AppPage } from "../pages/AppPage";
import { expect, seed, test } from "../support/fixtures";
import { readyWorld } from "../support/world";

test.describe("двери входа", () => {
  test("без конфига Turnkey экран входа предлагает только кошелёк", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    const app = new AppPage(page);
    await app.goto();

    await expect(app.disconnectedGate).toBeVisible();
    await expect(app.connectButton.first()).toBeVisible();
    // Дверь Turnkey за флагом, а tier1 гоняется без него: кнопки быть не должно,
    // как и жалобы на неполный конфиг.
    await expect(app.turnkeyLoginButton).toHaveCount(0);
    await expect(app.authConfigError).toHaveCount(0);
  });

  test("дверь кошелька по-прежнему доводит до терминала", async ({ page, world }) => {
    seed(world, readyWorld());
    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();
    await expect(app.terminal).toBeVisible();
  });
});
