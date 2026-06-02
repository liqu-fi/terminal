import { describe, expect, it } from "vitest";
import { sessionStage } from "../sessionStage";

describe("sessionStage", () => {
  it("returns disconnected when no wallet", () => {
    expect(
      sessionStage({
        wallet: null,
        accountId: undefined,
        isAuthenticated: false,
      }),
    ).toBe("disconnected");
  });
  it("returns no-account when connected but no SNX account", () => {
    expect(
      sessionStage({
        wallet: "0x1",
        accountId: undefined,
        isAuthenticated: false,
      }),
    ).toBe("no-account");
  });
  it("returns needs-signin when account exists but unauthenticated", () => {
    expect(
      sessionStage({ wallet: "0x1", accountId: 1n, isAuthenticated: false }),
    ).toBe("needs-signin");
  });
  it("returns ready when authenticated with an account", () => {
    expect(
      sessionStage({ wallet: "0x1", accountId: 1n, isAuthenticated: true }),
    ).toBe("ready");
  });
});
