import { describe, expect, it } from "vitest";

import { collectTestIds } from "./collectTestIds";

describe("инвентарь data-testid", () => {
  it("не теряет идентификаторов, на которые ходит e2e", () => {
    const ids = collectTestIds();
    // Якоря: без них падение снапшота нечем прочитать глазами.
    expect(ids).toContain("terminal-root");
    expect(ids).toContain("dialog-overlay");
    expect(ids).toContain("order-row-*");
    expect(ids).toMatchSnapshot();
  });
});
