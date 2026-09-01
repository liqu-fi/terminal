import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("отбрасывает ложные значения", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("разрешает конфликт tailwind-классов в пользу последнего", () => {
    // Именно это отличает cn от простой склейки: без tailwind-merge
    // результат был бы "p-2 p-4" и порядок решал бы CSS, а не вызов.
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
