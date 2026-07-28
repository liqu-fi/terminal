import { SCOPE_TRADING } from "@liq/core";

import { AppPage } from "../pages/AppPage";
import { SessionKeyPanel } from "../pages/SessionKeyPanel";
import { enterTerminal } from "../pages/flows";
import { TEST_ADDRESS } from "../support/constants";
import { expect, seed, test } from "../support/fixtures";
import {
  expiredSessionFixture,
  readStoredSession,
  seedStoredSession,
} from "../support/sessionKeys";
import { readyWorld } from "../support/world";

const DAY_SECONDS = 86_400;

/** How many times the wallet has been asked for an EIP-712 signature. */
function typedSignCount(signRequests: string[]): number {
  return signRequests.filter((m) => m === "eth_signTypedData_v4").length;
}

test.describe("session keys — grant lifecycle", () => {
  test("the pill is gated behind auth and starts inactive", async ({
    page,
    world,
  }) => {
    seed(world, readyWorld());
    const app = new AppPage(page);
    const sessionKey = new SessionKeyPanel(page);

    await app.goto();
    // The toolbar lives inside SessionGate's authenticated branch, so an
    // unauthenticated visitor never sees it — nothing to click before sign-in.
    await expect(page.getByTestId("session-toolbar")).toBeHidden();

    await app.signInToTerminal();
    await expect(sessionKey.button).toBeVisible();
    await expect(sessionKey.button).toHaveText("Enable 1-click trading");
    await expect(sessionKey.statusDot).toHaveClass(/bg-muted/);
  });

  test("granting a 7-day session costs exactly one wallet signature", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    const sessionKey = new SessionKeyPanel(page);
    const signsBefore = typedSignCount(world.signRequests);

    await sessionKey.enable(7);

    // One EIP-712 prompt — the grant itself. This is the whole point of the
    // feature: the user pays a single signature, then trades prompt-free.
    expect(typedSignCount(world.signRequests) - signsBefore).toBe(1);

    expect(world.sessionKeys).toHaveLength(1);
    const { grant, signature } = world.sessionKeys[0];
    expect(grant.user.toLowerCase()).toBe(TEST_ADDRESS.toLowerCase());
    // Scope pins the grant to trading — a broader scope would let the session
    // key move funds, which is exactly what the modal promises it cannot.
    expect(grant.scope).toBe(SCOPE_TRADING);
    expect(signature).toBeTruthy();
    // The session key is freshly generated, never the EOA.
    expect(grant.sessionKey.toLowerCase()).not.toBe(TEST_ADDRESS.toLowerCase());

    const nowSec = Math.floor(Date.now() / 1000);
    const validUntil = Number(grant.validUntil);
    // 7 days out, with slack for the round-trip in either direction.
    expect(validUntil).toBeGreaterThan(nowSec + 7 * DAY_SECONDS - 120);
    expect(validUntil).toBeLessThanOrEqual(nowSec + 7 * DAY_SECONDS + 5);

    await expect(sessionKey.statusDot).toHaveClass(/bg-long/);
    expect(await sessionKey.label()).toMatch(/^1-click:/);
  });

  test("revoking clears the grant on the gateway and on disk", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    const sessionKey = new SessionKeyPanel(page);

    await sessionKey.enable(1);
    const granted = world.sessionKeys[0];
    expect(await readStoredSession(page)).not.toBeNull();

    await sessionKey.revoke();

    expect(world.revokedSessionKeyIds).toEqual([granted.id]);
    expect(world.sessionKeys).toHaveLength(0);
    // Local state must go too, else the pill would claim an active session the
    // gateway would refuse to honour.
    await expect.poll(() => readStoredSession(page)).toBeNull();
    await expect(sessionKey.button).toHaveText("Enable 1-click trading");
    await expect(sessionKey.statusDot).toHaveClass(/bg-muted/);
  });

  test("an active grant survives a reload", async ({ page, world }) => {
    const { app } = await enterTerminal(page, world);
    const sessionKey = new SessionKeyPanel(page);

    await sessionKey.enable(7);
    const signsAfterGrant = typedSignCount(world.signRequests);

    await page.reload();
    await expect(app.terminal).toBeVisible({ timeout: 25_000 });

    // Restored from localStorage — no second grant, no second prompt.
    await expect(sessionKey.statusDot).toHaveClass(/bg-long/);
    expect(world.sessionKeys).toHaveLength(1);
    expect(typedSignCount(world.signRequests)).toBe(signsAfterGrant);
  });

  test("an expired grant is discarded instead of trusted", async ({
    page,
    world,
  }) => {
    await seedStoredSession(page, expiredSessionFixture());
    await enterTerminal(page, world);
    const sessionKey = new SessionKeyPanel(page);

    // A stale grant must not read as active: orders signed with a dead session
    // key would be rejected by the gateway with no obvious cause.
    await expect(sessionKey.statusDot).toHaveClass(/bg-muted/);
    await expect(sessionKey.button).toHaveText("Enable 1-click trading");
    await expect.poll(() => readStoredSession(page)).toBeNull();
  });

  test("a failed registration leaves the modal open and retryable", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    const sessionKey = new SessionKeyPanel(page);
    world.faults.sessionKeyRegisterStatus = 500;

    await sessionKey.open();
    await sessionKey.createButton(7).click();

    // The modal closes only on success, so a rejected registration must leave
    // it standing with its buttons live — the user can retry without reopening.
    await expect(sessionKey.overlay).toBeVisible();
    await expect(sessionKey.createButton(7)).toBeEnabled();
    expect(world.sessionKeys).toHaveLength(0);
    expect(await readStoredSession(page)).toBeNull();

    // Clearing the fault, the same click now succeeds.
    world.faults.sessionKeyRegisterStatus = undefined;
    await sessionKey.createButton(7).click();
    await sessionKey.overlay.waitFor({ state: "detached" });
    expect(world.sessionKeys).toHaveLength(1);
  });
});
