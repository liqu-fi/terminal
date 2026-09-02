import { OrderType, Price } from "@liq/sdk";
import { useTradeStore } from "@liq/react";
import { beforeEach, describe, expect, it } from "vitest";

import { pickLevel } from "../pickLevel";

describe("pickLevel", () => {
  beforeEach(() => {
    useTradeStore.getState().reset();
  });

  it("после клика стор держит и orderType, и limitPrice уровня", () => {
    pickLevel(useTradeStore.getState(), 69_990n);
    const s = useTradeStore.getState();
    expect(s.orderType).toBe(OrderType.LIMIT);
    expect(s.limitPrice).toBe(Price(69_990n));
  });

  it("повторный клик по другой цене перезаписывает limitPrice", () => {
    pickLevel(useTradeStore.getState(), 69_990n);
    pickLevel(useTradeStore.getState(), 70_010n);
    const s = useTradeStore.getState();
    expect(s.orderType).toBe(OrderType.LIMIT);
    expect(s.limitPrice).toBe(Price(70_010n));
  });
});
