import { describe, expect, it } from "vitest";
import { sessionStage } from "../sessionStage";

describe("sessionStage", () => {
  it("returns disconnected when no wallet", () => {
    expect(
      sessionStage({
        wallet: null,
        accountId: undefined,
        accountsLoading: false,
        isAuthenticated: false,
      }),
    ).toBe("disconnected");
  });
  it("returns loading while the account query is in flight", () => {
    expect(
      sessionStage({
        wallet: "0x1",
        accountId: undefined,
        accountsLoading: true,
        isAuthenticated: false,
      }),
    ).toBe("loading");
  });
  it("returns no-account when connected and the query resolved empty", () => {
    expect(
      sessionStage({
        wallet: "0x1",
        accountId: undefined,
        accountsLoading: false,
        isAuthenticated: false,
      }),
    ).toBe("no-account");
  });
  it("returns needs-signin when account exists but unauthenticated", () => {
    expect(
      sessionStage({
        wallet: "0x1",
        accountId: 1n,
        accountsLoading: false,
        isAuthenticated: false,
      }),
    ).toBe("needs-signin");
  });
  it("returns ready when authenticated with an account", () => {
    expect(
      sessionStage({
        wallet: "0x1",
        accountId: 1n,
        accountsLoading: false,
        isAuthenticated: true,
      }),
    ).toBe("ready");
  });
});
