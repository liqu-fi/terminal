import { describe, expect, it } from "vitest";

import { leverageSteps } from "../leverageSteps";

describe("leverageSteps", () => {
  it("режет лестницу по максимуму рынка", () => {
    expect(leverageSteps(10)).toEqual([1, 2, 3, 5, 10]);
  });

  it("дотягивает максимум рынка, которого нет в лестнице", () => {
    expect(leverageSteps(40)).toEqual([1, 2, 3, 5, 10, 15, 20, 25, 40]);
  });

  it("максимум, совпавший со ступенью, не удваивается", () => {
    expect(leverageSteps(25)).toEqual([1, 2, 3, 5, 10, 15, 20, 25]);
  });

  it("бессмысленный максимум оставляет хотя бы единицу", () => {
    expect(leverageSteps(0)).toEqual([1]);
  });

  it("необъявленный максимум оставляет лестницу целиком", () => {
    // `null` — рынок потолка не объявил. Срезать лестницу по числу, которого
    // рынок не называл, значило бы выдать умолчание терминала за его конфиг.
    expect(leverageSteps(null)).toEqual([1, 2, 3, 5, 10, 15, 20, 25]);
  });
});
