import { afterEach, describe, expect, it, vi } from "vitest";

// deploy-env-init calls setDeployEnv(VITE_DEPLOY_ENV) on import. Re-import per
// case after resetting modules so the init and getChainConfig share one fresh
// @liq/core module graph (the deploy env lives in @liq/core module state).
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("deploy-env init", () => {
  it("VITE_DEPLOY_ENV=staging → SDK resolves the staging deploy (susdcMarketId 1)", async () => {
    vi.stubEnv("VITE_DEPLOY_ENV", "staging");
    await import("../deploy-env-init");
    const { getChainConfig } = await import("@liq/sdk");
    expect(getChainConfig(6343).susdcMarketId).toBe(1);
  });

  it("VITE_DEPLOY_ENV=production → SDK resolves the prod deploy (susdcMarketId 3)", async () => {
    vi.stubEnv("VITE_DEPLOY_ENV", "production");
    await import("../deploy-env-init");
    const { getChainConfig } = await import("@liq/sdk");
    expect(getChainConfig(6343).susdcMarketId).toBe(3);
  });

  it("unset VITE_DEPLOY_ENV defaults to staging, not prod", async () => {
    vi.stubEnv("VITE_DEPLOY_ENV", "");
    await import("../deploy-env-init");
    const { getChainConfig } = await import("@liq/sdk");
    expect(getChainConfig(6343).susdcMarketId).toBe(1);
  });
});
