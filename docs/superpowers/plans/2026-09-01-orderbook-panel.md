# Панель Order Book / Trades — план реализации (Ф1b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Правая колонка терминала получает панель стакана и ленты сделок по макету — на домене, который уже выпущен в SDK 0.43.0, без собственной доменной арифметики.

**Architecture:** Данные приходят одним значением из `useOrderbook` (`@liq/react`), агрегация и шаги тика — `aggregateBook` / `bookTickOptions` / `tickDecimals` из `@liq/core`. Терминал добавляет только представление: раскладку в слоты фиксированной высоты, форматирование чисел, три режима показа, полосу дисбаланса и клик по уровню. Поведение проверяется e2e tier-1 (компонентных тестов в репозитории нет), чистые функции представления — vitest.

**Tech Stack:** React 19, TypeScript 6, Tailwind v4, radix-ui через shadcn/ui, TanStack Query v5, zustand, Vite 8, vitest 4 (окружение node), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-01-trade-core-design.md`, раздел «Ф1 · Стакан и лента сделок». Ф1a (домен в SDK) закрыта: PR liqcx/monorepo#725, релиз `liq@0.43.0` в оба реестра.

## Global Constraints

- **Ветка:** `feat-cld/orderbook-panel` (уже создана от `origin/main`). PR — **draft**, база `main`, репозиторий `liqu-fi/terminal`. Не `liqcx/terminal`: та копия отстала на месяцы.
- **Доменную логику не писать.** Группировка по шагу, кумулятив, спред, середина, доли сторон — только `aggregateBook`. Набор шагов — только `bookTickOptions`. Число знаков — только `tickDecimals`. Источник книги — только `useOrderbook`. Источник сделок — только `useTradesRestQuery` + `useMarketChannel(marketId, 'trades')`. Любая своя формула над ценами и объёмами — дефект задачи.
- **Импорт SDK — из `@liq/sdk`** (фасад, `export * from '@liqpro/liq-core'` и остальных трёх), кроме React-хуков: они живут в `@liq/react`. Стиль репозитория уже такой.
- **UI — radix через shadcn/ui.** Свои примитивы не писать. Нужные компоненты добавлять `pnpm dlx shadcn@latest add <name>`. **После генерации сверять класс в класс:** сгенерированный компонент приносит чужие умолчания целиком (раскладку `flex/gap/py`, свои цвета) и молча уносит наши; ни один тест этого не ловит. Раскладочные опинии примитива снимать.
- **Словарь токенов.** Цвета — только из `src/styles/tokens.css` (`--long`, `--short`, `--long-soft`, `--short-soft`, `--surface*`, `--border`, `--muted`, `--text`). Появление `bg-primary`, `ring-ring`, `text-foreground` и прочего чужого словаря ловит `src/components/ui/__tests__/vocabulary.test.ts` — он обязан остаться зелёным.
- **Числа — бренд-bigint.** Цены и объёмы не превращаются в `number` для арифметики. `Number()` допустим только на последнем шаге, ради ширины полосы в процентах и вывода на экран.
- **Честные значения.** 503 `ORDERBOOK_UNAVAILABLE` — «книгу никто не ведёт», это не пустая книга. Пустая книга — не ошибка: пул остаётся контрагентом. Отсутствующее значение рисуется прочерком либо не рисуется вовсе; ноль вместо неизвестного запрещён.
- **`data-testid` — контракт.** Новые идентификаторы попадают в снапшот `src/__tests__/__snapshots__/`; снапшот обновляется осознанно (`pnpm test -u`) и проверяется глазами в диффе.
- **Юнит-тесты — только чистые функции**: vitest настроен на `src/**/*.test.ts` в окружении `node`. Компонентных тестов в репозитории нет и эта фаза их не заводит. Поведение панели проверяет e2e tier-1.
- **Комментарии** — TSDoc, по-русски, только там, где логика не самоочевидна: инварианты, «почему», ссылки на смежные файлы. Тип в комментарии не дублировать.
- **Гейт фазы (каждая задача заканчивается зелёным гейтом):**
  ```bash
  pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build && pnpm test:e2e
  ```
  Именно `node_modules/.bin/eslint .`, не `pnpm lint`: последний резолвится в чужой глобальный ESLint 9 из соседней венчуры.
- **Мутационная проверка обязательна.** У каждой задачи есть таблица «что сломать → какой тест обязан покраснеть». Прогнать её до коммита: сломать ветку, убедиться, что падает именно названный тест, вернуть. Зелёный тест на сломанном коде — не тест.

## Карта файлов

| Файл | Ответственность |
| --- | --- |
| `src/features/orderbook/bookView.ts` | Создать. Чистые функции представления: форматирование цены/объёма/кумулятива, раскладка в слоты, ширина полосы, проценты дисбаланса, символ базового актива. Никаких React и никакого домена. |
| `src/features/orderbook/__tests__/bookView.test.ts` | Создать. Юнит-тесты чистых функций. |
| `src/features/orderbook/OrderBookPanel.tsx` | Создать. Оболочка панели: вкладки Book/Trades, тулбар, три состояния книги. |
| `src/features/orderbook/BookGrid.tsx` | Создать. Сетка книги: аски, строка спреда, биды, полоса дисбаланса. |
| `src/features/orderbook/BookRow.tsx` | Создать. Одна строка (или пустой слот) с кумулятивной полосой. |
| `src/features/orderbook/TickSelect.tsx` | Создать. Чип выбора шага на `DropdownMenu`. |
| `src/features/orderbook/TradesTape.tsx` | Создать. Лента сделок: REST-страница плюс живые события. |
| `src/features/orderbook/useBookTick.ts` | Создать. Выбранный шаг с пересчётом при смене рынка/цены. |
| `src/features/orderbook/useTradesTape.ts` | Создать. Склейка REST-страницы и живых событий в один список. |
| `src/components/ui/{tabs,toggle-group,dropdown-menu}.tsx` | Создать через `shadcn add`. |
| `src/features/terminal/Terminal.tsx` | Изменить. Третья колонка верхнего ряда — панель книги. |
| `src/features/trade/TradeForm.tsx` | Изменить. Приём цены из `useTradeStore`: вкладка Limit и значение поля. |
| `src/features/history/HistoryTable.tsx` | Изменить. `useTradesRestQuery` отдаёт страницу, а не массив. |
| `e2e/support/world.ts` | Изменить. Фикстура книги, фрейм SSE, отказ 503. |
| `e2e/support/mockGateway.ts` | Изменить. Маршрут `/markets/:id/orderbook`, форма ответа `/trades`. |
| `e2e/pages/TerminalPanels.ts` | Изменить. Пейдж-обжект панели. |
| `e2e/tier1/20-orderbook.spec.ts` | Создать. Спека книги. |
| `e2e/tier1/21-trades-tape.spec.ts` | Создать. Спека ленты. |

---

## Task 1: Подъём SDK до 0.43.0 и форма страницы сделок

**Files:**
- Modify: `package.json` (уже правлен на ветке, не закоммичен), `pnpm-lock.yaml`
- Modify: `src/features/history/HistoryTable.tsx`
- Modify: `e2e/support/mockGateway.ts` (маршрут `/trades`)

**Interfaces:**
- Consumes: ничего.
- Produces: `@liq/*` версии `^0.43.0` во всём репозитории; `useTradesRestQuery(...).data` типа `TradesPage { rows: TradeRow[]; nextCursor: string | null }` — на эту форму опираются задачи 6.

**Контекст, который нельзя вывести из кода.** В 0.42.0 `client.trades.list` возвращал `TradeRow[]`, в 0.43.0 — `TradesPage`. Потребитель (`HistoryTable`) читает `data` как массив, а мок `/trades` отдаёт голый массив: обе стороны неправы согласованно, поэтому 17 спек зелёные, а против настоящего гейтвея вкладка History показывает «No trades yet» либо падает. Чинить нужно обе стороны сразу — иначе спека истории покраснеет.

- [ ] **Шаг 1: Убедиться, что зависимости уже подняты**

```bash
grep '@liqpro/liq-' package.json      # ожидание: восемь строк с ^0.43.0
node -p "require('./node_modules/@liq/react/package.json').version"   # 0.43.0
```

Если версии ещё 0.42.0 — `sed -i '' 's|liq-\([a-z-]*\)@\^0\.42\.0|liq-\1@^0.43.0|g' package.json && pnpm install`.

- [ ] **Шаг 2: Убедиться, что типы падают ровно в одном месте**

```bash
pnpm typecheck
```

Ожидание: три ошибки, все в `src/features/history/HistoryTable.tsx` (`length`/`map` не существуют на `TradesPage`). Если ошибок больше — их список идёт в отчёт, они часть этой задачи.

- [ ] **Шаг 3: Починить потребителя**

В `src/features/history/HistoryTable.tsx` заменить чтение данных:

```tsx
  const { data } = useTradesRestQuery({ accountId, limit: 50 });
  const trades = data?.rows ?? [];
```

Остальное тело не трогать.

- [ ] **Шаг 4: Починить мок под настоящую форму ответа**

В `e2e/support/mockGateway.ts`, ветка `/trades`:

```ts
      await send(route, { rows: world.trades, nextCursor: null });
```

- [ ] **Шаг 5: Гейт**

```bash
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build
pnpm test:e2e --grep "trade history"
```

Ожидание: все зелёные, включая «renders past fills» — она и есть доказательство, что связка потребитель↔мок снова сходится.

- [ ] **Шаг 6: Мутационная проверка**

| Что сломать | Какой тест обязан покраснеть |
| --- | --- |
| Вернуть в моке `await send(route, world.trades)` | `10-history.spec.ts` → «renders past fills» (строка не отрисуется) |
| Вернуть `data ?? []` вместо `data?.rows ?? []` | `pnpm typecheck` |

- [ ] **Шаг 7: Коммит**

```bash
git add package.json pnpm-lock.yaml src/features/history/HistoryTable.tsx e2e/support/mockGateway.ts
git commit -m "chore(sdk): 0.43.0 — страница сделок вместо массива"
```

---

## Task 2: Чистые функции представления книги

**Files:**
- Create: `src/features/orderbook/bookView.ts`
- Create: `src/features/orderbook/__tests__/bookView.test.ts`

**Interfaces:**
- Consumes: `BookRow`, `Price`, `Qty`, `tickDecimals` из `@liq/sdk`; `wadToFixed`, `toNum` из `@/lib/format`.
- Produces (на это опираются задачи 4 и 6):
  ```ts
  export type Slot = BookRow | null;
  export function padSlots(rows: readonly BookRow[], slots: number, where: "start" | "end"): Slot[];
  export function askSlots(asks: readonly BookRow[], slots: number): Slot[];
  export function bidSlots(bids: readonly BookRow[], slots: number): Slot[];
  export function fmtBookPrice(price: bigint, tick: bigint): string;
  export function fmtBookSize(size: bigint): string;
  export function fmtBookTotal(total: bigint): string;
  export function barPct(total: bigint, maxTotal: bigint): number;
  export function ratioPct(ratio: bigint | null): number;
  export function baseSymbolOf(symbol: string | undefined): string;
  ```

**Почему это отдельный модуль.** Компонентных тестов в репозитории нет, поэтому всё, что можно проверить без DOM, должно жить вне компонентов. Раскладка в слоты и форматирование — именно такое.

- [ ] **Шаг 1: Написать падающие тесты**

`src/features/orderbook/__tests__/bookView.test.ts`:

```ts
import { Price, Qty } from "@liq/sdk";
import { describe, expect, it } from "vitest";

import {
  askSlots,
  barPct,
  baseSymbolOf,
  bidSlots,
  fmtBookPrice,
  fmtBookSize,
  fmtBookTotal,
  padSlots,
  ratioPct,
} from "../bookView";

const row = (price: string, size: string, total: string) => ({
  price: Price.parse(price),
  size: Qty.parse(size),
  total: Qty.parse(total),
});

describe("padSlots", () => {
  it("добивает хвост пустыми слотами", () => {
    const out = padSlots([row("100", "1", "1")], 3, "end");
    expect(out.map((s) => s === null)).toEqual([false, true, true]);
  });

  it("добивает голову пустыми слотами", () => {
    const out = padSlots([row("100", "1", "1")], 3, "start");
    expect(out.map((s) => s === null)).toEqual([true, true, false]);
  });

  it("лишние строки отбрасывает, а не сжимает сетку", () => {
    const rows = [row("103", "1", "1"), row("102", "1", "2"), row("101", "1", "3")];
    expect(padSlots(rows, 2, "end")).toHaveLength(2);
  });
});

describe("askSlots", () => {
  it("лучший аск стоит последним — вплотную к спреду", () => {
    const asks = [row("101", "1", "1"), row("102", "1", "2")];
    const out = askSlots(asks, 3);
    expect(out).toHaveLength(3);
    expect(out[0]).toBeNull();
    expect(out[2]?.price).toBe(Price.parse("101"));
    expect(out[1]?.price).toBe(Price.parse("102"));
  });
});

describe("bidSlots", () => {
  it("лучший бид стоит первым, пустые слоты — снизу", () => {
    const bids = [row("100", "1", "1"), row("99", "1", "2")];
    const out = bidSlots(bids, 3);
    expect(out[0]?.price).toBe(Price.parse("100"));
    expect(out[2]).toBeNull();
  });
});

describe("fmtBookPrice", () => {
  it("печатает ровно столько знаков, сколько различает шаг", () => {
    expect(fmtBookPrice(Price.parse("2445.16"), Price.parse("0.01"))).toBe("2,445.16");
    expect(fmtBookPrice(Price.parse("2445.16"), Price.parse("1"))).toBe("2,445");
  });

  it("шаг в десять знаков не рисует разрядов, которых в группе нет", () => {
    expect(fmtBookPrice(Price.parse("2450"), Price.parse("10"))).toBe("2,450");
  });
});

describe("fmtBookSize", () => {
  it("мелкий объём показывает пятью знаками", () => {
    expect(fmtBookSize(Qty.parse("0.12345"))).toBe("0.12345");
  });

  it("крупный объём — двумя", () => {
    expect(fmtBookSize(Qty.parse("12.3456"))).toBe("12.35");
  });
});

describe("fmtBookTotal", () => {
  it("выше порога сжимает суффиксом", () => {
    expect(fmtBookTotal(Qty.parse("12500"))).toBe("12.5K");
  });

  it("ниже порога печатает как есть", () => {
    expect(fmtBookTotal(Qty.parse("999"))).toBe("999");
  });
});

describe("barPct", () => {
  it("доля кумулятива от максимума показанного", () => {
    expect(barPct(Qty.parse("5"), Qty.parse("20"))).toBe(25);
  });

  it("нулевой максимум не делит на ноль", () => {
    expect(barPct(Qty.parse("5"), Qty.parse("0"))).toBe(0);
  });

  it("больше ста процентов не бывает", () => {
    expect(barPct(Qty.parse("30"), Qty.parse("20"))).toBe(100);
  });
});

describe("ratioPct", () => {
  it("переводит WAD-долю в проценты", () => {
    expect(ratioPct(10n ** 18n / 4n)).toBe(25);
  });

  it("неизвестная доля — половина, а не ноль", () => {
    // `null` приходит на пустой книге: сторон нет, перевеса нет.
    expect(ratioPct(null)).toBe(50);
  });
});

describe("baseSymbolOf", () => {
  it("берёт базовый актив из символа рынка", () => {
    expect(baseSymbolOf("ETH-PERP")).toBe("ETH");
    expect(baseSymbolOf("btc/usd")).toBe("BTC");
  });

  it("без рынка возвращает пустую строку, а не выдуманный тикер", () => {
    expect(baseSymbolOf(undefined)).toBe("");
  });
});
```

- [ ] **Шаг 2: Прогнать — должно упасть на отсутствии модуля**

```bash
pnpm test src/features/orderbook
```

Ожидание: `Cannot find module '../bookView'`.

- [ ] **Шаг 3: Реализовать модуль**

`src/features/orderbook/bookView.ts`:

```ts
import { type BookRow, tickDecimals } from "@liq/sdk";

import { toNum, wadToFixed } from "@/lib/format";

/** Пустой слот сетки: место занято, данных нет. */
export type Slot = BookRow | null;

