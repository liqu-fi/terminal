/**
 * Tier 2 fixtures: install the live (mnemonic-derived) injected wallet on the
 * page. No mocks — the real SPA talks to the real gateway + RPC. Live runs
 * serially (workers:1), so a single derivation index avoids nonce clashes.
 */
import { test as base, expect } from "@playwright/test";
import { mnemonicToAccount } from "viem/accounts";

import { liveConfigured, liveEnv } from "./env";
import { installLiveWallet } from "./liveWallet";

export const test = base.extend<{ liveWalletIndex: number; liveWallet: void }>({
  /** Derivation index for the page's wallet — overridable per spec file
   * (the onboarding spec uses a fresh per-run index). */
  liveWalletIndex: [0, { option: true }],
  liveWallet: [
    async ({ page, liveWalletIndex }, use) => {
      if (liveConfigured().ok) {
        const account = mnemonicToAccount(liveEnv.mnemonic, {
          addressIndex: liveWalletIndex,
        });
        await installLiveWallet(page, account, liveEnv.rpcUrl, liveEnv.chainId);
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
