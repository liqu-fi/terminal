import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("отбрасывает ложные значения", () => {
    // Литералами, а не через `false && "b"`: ESLint справедливо зовёт такое
    // выражение мёртвым кодом, а под тестом здесь — что clsx отбрасывает ложное.
    expect(cn("a", false, undefined, null, "c")).toBe("a c");
  });

  it("разрешает конфликт tailwind-классов в пользу последнего", () => {
    // Именно это отличает cn от простой склейки: без tailwind-merge
    // результат был бы "p-2 p-4" и порядок решал бы CSS, а не вызов.
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