const COMPACT_FROM = 10_000;

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

/** Цена группы: знаков ровно столько, сколько различает шаг. */
export function fmtBookPrice(price: bigint, tick: bigint): string {
  const decimals = tickDecimals(tick as never);
  return Number(wadToFixed(price, decimals)).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Объём уровня: мелкий показывается подробнее крупного. */
export function fmtBookSize(size: bigint): string {
  const n = toNum(size);
  return n < 1 ? n.toFixed(5) : n.toFixed(2);
}

/** Кумулятив: выше порога сжимается суффиксом, иначе печатается как есть. */
export function fmtBookTotal(total: bigint): string {
  const n = toNum(total);
  return n >= COMPACT_FROM
    ? n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 })
    : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
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
```

Если `Price`/`Qty` из `@liq/sdk` не принимаются `tickDecimals` без приведения — привести один раз в `fmtBookPrice`, как показано, и не тащить `as never` дальше.

**Поправка, внесённая после начала задачи (дефект плана).** Три функции форматирования выше написаны на `Intl` вручную, а в `@liq/core` уже есть `formatPrice` / `formatQty` / `formatWad` / `compactUsd` / `suggestDecimalsFor` с опциями `minDecimals`, `maxDecimals`, `round`, `sign`, `suffix`, `grouping`, `compact` (последний включается выше 10 000 — ровно тот порог, что задан константой). Правило арки — готовое вместо своего, поэтому `fmtBookPrice` = `formatPrice` с `min/maxDecimals = tickDecimals(tick)`, `fmtBookSize` = `formatQty`, `fmtBookTotal` = `formatQty` с `compact: true`. Помнить: SDK по умолчанию **усекает**, а не округляет.

- [ ] **Шаг 4: Прогнать до зелёного**

```bash
pnpm test src/features/orderbook && pnpm typecheck && node_modules/.bin/eslint src/features/orderbook
```

- [ ] **Шаг 5: Мутационная проверка**

| Что сломать | Какой тест обязан покраснеть |
| --- | --- |
| В `askSlots` убрать `.reverse()` | «лучший аск стоит последним» |
| В `askSlots` заменить `"start"` на `"end"` | «лучший аск стоит последним» (первый слот перестанет быть пустым) |
| В `padSlots` убрать `.slice(0, slots)` | «лишние строки отбрасывает» |
| В `barPct` убрать `Math.min(100, …)` | «больше ста процентов не бывает» |
| В `barPct` убрать защиту от нуля | «нулевой максимум не делит на ноль» |
| В `ratioPct` вернуть `0` вместо `50` на `null` | «неизвестная доля — половина» |
| В `fmtBookPrice` захардкодить `decimals = 2` | «шаг в десять знаков не рисует разрядов» |

- [ ] **Шаг 6: Коммит**

```bash
git add src/features/orderbook
git commit -m "feat(orderbook): раскладка и форматирование книги как чистые функции"
```

---

## Task 3: Место в оболочке, каркас панели и три состояния книги

**Files:**
- Create: `src/features/orderbook/OrderBookPanel.tsx`
- Create: `src/components/ui/tabs.tsx` (через `shadcn add`)
- Modify: `src/features/terminal/Terminal.tsx`
- Modify: `e2e/support/world.ts`, `e2e/support/mockGateway.ts`, `e2e/pages/TerminalPanels.ts`
- Create: `e2e/tier1/20-orderbook.spec.ts`
- Modify: `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`

**Interfaces:**
- Consumes: `useOrderbook` (`@liq/react`), `useSelectedMarket`, `useMarkPrice`, `bookTickOptions` (`@liq/sdk`).
- Produces: смонтированная панель с `data-testid="orderbook-panel"`; вкладки `orderbook-tab-book` / `orderbook-tab-trades`; состояния `book-loading` / `book-unavailable` / `book-error` / `book-empty`. Сетку рисует задача 4, ленту — задача 6; здесь на их местах заглушки.

**Три состояния — суть задачи.** `useOrderbook` различает четыре исхода, и показывать их одинаково нельзя: `isLoading` (книги ещё не было), `unavailable` (гейтвей ответил 503 — движка нет, книгу никто не ведёт), `error` (всё остальное — поломка), и пустая живая книга (заявок нет, но контрагентом остаётся пул, торговать можно). Пустую книгу вместо 503 показать — сказать «желающих торговать нет» там, где нет движка.

- [ ] **Шаг 1: Добавить примитив вкладок**

```bash
pnpm dlx shadcn@latest add tabs
```

Затем **сверить класс в класс**: открыть `src/components/ui/tabs.tsx`, выписать каждый класс сгенерированного компонента и убрать всё, чего нет в нашем словаре токенов (`bg-muted`, `text-foreground`, `ring-ring` и подобное) — заменить на наши (`bg-surface-2`, `text-text`, `text-muted`, `border-border`). Раскладочные умолчания (`gap-*`, `p-*` на корне) снять: отступы держит панель.

```bash
pnpm test src/components/ui   # vocabulary.test.ts обязан остаться зелёным
```

- [ ] **Шаг 2: Фикстура книги и маршрут в моке**

В `e2e/support/world.ts` — в `MockWorld` добавить поле и фрейм, в `faults` — отказ:

```ts
  /** Снимок книги для GET /markets/:id/orderbook (WAD-строки). */
  orderbook: {
    bids: Array<{ price: string; size: string }>;
    asks: Array<{ price: string; size: string }>;
    asOf: number;
  };
