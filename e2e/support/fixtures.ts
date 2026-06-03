/**
 * Tier 1 (hermetic) Playwright fixtures.
 *
 * Each test gets a `world` (a MockWorld, default {@link freshWorld}) with the
 * injected wallet + mock chain + mock gateway already wired onto the page. To
 * use a different scenario, `seed(world, readyWorld(...))` before navigating —
 * the interceptors hold the same `world` reference and read it lazily at request
 * time, so in-place mutation is observed.
 */
import { test as base, expect } from "@playwright/test";

import { installWallet } from "./injectedWallet";
import { mockChain } from "./mockChain";
import { mockGateway } from "./mockGateway";
import { freshWorld, type MockWorld } from "./world";

export const test = base.extend<{ world: MockWorld }>({
  // `auto` so the wallet + mocks are installed for every test, even ones that
  // don't name `world` in their fixtures.
  world: [
    async ({ page }, use) => {
      const world = freshWorld();
      await installWallet(page, world);
      await mockChain(page, world);
      await mockGateway(page, world);
      await use(world);
    },
    { auto: true },
  ],
});

/** Replace the world's fields in place (keeps the reference the mocks hold). */
export function seed(world: MockWorld, src: MockWorld): MockWorld {
  Object.assign(world, src);
  return world;
}

export { expect };
