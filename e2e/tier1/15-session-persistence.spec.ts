import { AppPage } from "../pages/AppPage";
import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("session persistence", () => {
  test("a reload with a persisted JWT lands back in the terminal without a second SIWE", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    expect(world.authVerifyRequests).toHaveLength(1);
    const signs = world.signRequests.length;

    await page.reload();

    const app = new AppPage(page);
    // wagmi auto-reconnects the injected wallet; the JWT comes back from
    // localStorage('liq-gateway') — so the terminal returns with zero clicks…
    await expect(app.terminal).toBeVisible({ timeout: 25_000 });
    // …and crucially with no re-authentication of any kind:
    expect(world.authVerifyRequests).toHaveLength(1);
    expect(world.authNonceRequests).toBe(1);
    expect(world.signRequests.length).toBe(signs);
  });

  test("the order nonce re-syncs from the gateway after a reload", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    await expect.poll(() => world.orderNonceRequests).toBeGreaterThan(0);
    const before = world.orderNonceRequests;

    await page.reload();
    await expect(new AppPage(page).terminal).toBeVisible({ timeout: 25_000 });
    // The restored token re-arms useGatewayNonceSync — a fresh seed is fetched.
    await expect.poll(() => world.orderNonceRequests).toBeGreaterThan(before);
  });
});