```

```ts
    orderbookStatus?: number;
```

Дефолт в конструкторе мира — книга вокруг `price`, шагом в один доллар, по три уровня на сторону:

```ts
    orderbook: opts.orderbook ?? defaultBook(price),
```

```ts
/** Сколько уровней на сторону отдаёт мок: хватает и на 10+10, и на 20 в одну сторону. */
const BOOK_LEVELS = 20;

/**
 * Книга вокруг цены, шаг $10.
 *
 * @remarks Шаг выбран не произвольно: при цене мира $70 000 первый шаг из
 * `bookTickOptions` равен 10, и книга с шагом $1 схлопнулась бы в одну строку
 * на сторону — сетка была бы пустой, а спека проверяла бы группировку вместо
 * книги. Уровни ложатся на границы группы один в один: бид 69 990 округляется
 * вниз в 69 990, аск 70 010 вверх в 70 010.
 */
function defaultBook(price: bigint): MockWorld["orderbook"] {
  const step = 10n * WAD;
  const level = (p: bigint, i: number) => ({
    price: p.toString(),
    size: (BigInt(i + 1) * WAD).toString(),
  });
  return {
    bids: Array.from({ length: BOOK_LEVELS }, (_, i) =>
      level(price - BigInt(i + 1) * step, i),
    ),
    asks: Array.from({ length: BOOK_LEVELS }, (_, i) =>
      level(price + BigInt(i + 1) * step, i),
    ),
    asOf: Date.now(),
  };
}
```

Фрейм живого снимка — рядом с `sseCandleFrame`:

```ts
/** Кадр SSE со снимком книги. Форма — `OrderbookSnapshotEvent` из @liq/core. */
export function sseOrderbookFrame(
  marketId: string,
  book: MockWorld["orderbook"],
): string {
  return `data: ${JSON.stringify({
    type: "orderbook_snapshot",
    channel: `orderbook:${marketId}`,
    data: { marketId, bids: book.bids, asks: book.asks, timestamp: book.asOf },
  })}\n\n`;
}
```

Обёртка (`data: `, двойной перевод строки) совпадает с `sseCandleFrame` байт в байт, иначе кадр не разберётся. **Поле времени у REST и у события называется по-разному:** REST-ответ несёт `asOf`, а `OrderbookData` в событии — `timestamp` (проверено по `node_modules/@liq/core/dist/index.d.ts`). Перепутанное имя не сломает разбор — оно молча оставит событие без времени, и свежесть перестанет сравниваться.

В `e2e/support/mockGateway.ts` — маршрут перед общим `/markets`:

```ts
    const book = path.match(/\/markets\/([^/]+)\/orderbook$/);
    if (book) {
      if (world.faults.orderbookStatus) {
        await error(route, world.faults.orderbookStatus, "ORDERBOOK_UNAVAILABLE");
        return;
      }
      await send(route, world.orderbook);
      return;
    }
