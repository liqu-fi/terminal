import { AppPage } from "../pages/AppPage";
import { SET_BOOK_MODE_SELECTOR } from "../support/chain";
import { expect, seed, test } from "../support/fixtures";
import { accountOnchainWorld, readyWorld } from "../support/world";

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
    // already in BOOK mode ⇒ sign-in must NOT send a redundant enable-book tx
    expect(world.sentTxs.some((t) => t.kind === SET_BOOK_MODE_SELECTOR)).toBe(
      false,
    );
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
    // the freshly minted account (#1) was the one registered + book-enabled…
    expect(world.registeredAccountIds).toContain("1");
    expect(world.sentTxs.some((t) => t.kind === SET_BOOK_MODE_SELECTOR)).toBe(
      true,
    );
    // …and the SIWE payload carries the gateway nonce + the (mock) signature
    expect(world.authVerifyRequests[0].message).toContain("e2e-nonce-1");
    expect(world.authVerifyRequests[0].signature).toBe("0x" + "11".repeat(65));
  });

  test("pre-existing ONCHAIN account: enable book + sign-in (no redundant mint)", async ({
    page,
    world,
  }) => {
    seed(world, accountOnchainWorld()); // account #1 already exists, in ONCHAIN mode
    const app = new AppPage(page);
    await app.goto();
    await app.connect();

    // The account exists, so there is no create CTA — straight to sign-in, and
    // since it isn't BOOK yet the CTA enables book orders rather than plain SIWE.
    await expect(app.needsSigninGate).toBeVisible();
    await expect(app.signinButton).toHaveText(/Enable Book Orders/);
    await app.signIn();

    await expect(app.terminal).toBeVisible();
    // No second account was minted — the existing one was flipped to BOOK in place.
    expect(world.accounts).toHaveLength(1);
    expect(world.accounts[0].id).toBe(1n);
    expect(world.accounts[0].orderMode).toBe("BOOK");
    expect(world.registeredAccountIds).toContain("1");
    expect(world.authVerifyRequests).toHaveLength(1);
  });

  test("a failed SIWE verify keeps the user on the sign-in gate, then recovers", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld()); // funded BOOK account → sign-in is a plain SIWE step
    const app = new AppPage(page);
    await app.goto();
    await app.connect();
    await expect(app.needsSigninGate).toBeVisible();

    // Gateway rejects the SIWE verify: the app must NOT advance into the terminal.
    world.faults.authVerifyStatus = 401;
    await app.signinButton.click();
    await expect(app.terminal).toBeHidden();
    await expect(app.needsSigninGate).toBeVisible();
    // the 401 short-circuits before the gateway records the verify payload
    expect(world.authVerifyRequests).toHaveLength(0);

    // Clearing the fault and retrying recovers — proving it's a retryable gate,
    // not a silent dead-end or a silent advance.
    delete world.faults.authVerifyStatus;
    await app.signinButton.click();
    await expect(app.terminal).toBeVisible();
    expect(world.authVerifyRequests).toHaveLength(1);
  });
});
