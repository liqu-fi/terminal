import { AppPage } from "../pages/AppPage";
import { expect, seed, test } from "../support/fixtures";
import { readyWorld } from "../support/world";

test.describe("boot + onboarding", () => {
  test("boots and shows the connect CTA when disconnected", async ({
    page,
  }) => {
    const app = new AppPage(page);
    await app.goto();
    await expect(app.brand).toBeVisible();
    await expect(app.disconnectedGate).toBeVisible();
    await expect(app.connectButton.first()).toBeVisible();
    await expect(app.terminal).toBeHidden();
  });

  test("connecting a wallet with no perps account shows the create CTA", async ({
    page,
  }) => {
    const app = new AppPage(page);
    await app.goto();
    await app.connect();
    await expect(app.noAccountGate).toBeVisible();
    await expect(app.createAccountButton).toBeVisible();
  });

  test("connect → sign-in lands in the terminal (existing BOOK account)", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();
    await expect(app.terminal).toBeVisible();
  });

  test("cold onboarding: connect → create account → enable book + sign-in", async ({
    page,
    world,
  }) => {
    const app = new AppPage(page);
    await app.goto();
    await app.onboard();
    await expect(app.terminal).toBeVisible();
    expect(world.accounts).toHaveLength(1);
    expect(world.accounts[0].orderMode).toBe("BOOK");
    expect(world.registeredAccountIds.length).toBeGreaterThan(0);
    expect(world.authVerifyRequests.length).toBeGreaterThan(0);
  });
});
