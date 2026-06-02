import { expect, test } from "@playwright/test";

test("app boots and shows the connect CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("◢ terminal")).toBeVisible();
  // Two Connect Wallet buttons render (header + SessionGate); both must be present
  await expect(
    page.getByRole("button", { name: /connect wallet/i }).first(),
  ).toBeVisible();
});