```

Порядок важен: маршрут `/markets` заканчивается на `endsWith`, поэтому более частный путь обязан стоять выше.

- [ ] **Шаг 3: Написать падающую спеку**

`e2e/tier1/20-orderbook.spec.ts`:

```ts
import { enterTerminal } from "../pages/flows";
import { expect, test } from "../support/fixtures";
import { readyWorld } from "../support/world";

test.describe("order book panel", () => {
  test("панель видна и по умолчанию открыта на книге", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    await expect(book.root).toBeVisible();
    await expect(book.tab("book")).toHaveAttribute("data-state", "active");
  });

  test("503 показывается как «книгу никто не ведёт», а не как пустая книга", async ({
    page,
    world,
  }) => {
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ faults: { orderbookStatus: 503 } }),
    );
    await expect(book.unavailable).toBeVisible();
    await expect(book.empty).toHaveCount(0);
  });

  test("пустая живая книга — не отказ: торгует пул", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ orderbook: { bids: [], asks: [], asOf: Date.now() } }),
    );
    await expect(book.empty).toBeVisible();
    await expect(book.unavailable).toHaveCount(0);
  });
});
```

Пейдж-обжект в `e2e/pages/TerminalPanels.ts`:

```ts
export class OrderBookPanel {
  readonly root: Locator;
  readonly unavailable: Locator;
  readonly empty: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId("orderbook-panel");
    this.unavailable = page.getByTestId("book-unavailable");
    this.empty = page.getByTestId("book-empty");
    this.error = page.getByTestId("book-error");
  }

  tab(name: "book" | "trades"): Locator {
    return this.page.getByTestId(`orderbook-tab-${name}`);
  }

  selectTab(name: "book" | "trades"): Promise<void> {
    return this.tab(name).click();
  }
}
```

`enterTerminal` в `e2e/pages/flows.ts` должен вернуть `book` — добавить поле к возвращаемому объекту рядом с `userInfo`.

- [ ] **Шаг 4: Прогнать — спека обязана упасть на отсутствии панели**

```bash
pnpm test:e2e --grep "order book panel"
```

- [ ] **Шаг 5: Реализовать каркас панели**

`src/features/orderbook/OrderBookPanel.tsx`:

```tsx
import { bookTickOptions } from "@liq/sdk";
import { useOrderbook } from "@liq/react";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useMarkPrice } from "../trade/useMarkPrice";
import { useSelectedMarket } from "../market/useSelectedMarket";

/** Сколько строк на сторону в режиме «обе стороны». */
const SLOTS_BOTH = 10;

