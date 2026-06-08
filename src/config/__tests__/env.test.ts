import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env gateway-url guard", () => {
  it("throws at load when VITE_GATEWAY_URL is blank", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "");
    vi.resetModules();
    await expect(import("../env")).rejects.toThrow(/VITE_GATEWAY_URL is not set/);
  });

  it("strips a trailing slash from the gateway URL", async () => {
    vi.stubEnv("VITE_GATEWAY_URL", "https://gw.example.com/v1/");
    vi.resetModules();
    const { env } = await import("../env");
    expect(env.gatewayUrl).toBe("https://gw.example.com/v1");
  });
});
