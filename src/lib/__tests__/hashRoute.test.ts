import { describe, expect, it } from "vitest";

import { ACCOUNT_TABS, accountHref, parseRoute } from "@/lib/hashRoute";

describe("хеш-маршрут", () => {
  it("пустой хеш и корень — торговый экран", () => {
    expect(parseRoute("")).toEqual({ view: "trade" });
    expect(parseRoute("#")).toEqual({ view: "trade" });
    expect(parseRoute("#/")).toEqual({ view: "trade" });
  });

  it("#/account — обзор; каждая вкладка — по своему сегменту", () => {
    expect(parseRoute("#/account")).toEqual({ view: "account", tab: "overview" });
    expect(parseRoute("#/account/")).toEqual({ view: "account", tab: "overview" });
    for (const tab of ACCOUNT_TABS) {
      expect(parseRoute(`#/account/${tab}`)).toEqual({ view: "account", tab });
    }
  });

  it("неизвестная вкладка и мусор в хеше — торговый экран", () => {
    // Turnkey OAuth кладёт id_token в хеш; парсер обязан его проглотить.
    expect(parseRoute("#id_token=abc.def")).toEqual({ view: "trade" });
    expect(parseRoute("#/account/security")).toEqual({ view: "trade" });
    expect(parseRoute("#/account/assets/extra")).toEqual({ view: "trade" });
  });

  it("accountHref обратен parseRoute", () => {
    for (const tab of ACCOUNT_TABS) {
      expect(parseRoute(accountHref(tab))).toEqual({ view: "account", tab });
    }
    expect(accountHref("overview")).toBe("#/account");
  });
});