export function OrderBookPanel() {
  const { marketId } = useSelectedMarket();
  const markPrice = useMarkPrice();
  const tick = bookTickOptions(markPrice === 0n ? null : (markPrice as never))[0];
  const { book, isLoading, unavailable, error } = useOrderbook(marketId ?? null, {
    tick,
    depth: SLOTS_BOTH,
    markPrice: markPrice === 0n ? undefined : (markPrice as never),
  });

  const isEmpty = book.bids.length === 0 && book.asks.length === 0;

  return (
    <Card
      className="flex h-full flex-col gap-2 p-2"
      data-testid="orderbook-panel"
    >
      <Tabs defaultValue="book" className="flex flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="book" data-testid="orderbook-tab-book">
            Order Book
          </TabsTrigger>
          <TabsTrigger value="trades" data-testid="orderbook-tab-trades">
            Trades
          </TabsTrigger>
        </TabsList>

        <TabsContent value="book" className="flex-1">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted" data-testid="book-loading">
              Loading order book…
            </p>
          ) : unavailable ? (
            <p className="py-6 text-center text-sm text-muted" data-testid="book-unavailable">
              No matching engine is maintaining this book right now.
            </p>
          ) : error ? (
            <p className="py-6 text-center text-sm text-short" data-testid="book-error">
              Order book failed to load.
            </p>
          ) : isEmpty ? (
            <p className="py-6 text-center text-sm text-muted" data-testid="book-empty">
              Book is empty — orders execute against the liquidity pool.
            </p>
          ) : (
            <div data-testid="book-grid-placeholder" />
          )}
        </TabsContent>

        <TabsContent value="trades" className="flex-1">
          <div data-testid="trades-tape-placeholder" />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
```

Порядок ветвей не переставлять: `unavailable` проверяется раньше `error`, потому что 503 — это тоже ошибка REST-затравки, и общая ветка проглотила бы частный случай.

- [ ] **Шаг 6: Вставить колонку в оболочку**

В `src/features/terminal/Terminal.tsx` — третья панель между графиком и формой:

```tsx
                <ResizableHandle withHandle disabled={chartCollapsed} />
                <ResizablePanel
                  id="book-column"
                  defaultSize={chartCollapsed ? "35" : "18"}
                  minSize="14"
                >
                  <OrderBookPanel />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel
                  id="trade-column"
                  defaultSize={chartCollapsed ? "65" : "26"}
                  minSize="20"
                >
                  <TradeForm />
                </ResizablePanel>
```

Ширину графика в развёрнутом состоянии уменьшить с `"70"` до `"56"`. Помнить про `key={chartCollapsed ? … : …}` на группе: размеры читаются только при первой регистрации панели, поэтому обе раскладки задаются через один и тот же перемонтируемый узел.

- [ ] **Шаг 7: Обновить снапшот идентификаторов**

```bash
pnpm test -u src/__tests__/testid-inventory.test.ts
git diff src/__tests__/__snapshots__   # прочитать глазами: только новые book-* и orderbook-*
```

- [ ] **Шаг 8: Гейт**

```bash
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build && pnpm test:e2e
```

Спека `19-layout.spec.ts` обязана остаться зелёной: она проверяет свёртку графика и фуллскрин нижней панели, а мы правили ровно эту раскладку.

- [ ] **Шаг 9: Мутационная проверка**

| Что сломать | Какой тест обязан покраснеть |
| --- | --- |
| Поменять местами ветки `unavailable` и `error` | «503 показывается как „книгу никто не ведёт“» |
| Показывать `book-empty` вместо `book-unavailable` при 503 | она же |
| Убрать маршрут `/orderbook` из мока (пусть отвечает общий `/markets`) | «панель видна и по умолчанию открыта на книге» либо «пустая живая книга» |
| Поставить маршрут `/orderbook` ниже `endsWith("/markets")` | те же |

- [ ] **Шаг 10: Коммит**

```bash
git add src e2e
git commit -m "feat(orderbook): панель в оболочке терминала и четыре ответа книги"
```

---

## Task 4: Сетка книги — строки, полосы, спред, шаг тика, три режима

**Files:**
- Create: `src/features/orderbook/BookGrid.tsx`, `src/features/orderbook/BookRow.tsx`, `src/features/orderbook/TickSelect.tsx`, `src/features/orderbook/useBookTick.ts`
- Create: `src/components/ui/toggle-group.tsx`, `src/components/ui/dropdown-menu.tsx` (через `shadcn add`)
- Modify: `src/features/orderbook/OrderBookPanel.tsx`
- Modify: `e2e/pages/TerminalPanels.ts`, `e2e/tier1/20-orderbook.spec.ts`

**Interfaces:**
- Consumes: всё из задачи 2 (`askSlots`, `bidSlots`, `fmtBook*`, `barPct`, `ratioPct`, `baseSymbolOf`), каркас из задачи 3, `sseOrderbookFrame` из задачи 3 (объявлен, но до этой задачи никем не вызывался — живая ветка `useOrderbook` без него не покрыта вовсе).
- Produces: `data-testid` — `book-view-{both|bids|asks}`, `book-tick-select`, `book-tick-option-*`, `book-ask-*`, `book-bid-*`, `book-spread`, `book-imbalance`, `book-imbalance-bid`, `book-imbalance-ask`. Клик по строке подключается задачей 5.

**Что здесь легко сделать неправильно.**
1. **Спред и середина считаются от сырых цен, а не от цен групп.** Это уже сделано внутри `aggregateBook`; терминалу достаточно взять `book.spread` и `book.spreadRatio` и ничего не пересчитывать. Своя разница `asks[0].price − bids[0].price` даст на BTC при шаге 10 спред «10» вместо настоящих 0,1.
2. **Полоса дисбаланса считается по всей книге, а не по показанному срезу** — `book.bidShare` уже такой. Но REST отдаёт всю книгу, а живой канал — 50 уровней на сторону, поэтому при переходе с затравки на подписку доля может заметно сдвинуться. Это не дефект, а разный охват; подписать полосу `title`, объяснив, по чему она считается.
3. **Число слотов и глубина запроса — одно и то же число.** В режиме одной стороны показываются 20 строк, значит и `depth` в `useOrderbook` меняется на 20, иначе половина сетки всегда пустая.

- [ ] **Шаг 1: Добавить примитивы**

```bash
pnpm dlx shadcn@latest add toggle-group dropdown-menu
```

Сверить класс в класс так же, как в задаче 3, и прогнать `pnpm test src/components/ui`.

- [ ] **Шаг 2: Расширить спеку — сначала падающие проверки**

Дописать в `e2e/tier1/20-orderbook.spec.ts`:

```ts
  test("книга рисует обе стороны, лучший аск — вплотную к спреду", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    await expect(book.asks).toHaveCount(10);
    await expect(book.bids).toHaveCount(10);
    // мир отдаёт 20 уровней на сторону шагом $10 вокруг $70 000; шаг группировки
    // по умолчанию — тоже 10, поэтому уровни видны как есть
    await expect(book.bidRow(0)).toContainText("69,990");
    await expect(book.askRow(9)).toContainText("70,010");
  });

  test("строка спреда показывает величину и долю", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    // лучший бид 69 990, лучший аск 70 010 — спред ровно 20, а не ширина группы
    await expect(book.spread).toContainText("20");
    await expect(book.spread).toContainText("%");
  });

  test("режим «только биды» убирает аски и удваивает число строк", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    await book.setView("bids");
    await expect(book.asks).toHaveCount(0);
    await expect(book.bids).toHaveCount(20);
  });

  test("смена шага перегруппировывает книгу", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    await expect(book.bidRow(0)).toContainText("69,990");
    await book.selectTick(1); // шаг 100: три верхних бида схлопываются в 69,900
    await expect(book.bidRow(0)).toContainText("69,900");
  });

  test("живой снимок книги вытесняет затравку", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    await expect(book.bidRow(0)).toContainText("69,990");

    // Тот же рынок, книга сдвинута на $100 вверх. Событие обязано победить
    // затравку по времени: `useOrderbook` берёт не последнего пришедшего, а
    // того, чья отметка свежее.
    world.sseFrames = [
      sseOrderbookFrame("200", {
        bids: [{ price: (70_100n * WAD).toString(), size: WAD.toString() }],
        asks: [{ price: (70_200n * WAD).toString(), size: WAD.toString() }],
        asOf: Date.now() + 1000,
      }),
    ];

    await expect(book.bidRow(0)).toContainText("70,100", { timeout: 15_000 });
  });

  test("полоса дисбаланса показывает перевес сторон", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    await expect(book.imbalance).toBeVisible();
    await expect(book.imbalance).toContainText("%");
  });
