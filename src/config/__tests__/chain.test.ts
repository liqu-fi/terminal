import { TURNKEY_CONNECTOR_ID } from "@liq/turnkey";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function connectorIds(): Promise<string[]> {
  const { getConfig } = await import("../chain");
  return getConfig().connectors.map((c) => c.id);
}

describe("коннекторы wagmi", () => {
  it("без флага входа — только injected", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1");
    vi.resetModules();
    expect(await connectorIds()).toEqual(["injected"]);
  });

  it("с флагом входа — injected первым, Turnkey вторым", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1");
    vi.stubEnv("VITE_TURNKEY_LOGIN", "true");
    vi.stubEnv("VITE_TURNKEY_ORG_ID", "org-1");
    vi.stubEnv("VITE_TURNKEY_AUTH_PROXY_CONFIG_ID", "cfg-1");
    vi.resetModules();
    expect(await connectorIds()).toEqual(["injected", TURNKEY_CONNECTOR_ID]);
  });

});
