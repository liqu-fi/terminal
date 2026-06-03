import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";

test.describe("disconnect", () => {
  test("disconnecting the wallet returns to the connect screen", async ({
    page,
    world,
  }) => {
    const { app } = await enterTerminal(page, world);
    await expect(app.terminal).toBeVisible();

    await app.walletAddressButton.click();

    await expect(app.disconnectedGate).toBeVisible();
    await expect(app.terminal).toBeHidden();
  });
});