```

Дополнить пейдж-обжект:

```ts
  readonly asks: Locator;
  readonly bids: Locator;
  readonly spread: Locator;
  readonly imbalance: Locator;
  // …
  askRow(i: number): Locator { return this.page.getByTestId(`book-ask-${i}`); }
  bidRow(i: number): Locator { return this.page.getByTestId(`book-bid-${i}`); }
  setView(v: "both" | "bids" | "asks"): Promise<void> {
    return this.page.getByTestId(`book-view-${v}`).click();
  }
  async selectTick(index: number): Promise<void> {
    await this.page.getByTestId("book-tick-select").click();
    await this.page.getByTestId(`book-tick-option-${index}`).click();
  }
```

`asks`/`bids` — коллекции: `page.locator('[data-testid^="book-ask-"]')`. Считать в них только непустые строки: пустой слот получает `data-testid` **не** из этого пространства (например `book-slot-empty`), иначе `toHaveCount` считает сетку, а не книгу.

- [ ] **Шаг 3: Реализовать выбор шага**

`src/features/orderbook/useBookTick.ts`:

```ts
import { bookTickOptions } from "@liq/sdk";
import { useEffect, useMemo, useState } from "react";

/**
 * Выбранный шаг группировки.
 *
 * @remarks Набор шагов зависит от цены рынка, поэтому при переезде на другой
 * рынок прежний выбор может исчезнуть из списка. Тогда берётся самый мелкий
 * шаг нового набора: молча оставленный чужой шаг показывал бы книгу, которой
 * на этом рынке не бывает.
 */
export function useBookTick(price: bigint) {
  const options = useMemo(
    () => bookTickOptions(price === 0n ? null : (price as never)),
    [price],
  );
  const [tick, setTick] = useState<bigint>(() => options[0]);

  useEffect(() => {
    if (!options.some((o) => o === tick)) setTick(options[0]);
  }, [options, tick]);

  return { tick, setTick, options };
}
```

`TickSelect.tsx` — чип на `DropdownMenu`: триггер `data-testid="book-tick-select"` печатает текущий шаг через `Price.fmt`, пункты — `data-testid={`book-tick-option-${i}`}`.

- [ ] **Шаг 4: Реализовать строку и сетку**

`BookRow.tsx` принимает `slot: Slot`, `side: "bid" | "ask"`, `tick`, `maxTotal`, `testid`. Пустой слот рисует `<div data-testid="book-slot-empty" aria-hidden />` фиксированной высоты. Непустой — три ячейки (цена слева, размер и кумулятив справа) и полосу глубины: абсолютный `span`, прижатый к правому краю, `style={{ width: `${barPct(slot.total, maxTotal)}%` }}`, фон `bg-[var(--long-soft)]` либо `bg-[var(--short-soft)]`. Цена — `text-long` / `text-short`.

`BookGrid.tsx` собирает: заголовки колонок `Price (USD)` / `Size ({base})` / `Total ({base})`, аски (`askSlots`), строку спреда, биды (`bidSlots`), полосу дисбаланса.

**Заголовок цены — `USD`, а не `USDT` с макета:** контур торгует sUSD, тикера котируемой валюты в конфигурации SDK нет, а перенесённый с картинки `USDT` был бы утверждением о валюте, которого никто не проверял.

Строка спреда:

```tsx
      <div className="flex items-center justify-between px-1 py-1 text-xs" data-testid="book-spread">
        <span className="text-sm text-text">{markPrice > 0n ? fmtPrice(markPrice) : "—"}</span>
        <span className="text-muted">
          {book.spread === null
            ? "Spread —"
            : `Spread ${fmtBookPrice(book.spread, tick)} (${ratioPct(book.spreadRatio) }%)`}
        </span>
      </div>
```

`book.spread === null` — односторонняя книга: спреда не существует, и ноль вместо него читался бы как «нулевой спред».

Долю печатать **`formatRatio` из SDK**, а не своим делением: `formatRatio(book.spreadRatio, { maxDecimals: 3 })` даёт `0.029%` вместе со знаком процента (проверено: `ratioOf(20, 70000)` → `0.029%`, `formatRatio(WAD/2)` → `50.00%`). Округление до целого процента через `ratioPct` здесь не годится — типичный спред 0,03% превратился бы в ноль.

Заодно в этой задаче убрать мёртвый `Math.round` в `ratioPct`: он стоит поверх целочисленного деления и ничего не округляет, но выглядит так, будто округляет. Либо считать долю в сотых и округлять по-настоящему, либо убрать вызов и сказать в TSDoc, что доля усекается. Тест на `ratioPct` дополнить случаем, который отличает усечение от округления (например, доля 0,259 → 25 при усечении и 26 при округлении).

Полоса дисбаланса:

```tsx
      <div
        className="mt-1 flex h-4 items-center gap-1 text-[10px]"
        data-testid="book-imbalance"
        title="Share of resting size on each side of the whole received book"
      >
        <span className="text-long" data-testid="book-imbalance-bid">{bidPct}%</span>
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full">
          <div className="bg-[var(--long)]" style={{ width: `${bidPct}%` }} />
          <div className="flex-1 bg-[var(--short)]" />
        </div>
        <span className="text-short" data-testid="book-imbalance-ask">{100 - bidPct}%</span>
      </div>
