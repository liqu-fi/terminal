import { TURNKEY_CONNECTOR_ID } from "@liq/turnkey";
import { describe, expect, it } from "vitest";

import {
  INJECTED_CONNECTOR_ID,
  clearDoor,
  readDoor,
  reconnectPlan,
  writeDoor,
} from "../identityDoor";

function memoryStorage(seed?: Record<string, string>) {
  const map = new Map(Object.entries(seed ?? {}));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

const BOTH = [INJECTED_CONNECTOR_ID, TURNKEY_CONNECTOR_ID];

describe("readDoor", () => {
  it("возвращает null, когда ничего не записано", () => {
    expect(readDoor(memoryStorage())).toBeNull();
  });

  it("читает записанную дверь", () => {
    const storage = memoryStorage();
    writeDoor(storage, "turnkey");
    expect(readDoor(storage)).toBe("turnkey");
  });

  it("не пропускает мусор наружу", () => {
    const storage = memoryStorage({ "liq-terminal-door": "metamask" });
    expect(readDoor(storage)).toBeNull();
  });

  it("переживает хранилище, которое бросает", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readDoor(throwing)).toBeNull();
  });

  it("clearDoor стирает запись", () => {
    const storage = memoryStorage();
    writeDoor(storage, "injected");
    clearDoor(storage);
    expect(readDoor(storage)).toBeNull();
  });
});

describe("writeDoor", () => {
  it("переживает хранилище, чей setItem бросает", () => {
    const throwing = {
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(() => writeDoor(throwing, "turnkey")).not.toThrow();
  });
});

describe("clearDoor", () => {
  it("переживает хранилище, чьё removeItem бросает", () => {
    const throwing = {
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(() => clearDoor(throwing)).not.toThrow();
  });
});

describe("reconnectPlan", () => {
  it("без запомненной двери не восстанавливает ничего", () => {
    expect(reconnectPlan(null, BOTH)).toBeNull();
  });

  it("восстанавливает ровно ту дверь, которой входили", () => {
    expect(reconnectPlan("injected", BOTH)).toBe(INJECTED_CONNECTOR_ID);
    expect(reconnectPlan("turnkey", BOTH)).toBe(TURNKEY_CONNECTOR_ID);
  });

  it("молчит, когда коннектора двери нет в сборке", () => {
    expect(reconnectPlan("turnkey", [INJECTED_CONNECTOR_ID])).toBeNull();
  });
});
