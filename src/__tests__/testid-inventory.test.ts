import { describe, expect, it } from "vitest";

import { collectTestIds } from "./collectTestIds";

describe("инвентарь data-testid", () => {
  it("не теряет идентификаторов, на которые ходит e2e", () => {
    const ids = collectTestIds();
    // Снапшот первым: якорь, упавший раньше него, заставляет `test -u` счесть
    // снапшот устаревшим и удалить весь инвентарь — то самое, что он стережёт.
    expect(ids).toMatchSnapshot();
    // Якоря: без них падение снапшота нечем прочитать глазами. Берутся статический
    // идентификатор, шаблонный и переданный пропом — по одному на каждый способ,
    // которым сборщик их находит.
    expect(ids).toContain("terminal-root");
    expect(ids).toContain("dialog-overlay");
    expect(ids).toContain("cancel-order-*");
  });
});