```

- [ ] **Шаг 5: Подключить режимы в панели**

В `OrderBookPanel` — `ToggleGroup` из трёх кнопок (`book-view-both|bids|asks`, `aria-pressed` даёт сам примитив), состояние `view` локальным `useState`. Число слотов: `view === "both" ? 10 : 20`, и это же значение уходит в `depth` вызова `useOrderbook`. Шаг — из `useBookTick(markPrice)`.

- [ ] **Шаг 6: Гейт и снапшот идентификаторов**

```bash
pnpm test -u src/__tests__/testid-inventory.test.ts
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build && pnpm test:e2e
```

- [ ] **Шаг 7: Мутационная проверка**

| Что сломать | Какой тест обязан покраснеть |
| --- | --- |
| Считать спред как `asks[0].price - bids[0].price` вместо `book.spread` | «строка спреда показывает величину и долю» — при шаге, крупнее спреда, значение изменится; если тест не падает, он проверяет наличие текста, а не число, и его нужно ужесточить до конкретной величины |
| В режиме одной стороны оставить `depth: 10` | «режим „только биды“ … удваивает число строк» |
| Не менять `depth` при смене шага (оставить прежний массив) | «смена шага перегруппировывает книгу» |
| Взять `bidShare` по показанному срезу вместо `book.bidShare` | ни один — это осознанно непокрытая точка; отметить в отчёте |
| Убрать разворот асков (`askSlots`) | юнит «лучший аск стоит последним» из задачи 2 + e2e «лучший аск вплотную к спреду» |
| Передать в `sseOrderbookFrame` поле `asOf` вместо `timestamp` | «живой снимок книги вытесняет затравку» |

- [ ] **Шаг 8: Коммит**

```bash
git add src e2e
git commit -m "feat(orderbook): сетка книги, шаг группировки, режимы и дисбаланс"
```

---

## Task 5: Клик по уровню кладёт цену в тикет

**Files:**
- Modify: `src/features/orderbook/BookRow.tsx`, `src/features/orderbook/BookGrid.tsx`
- Modify: `src/features/trade/TradeForm.tsx`
- Modify: `e2e/tier1/20-orderbook.spec.ts`, `e2e/pages/TerminalPanels.ts`

**Interfaces:**
- Consumes: `useTradeStore` (`@liq/react`), сетку из задачи 4, `TradePanel` из `e2e/pages/TerminalPanels.ts`.
- Produces: ничего для следующих задач.

**Контекст, которого нет в коде.** Спека говорит «клик по уровню кладёт цену в `useTradeStore`». Проверено: **`useTradeStore` сегодня не читает никто** — `TradeForm` держит вкладку и цену в локальном `useState`, а стор упомянут только в комментарии. Записать цену в стор и на этом остановиться — значит сделать клик, которого не видно нигде, кроме самого стора: ровно тот случай, когда тест зеленеет на неработающей функции. Поэтому задача включает мост: `TradeForm` начинает слушать стор.

Мост односторонний. Локальная строка ввода остаётся буфером редактирования (`DecimalInput` хранит незавершённый ввод вроде `"2445."`, который не переживёт конвертацию в `Price` и обратно). Подписка идёт через ванильный `useTradeStore.subscribe`, а не через селектор: повторный клик по той же цене не меняет значение, селектор бы промолчал, и второй клик после ручной правки поля выглядел бы сломанным.

- [ ] **Шаг 1: Дописать падающую спеку**

```ts
  test("клик по биду переносит цену в тикет", async ({ page, world }) => {
    const { book, trade } = await enterTerminal(page, world);
    const price = (await book.bidRow(0).innerText()).split("\n")[0];
    await book.bidRow(0).click();
    await expect(trade.tab("Limit")).toHaveAttribute("aria-pressed", "true");
    await expect(trade.limitPriceInput).toHaveValue(price.replace(/,/g, ""));
  });

  test("повторный клик после ручной правки возвращает цену уровня", async ({ page, world }) => {
    const { book, trade } = await enterTerminal(page, world);
    await book.bidRow(0).click();
    await trade.setLimitPrice("1");
    await book.bidRow(0).click();
    await expect(trade.limitPriceInput).not.toHaveValue("1");
  });
```

Вторая проверка — про подписку: с обычным `useEffect` на значении она красная.

- [ ] **Шаг 2: Прогнать, убедиться в падении**

```bash
pnpm test:e2e --grep "переносит цену|повторный клик"
```

- [ ] **Шаг 3: Сделать строку кликабельной**

`BookRow` получает `onPick?: (price: bigint) => void`; непустая строка становится `<button type="button">` во всю ширину (пустой слот — нет). `BookGrid` передаёт обработчик, который зовёт стор:

```ts
  const setOrderType = useTradeStore((s) => s.setOrderType);
  const setLimitPrice = useTradeStore((s) => s.setLimitPrice);

  const pick = (price: bigint) => {
    // Порядок обязателен: `setOrderType` перетирает `limitPrice`.
    setOrderType(OrderType.LIMIT);
    setLimitPrice(price as never);
  };
```

- [ ] **Шаг 4: Мост в тикете**

В `TradeForm`:

```tsx
  // Стор — канал, по которому книга передаёт выбранный уровень. Подписка
  // ванильная, а не через селектор: клик по той же цене второй раз не меняет
  // значение, и селектор бы промолчал — а поле к тому времени могло быть
  // отредактировано руками.
  useEffect(
    () =>
      useTradeStore.subscribe((s) => {
        if (s.limitPrice === null || s.limitPrice === undefined) return;
        setTab("Limit");
        setLimitPrice(Price.fmt(s.limitPrice));
      }),
    [],
  );
