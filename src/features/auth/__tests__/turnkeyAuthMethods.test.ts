import { describe, expect, it } from "vitest";

import { turnkeyAuthMethods } from "../turnkeyAuthMethods";

describe("turnkeyAuthMethods", () => {
  it("открывает ровно две двери: почту и внешний кошелёк", () => {
    const { methods } = turnkeyAuthMethods();
    expect(methods.emailOtpAuthEnabled).toBe(true);
    expect(methods.walletAuthEnabled).toBe(true);
  });

  it("перечисляет каждый флаг явно, не полагаясь на дашборд", () => {
    const { methods } = turnkeyAuthMethods();
    // Пропущенный ключ провайдер разрешает против `enabledProviders` из
    // дашборда — то есть молча включает то, что там включено.
    expect(Object.keys(methods).sort()).toEqual(
      [
        "appleOauthEnabled",
        "discordOauthEnabled",
        "emailOtpAuthEnabled",
        "facebookOauthEnabled",
        "googleOauthEnabled",
        "passkeyAuthEnabled",
        "smsOtpAuthEnabled",
        "walletAuthEnabled",
        "xOauthEnabled",
      ].sort(),
    );
  });

  it("выключает всё остальное", () => {
    const { methods } = turnkeyAuthMethods();
    expect(methods.smsOtpAuthEnabled).toBe(false);
    expect(methods.passkeyAuthEnabled).toBe(false);
    expect(methods.googleOauthEnabled).toBe(false);
    expect(methods.appleOauthEnabled).toBe(false);
    expect(methods.xOauthEnabled).toBe(false);
    expect(methods.discordOauthEnabled).toBe(false);
    expect(methods.facebookOauthEnabled).toBe(false);
  });

  it("ставит почту первой", () => {
    expect(turnkeyAuthMethods().methodOrder).toEqual(["email", "wallet"]);
  });
});
