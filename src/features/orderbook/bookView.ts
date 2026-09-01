import { type BookRow, formatPrice, formatQty, tickDecimals } from "@liq/sdk";

import { toNum } from "@/lib/format";

/** Пустой слот сетки: место занято, данных нет. */
export type Slot = BookRow | null;

/**
 * Раскладывает сторону книги в сетку фиксированной высоты.
 *
 * @remarks Высота панели не должна зависеть от толщины книги: иначе соседний
 * график дёргается на каждом снимке. Лишние строки отбрасываются, недостающие
 * добиваются пустыми слотами с той стороны, которая дальше от спреда.
 */
export function padSlots(
  rows: readonly BookRow[],
  slots: number,
  where: "start" | "end",
): Slot[] {
  const kept = rows.slice(0, slots);
  const blanks = Array.from<Slot>({ length: Math.max(0, slots - kept.length) });
  const filled = blanks.fill(null);
  return where === "start" ? [...filled, ...kept] : [...kept, ...filled];
}

/**
 * Аски сверху вниз: худшая цена первой, лучшая — вплотную к спреду.
 *
 * @remarks `BookSnapshot.asks` приходит от лучшей цены к худшей; на экране
 * порядок обратный, поэтому разворот делается здесь, а не в SDK.
 */
export function askSlots(asks: readonly BookRow[], slots: number): Slot[] {
  return padSlots([...asks].slice(0, slots).reverse(), slots, "start");
}

/** Биды сверху вниз: лучшая цена сразу под спредом. */
export function bidSlots(bids: readonly BookRow[], slots: number): Slot[] {
  return padSlots(bids, slots, "end");
}

/**
 * Цена группы: знаков ровно столько, сколько различает шаг.
 *
 * @remarks Тонкая обёртка над `formatPrice` из SDK — своей арифметики
 * форматирования не заводим. `$`-префикс гасится: он уже стоит в заголовке
 * колонки книги, дублировать его на каждой строке незачем. `tickDecimals`
 * принимает брендированный `Price`, а не голый `bigint`; здесь единственное
 * место, где это приводится — дальше по модулю приведение не тащим.
 */
export function fmtBookPrice(price: bigint, tick: bigint): string {
  const decimals = tickDecimals(tick as never);
  return formatPrice(price, {
    sign: "",
    minDecimals: decimals,
    maxDecimals: decimals,
  });
}

/**
 * Объём уровня: мелкий показывается подробнее крупного.
 *
 * @remarks Разрядность — доменное решение (объём меньше единицы заслуживает
 * больше значащих цифр, чем объём в десятки и сотни), поэтому шаг принятия
 * решения остаётся здесь; собственно печать бренда делегирована `formatQty`
 * из SDK. SDK усекает дробную часть, а не округляет — то же соглашение, что
 * и у `wadToFixed` в этом репозитории: показанный объём не должен читаться
 * как больший, чем есть на самом деле.
 */
export function fmtBookSize(size: bigint): string {
  const decimals = toNum(size) < 1 ? 5 : 2;
  return formatQty(size, { minDecimals: decimals, maxDecimals: decimals });
}

/**
 * Кумулятив: выше порога сжимается суффиксом, иначе печатается как есть.
 *
 * @remarks Порог и суффиксы (`K`/`M`/…) — поведение `formatQty` c
 * `compact: true` из SDK, своего порога здесь больше нет.
 */
export function fmtBookTotal(total: bigint): string {
  return formatQty(total, { compact: true });
}

/**
 * Ширина полосы глубины в процентах.
 *
 * @remarks Знаменатель — максимум по показанным строкам обеих сторон
 * (`BookSnapshot.maxTotal`): общая шкала и есть то, что делает перевес
 * читаемым. Нулевой максимум означает пустую книгу — полосы нет.
 */
export function barPct(total: bigint, maxTotal: bigint): number {
  if (maxTotal <= 0n) return 0;
  return Math.min(100, Number((total * 100n) / maxTotal));
}

/**
 * Доля бидов в процентах.
 *
 * @remarks `null` приходит, когда сторон нет вовсе; перевеса в этом случае
 * тоже нет, и половина честнее нуля, который читался бы как «все продают».
 */
export function ratioPct(ratio: bigint | null): number {
  if (ratio === null) return 50;
  return Math.round(Number((ratio * 100n) / 10n ** 18n));
}

/** Базовый актив рынка: `ETH-PERP` → `ETH`. Без рынка — пустая строка. */
export function baseSymbolOf(symbol: string | undefined): string {
  return symbol?.split(/[-/]/)[0]?.toUpperCase() ?? "";
}