```

`Price.fmt` даёт строку без разделителей групп — именно её ждёт `DecimalInput`. Если `fmt` печатает больше знаков, чем `maxDecimals={2}` у поля, обрезать до двух знаков **на входе в поле**, а не в сторе.

- [ ] **Шаг 5: Гейт**

```bash
pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build && pnpm test:e2e
```

Особое внимание спекам 04–07, 14, 17: они торгуют через эту форму.

- [ ] **Шаг 6: Мутационная проверка**

| Что сломать | Какой тест обязан покраснеть |
| --- | --- |
| Заменить `subscribe` на `useEffect` по значению `limitPrice` | «повторный клик после ручной правки» |
| Убрать `setOrderType(LIMIT)` из `pick` | «клик по биду переносит цену в тикет» (вкладка останется Market) |
| Поменять порядок: сначала `setLimitPrice`, потом `setOrderType` | она же (`setOrderType` затрёт цену) |
| Сделать кликабельным пустой слот | ни один — добавить проверку `book-slot-empty` без роли `button` |

- [ ] **Шаг 7: Коммит**

```bash
git add src e2e
git commit -m "feat(orderbook): уровень книги кладёт цену в тикет"
```

---

## Task 6: Вкладка Trades — лента сделок

**Files:**
- Create: `src/features/orderbook/TradesTape.tsx`, `src/features/orderbook/useTradesTape.ts`
- Modify: `src/features/orderbook/bookView.ts` (+ тест) — форматирование времени
- Modify: `src/features/orderbook/OrderBookPanel.tsx`
- Create: `e2e/tier1/21-trades-tape.spec.ts`
- Modify: `e2e/pages/TerminalPanels.ts`, `e2e/support/world.ts`

**Interfaces:**
- Consumes: `useTradesRestQuery` (форма `TradesPage` из задачи 1), `useMarketChannel(marketId, 'trades')`, каркас вкладок из задачи 3.
- Produces: ничего для следующих задач.

**Главное ограничение — живое событие беднее REST-строки.** `TradeEventData` несёт только `marketId`, `price`, `size`, `side`, `timestamp`: ни `id`, ни счетов, ни `txHash`. Значит:
- ключ строки для живых событий синтетический (`live-${timestamp}-${price}`), а не выдуманный `id`;
- ссылки на explorer у живой строки нет — ячейка пустая, а не с прочерком-ссылкой в никуда;
- Maker/Taker в ленте не показывается вовсе. В эталоне его тоже нет: роль различает только таблица истории аккаунта, где к строке привязан `accountId`. Подставить сюда «Taker» по умолчанию — значит утверждать то, чего событие не сообщает.

**Дедупликация.** REST-страница обновляется раз в 15 секунд (`staleTime`), живые события приходят раньше и тем же сделкам. Совпадения по `id` нет, поэтому правило простое: живой буфер держит только события **строго новее** самой свежей REST-строки; как только страница догоняет, дубликат уходит сам.

- [ ] **Шаг 1: Написать падающую спеку**

`e2e/tier1/21-trades-tape.spec.ts`:

```ts
test.describe("trades tape", () => {
  test("вкладка показывает сделки рынка", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [tradeFixture()] }),
    );
    await book.selectTab("trades");
    await expect(book.tapeRows).toHaveCount(1);
    await expect(book.tapeRows.first()).toContainText("70,000");
  });

  test("живое событие встаёт наверх ленты", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [tradeFixture()] }),
    );
    await book.selectTab("trades");
    world.sseFrames = [sseTradeFrame("200", { price: "70500", size: "1", side: "SELL" })];
    await expect(book.tapeRows.first()).toContainText("70,500", { timeout: 15_000 });
  });

  test("у живой строки нет ссылки на транзакцию", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    await book.selectTab("trades");
    world.sseFrames = [sseTradeFrame("200", { price: "70500", size: "1", side: "BUY" })];
    await expect(book.tapeRows.first()).toBeVisible({ timeout: 15_000 });
    await expect(book.tapeRows.first().locator("a")).toHaveCount(0);
  });

  test("пустая лента говорит об этом словами", async ({ page, world }) => {
    const { book } = await enterTerminal(page, world);
    await book.selectTab("trades");
    await expect(book.tapeEmpty).toBeVisible();
  });
});
```

`sseTradeFrame` добавить в `e2e/support/world.ts` по образцу `sseOrderbookFrame`; форма события — `{ type: "trade", channel: `trades:${marketId}`, data: { marketId, price, size, side, timestamp } }`; точные `type`/`channel` сверить с `TradeEvent` в `node_modules/@liq/core/dist/index.d.ts` — угаданное имя канала гейтвей и SDK просто не разберут.

- [ ] **Шаг 2: Реализовать склейку**

`useTradesTape.ts`: REST-страница (`useTradesRestQuery({ marketId, limit: 50 })`) плюс буфер живых событий в `useRef`/`useState`, отфильтрованный по `timestamp > rows[0]?.timestamp`. Возвращает `{ rows: TapeRow[]; isLoading: boolean }`, где

```ts
export interface TapeRow {
  key: string;
  timestamp: number;
  price: bigint;
  size: bigint;
  side: "BUY" | "SELL";
  txHash: string | null;
}
```

- [ ] **Шаг 3: Реализовать вид**

`TradesTape.tsx`: три колонки — Price (цвет по стороне), Size, Time; ссылка на explorer, только если `txHash !== null` **и** `getChainConfig().blockExplorer` задан (поле необязательное). Пустая лента — `data-testid="tape-empty"`, текст «No trades yet.». Число слотов — 15, добивается тем же `padSlots`.

- [ ] **Шаг 4: Гейт, снапшот, мутационная проверка**

| Что сломать | Какой тест обязан покраснеть |
| --- | --- |
| Класть живые события в конец списка | «живое событие встаёт наверх ленты» |
| Убрать фильтр по `timestamp` (пускать все живые события) | ни один из написанных — добавить проверку: событие с временем старее REST-строки не появляется |
| Печатать ссылку на explorer при `txHash === null` | «у живой строки нет ссылки на транзакцию» |
| Подставить `role: "taker"` живой строке | ни один — роль в ленте не показывается вовсе; проверить глазами |

- [ ] **Шаг 5: Коммит**

```bash
git add src e2e
git commit -m "feat(orderbook): лента сделок — REST-страница и живые события"
```

---

## Что эта фаза сознательно не делает

- **Виртуализация.** Спека называет её в перечне Ф1, но панель по макету показывает фиксированное окно в 10+10 (либо 20) строк, а не прокручиваемую книгу целиком. Виртуализировать двадцать строк нечего. Если продукт захочет глубокую прокручиваемую книгу — это `@tanstack/react-virtual` поверх готовой сетки, отдельной картой.
- **Диапазонный hover с тултипом «Avg. Price / Qty / Total».** Есть в эталоне, нет ни в спеке Ф1, ни в макете.
- **Крупная цена со стрелкой направления в строке спреда** взята из макета, но стрелка требует направления последней сделки; в этой фазе рисуется цена марки без стрелки. Стрелку добавит Ф4 вместе с шапкой рынка.
- **Компакт-режим панели** (свёрнутая книга с одной строкой mid) — в макете отсутствует.

## Self-Review

**Покрытие спеки.** «Селектор шага тика» — задача 4; «три режима отображения» — задача 4; «спред» — задача 4; «кумулятивные бары» — задачи 2 и 4; «полоса 50/50» — задача 4; «клик по уровню кладёт цену в `useTradeStore`» — задача 5; «лента сделок» — задача 6; «подъём зависимости SDK» — задача 1; «`mockGateway` расширяется ручкой `orderbook`» — задача 3, ручка `trades` уже есть и чинится в задаче 1. «Виртуализация» — не делается, причина названа выше.

**Согласованность имён.** `Slot`, `padSlots`, `askSlots`, `bidSlots`, `fmtBookPrice`, `fmtBookSize`, `fmtBookTotal`, `barPct`, `ratioPct`, `baseSymbolOf` объявлены в задаче 2 и используются под теми же именами в задачах 4 и 6. `data-testid` из задачи 3 (`orderbook-panel`, `orderbook-tab-*`, `book-unavailable`, `book-empty`) используются пейдж-обжектом задач 4–6 без переименований.

**Заглушки.** `book-grid-placeholder` и `trades-tape-placeholder` из задачи 3 обязаны исчезнуть в задачах 4 и 6 соответственно; если они остались в снапшоте идентификаторов после задачи 6 — это незакрытый хвост, а не безобидный мусор.
