const LADDER = [1, 2, 3, 5, 10, 15, 20, 25];

/**
 * Значения плеча, которые рынок допускает.
 *
 * @remarks Максимум рынка добавляется отдельно, если в лестницу он не попал:
 * иначе рынок с максимумом 40× не даёт выбрать собственный максимум. Пустая
 * лестница (бессмысленный максимум) вырождается в единицу, а не в пустой
 * список: список без единого значения не даёт выбрать вообще ничего.
 */
export function leverageSteps(maxLeverage: number): number[] {
  const capped = LADDER.filter((l) => l <= maxLeverage);
  if (capped.length === 0) return [1];
  return capped.some((l) => l === maxLeverage)
    ? capped
    : [...capped, maxLeverage];
}
