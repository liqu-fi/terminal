import { AppPage } from "../pages/AppPage";
import { liveConfigured } from "./env";
import { expect, test } from "./liveFixtures";

test.describe("live: connectivity", () => {
  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
  });

  test("boots and connects a real wallet", async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();
    await expect(app.brand).toBeVisible();
    await app.connect();
    await expect(app.walletAddressButton).toBeVisible();
  });
});
