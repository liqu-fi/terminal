import { getChainConfig } from "@liq/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

// The shim is side-effecting (sets globalThis.process.env.DEPLOY_ENV on import),
// so each case re-imports it after stubbing the build env + resetting modules.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("deploy-env shim", () => {
  it("VITE_DEPLOY_ENV=staging → SDK resolves the staging deploy (susdcMarketId 1)", async () => {
    vi.stubEnv("VITE_DEPLOY_ENV", "staging");
    await import("../deploy-env-shim");
    expect(
      (globalThis as { process: { env: Record<string, string | undefined> } })
        .process.env.DEPLOY_ENV,
    ).toBe("staging");
    // getChainConfig reads globalThis.process.env.DEPLOY_ENV at call time.
    expect(getChainConfig(6343).susdcMarketId).toBe(1);
  });

  it("VITE_DEPLOY_ENV=production → SDK resolves the prod deploy (susdcMarketId 3)", async () => {
    vi.stubEnv("VITE_DEPLOY_ENV", "production");
    await import("../deploy-env-shim");
    expect(getChainConfig(6343).susdcMarketId).toBe(3);
  });
});
