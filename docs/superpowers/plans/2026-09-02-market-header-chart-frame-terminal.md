# Ф4 · Шапка, выбор рынка, вкладки рынков, рамка чарта

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Верх терминала приходит к макету: шапка рынка с пятью показателями, `Command`-поиск
рынка с избранным, полоса вкладок открытых рынков и функциональная рамка чарта (интервал, окно,
`%`/`log`/`auto`).

**Architecture:** Ни одного нового вычисления в терминале. Показатели шапки берутся из
`useMarketsFullRestQuery` (`dynamic.openInterest`, `volume24h`) и `markets.getFunding`; изменение за
сутки считается из оракульного ряда свечей одним чистым `changeFromBars`; чарт переходит с
локальной обёртки над `client.candles` на `useCandles` из `@liq/react`, а «влезает ли окно в
маршрут» решает `maxBarsPerRequest` из `@liq/core`. Состояние экрана (избранное, открытые вкладки,
интервал, окно, режим шкалы) живёт в `useTerminalUiStore` под `persist` — это настройка рабочего
места, не данные.

**Tech Stack:** React 19, TypeScript, `@tanstack/react-query`, zustand, radix-ui + shadcn/ui
(`command` на `cmdk`, `popover`), `lightweight-charts` 5, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-trade-core-design.md` (раздел «Ф4 · Шапка, выбор
рынка, вкладки рынков, рамка чарта»).

## Global Constraints

- **Прочерк там, где данных нет.** `DASH = "—"` из `src/lib/format.ts`. Подставленный ноль
  читается как измеренная величина. Это касается `openInterest === null`, `volume24h === undefined |
  null`, `currentFundingRate === null`, рыночной капитализации и спотовой цены.
- **Словарь токенов.** Только `bg-surface`, `bg-surface-2`, `text-text`, `text-muted`,
  `text-accent`, `text-long`, `text-short`, `border-border`, `bg-long-soft`, `bg-short-soft`. Имена
  shadcn (`primary`, `secondary`, `destructive`, `background`, `foreground`, `input`, `popover`,
  `card`, `ring`) запрещены и проверяются `src/components/ui/__tests__/vocabulary.test.ts`, который
  читает **все** файлы `src/components/ui/*.tsx` через `readdirSync`.
- **`data-testid` — инвариант.** Существующие идентификаторы переносятся без переименования:
  `market-header`, `market-price`, `funding-rate`, `available-margin`, `open-deposit-button`,
  `open-withdraw-button`, `chart-panel`, `chart-collapse-toggle`. Новый идентификатор — только у
  нового блока, и каждый требует `pnpm test -u` (снапшот `src/__tests__/testid-inventory.test.ts`).
- **Логика — в `liq-*`.** Ничего, что уже есть в SDK, в терминале не переписывается:
  `useCandles`, `maxBarsPerRequest`, `intervalSeconds`, `ORACLE_INTERVALS`, `compactUsd`,
  `useMarketsFullRestQuery`.
- **UI — radix через shadcn/ui.** Свои примитивы не пишутся.
- **Гейт фазы:** `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build &&
  pnpm test:e2e`. `pnpm lint` использовать **нельзя** — он резолвится в чужой глобальный ESLint 9.
- **Каталог.** Каждая команда выполняется из `/Users/alex/Work/perps/terminal`; shell сбрасывает
  cwd между вызовами.

## Что макет просит, а источника нет

Разобрано до начала работы, потому что каждое из этих мест иначе тихо получит правдоподобное
число вместо честного прочерка.

| Место макета | Почему источника нет | Что рисуется |
| --- | --- | --- |
| Countdown фандинга (`06:03:12`) | Synthetix V3 начисляет фандинг **непрерывно**, эпох нет; `FundingSnapshot` не несёт момента следующего списания и нести не может | Ячейка называется `Funding Rate`, показывает суточную ставку; отсчёта нет вовсе, а тултип объясняет почему |
| Spot Price | Спотового рынка у контура нет, а `indexPrice` и цена из `usePricesQuery` — один и тот же фид Pyth. Показать одно число под двумя подписями значит заявить два независимых измерения | `DASH` + тултип |
| Market Cap в списке рынков | Нужен circulating supply; его нет ни в шлюзе, ни в SDK | `DASH` |
| Иконка токена | Источника иконок в репозитории нет; хардкод-карта символов молча промахнётся на новом рынке | Монограмма из первой буквы базового актива |
| Интервал `1s` | Минимальный интервал обоих маршрутов — `1m` | Кнопки нет |
| Плечо в бейдже (`20x`) | `MarketSummary.maxLeverage` **не приходит** с `GET /markets` (задокументировано в SDK), а `?? 25` в тикете выдаёт выдуманное число за конфигурацию рынка | Считается из `initialMarginBps` полного списка: `10000 / initialMarginBps`; при отсутствии — `DASH` |

Отсюда решение о `Deposit` / `Withdraw` / `margin` в шапке: макет это место оставляет пустым, но
три спеки tier-1 ходят по `available-margin`, `open-deposit-button`, `open-withdraw-button`.
Инвариант `data-testid` сильнее пустого места на картинке — блок остаётся у правого края шапки.

## File Structure

**Создаются:**

- `src/components/ui/command.tsx`, `src/components/ui/popover.tsx` — примитивы shadcn.
- `src/features/market/useDailyChange.ts` — `changeFromBars` (чистая) + хук.
- `src/features/market/useMarketRows.ts` — `marketRow` (чистая) + хук списка рынков.
- `src/features/market/MarketSearch.tsx` — поиск рынка в `Popover` + `Command`.
- `src/features/market/MarketTabs.tsx` — полоса вкладок и переключатель `%`/`$`.
- `src/features/market/MarketStat.tsx` — одна ячейка показателя шапки.
- `src/features/chart/chartRanges.ts` — окна, `barsForRange`, `fitInterval` (чистые).
- `src/features/chart/ChartFrame.tsx` — рамка: интервал, окно, шкала.
- Тесты: `src/features/market/__tests__/dailyChange.test.ts`,
  `src/features/market/__tests__/marketRow.test.ts`,
  `src/features/chart/__tests__/chartRanges.test.ts`.
- e2e: `e2e/tier1/25-market-search.spec.ts`, `e2e/tier1/26-market-tabs.spec.ts`,
  `e2e/tier1/27-chart-frame.spec.ts`, `e2e/tier2/live-market-header.live.spec.ts`.

**Меняются:**

- `src/stores/useTerminalUiStore.ts` — избранное, вкладки, единица изменения, настройки чарта.
- `src/features/market/MarketHeader.tsx` — переписывается по макету.
- `src/features/chart/CandleChart.tsx` — на `useCandles` из SDK, с интервалом и шкалой.
- `src/features/chart/candleMapping.ts` — тип `CandleBar` вместо `ExchangeCandle`.
- `src/features/terminal/Terminal.tsx` — `MarketTabs` над шапкой, `ChartFrame` вместо `CandleChart`.
- `e2e/support/world.ts`, `e2e/support/mockGateway.ts` — `dynamic`, `volume24h`, оракульные свечи.
- `e2e/pages/TerminalPanels.ts`, `e2e/tier1/02-market-data.spec.ts`, `e2e/tier1/12-errors.spec.ts`.

**Удаляются:**

- `src/features/market/MarketSelect.tsx` — заменён поиском.
- `src/features/chart/useCandles.ts` — заменён хуком SDK.

---

### Задача 1: Примитивы `command` и `popover`

**Files:**

- Create: `src/components/ui/command.tsx`, `src/components/ui/popover.tsx`
- Modify: `package.json`

**Interfaces:**

- Produces: `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`;
  `Popover`, `PopoverTrigger`, `PopoverContent`.

- [ ] **Шаг 1: Поставить примитивы через CLI shadcn**

```bash
pnpm dlx shadcn@latest add command popover
```

CLI поставит `cmdk` и создаст оба файла в `src/components/ui/`. Если он попросит подтверждения
перезаписи — отказаться от всего, кроме этих двух файлов.

- [ ] **Шаг 2: Перевести словарь токенов**

Открыть оба файла и заменить каждое имя shadcn на терминальное. Соответствия:
`bg-popover` → `bg-surface`, `text-popover-foreground` → `text-text`,
`bg-background` → `bg-surface`, `text-foreground` → `text-text`,
`text-muted-foreground` → `text-muted`, `bg-accent` → `bg-surface-2`,
`text-accent-foreground` → `text-text`, `border-input` → `border-border`,
`ring-ring` / `ring-offset-background` → убрать кольцо целиком (в терминале его нет ни у одного
примитива), `data-[selected=true]:bg-accent` → `data-[selected=true]:bg-surface-2`.

В начало каждого файла добавить комментарий, объясняющий перевод, — так же как это сделано в
`src/components/ui/table.tsx`.

- [ ] **Шаг 3: Проверить словарь**

Run: `pnpm test src/components/ui/__tests__/vocabulary.test.ts`
Expected: PASS. Тест читает каталог целиком, поэтому два новых файла попадают в него сами.

- [ ] **Шаг 4: Гейт и коммит**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test`

```bash
git add package.json pnpm-lock.yaml src/components/ui/command.tsx src/components/ui/popover.tsx
git commit -m "feat(ui): примитивы command и popover (Ф4, задача 1)"
```

---

### Задача 2: Состояние экрана — избранное, вкладки, настройки чарта

**Files:**

- Modify: `src/stores/useTerminalUiStore.ts`
- Modify: `src/stores/__tests__/useTerminalUiStore.test.ts`

**Interfaces:**

- Produces: поля `favoriteMarkets`, `openMarkets`, `changeUnit`, `chartInterval`, `chartRange`,
  `chartScaleMode`, `chartAutoScale` и действия `toggleFavorite`, `openMarket`, `closeMarket`,
  `setChangeUnit`, `setChartInterval`, `setChartRange`, `setChartScaleMode`, `toggleAutoScale`.
- Consumes: `ChartRangeKey` из задачи 8 — на момент задачи 2 его ещё нет, поэтому тип объявляется
  здесь строковым литеральным union и в задаче 8 импортируется **оттуда сюда**, а не наоборот.

- [ ] **Шаг 1: Написать падающий тест**

Добавить в `src/stores/__tests__/useTerminalUiStore.test.ts`:

```ts
it("избранное переключается и не задваивается", () => {
  const { toggleFavorite } = useTerminalUiStore.getState();
  toggleFavorite("200");
  toggleFavorite("201");
  toggleFavorite("200");
  expect(useTerminalUiStore.getState().favoriteMarkets).toEqual(["201"]);
});

it("открытая вкладка не открывается второй раз", () => {
  const { openMarket } = useTerminalUiStore.getState();
  openMarket("200");
  openMarket("201");
  openMarket("200");
  expect(useTerminalUiStore.getState().openMarkets).toEqual(["200", "201"]);
});

it("последняя вкладка не закрывается", () => {
  const { openMarket, closeMarket } = useTerminalUiStore.getState();
  openMarket("200");
  closeMarket("200");
  // Закрыть последнюю значило бы оставить экран без рынка, а рынок —
  // единственное, вокруг чего собран весь терминал.
  expect(useTerminalUiStore.getState().openMarkets).toEqual(["200"]);
});

it("режимы шкалы взаимно исключают друг друга", () => {
  const { setChartScaleMode } = useTerminalUiStore.getState();
  setChartScaleMode("percent");
  expect(useTerminalUiStore.getState().chartScaleMode).toBe("percent");
  setChartScaleMode("log");
  // `%` и `log` — два значения одного PriceScaleMode в lightweight-charts,
  // одновременно они существовать не могут.
  expect(useTerminalUiStore.getState().chartScaleMode).toBe("log");
  setChartScaleMode("log");
  expect(useTerminalUiStore.getState().chartScaleMode).toBe("normal");
});
```

Проверить, как существующие тесты этого файла сбрасывают стор (`reset()` в `beforeEach`), и не
ломать этот порядок.

- [ ] **Шаг 2: Убедиться, что тест падает**

Run: `pnpm test src/stores/__tests__/useTerminalUiStore.test.ts`
Expected: FAIL — `toggleFavorite is not a function`.

- [ ] **Шаг 3: Расширить стор**

```ts
import type { OracleCandleInterval } from "@liq/core";

/** Окно чарта — ключи нижнего ряда рамки. */
export type ChartRangeKey = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y";

/** Чем подписано изменение цены: процентом или деньгами. */
export type ChangeUnit = "pct" | "usd";

/** Режим ценовой шкалы; `percent` и `log` — одно поле, не два флага. */
export type ChartScaleMode = "normal" | "percent" | "log";

interface TerminalUiState {
  chartCollapsed: boolean;
  bottomFullscreen: boolean;
  /**
   * Рынки, отмеченные звездой. Идентификаторы строками: `bigint` не переживает
   * `JSON.stringify`, а стор персистится.
   */
  favoriteMarkets: string[];
  /** Открытые вкладки рынков, в порядке появления. */
  openMarkets: string[];
  changeUnit: ChangeUnit;
  chartInterval: OracleCandleInterval;
  chartRange: ChartRangeKey;
  chartScaleMode: ChartScaleMode;
  chartAutoScale: boolean;
}

interface TerminalUiActions {
  toggleChart: () => void;
  toggleBottomFullscreen: () => void;
  toggleFavorite: (marketId: string) => void;
  openMarket: (marketId: string) => void;
  closeMarket: (marketId: string) => void;
  setChangeUnit: (unit: ChangeUnit) => void;
  setChartInterval: (interval: OracleCandleInterval) => void;
  setChartRange: (range: ChartRangeKey) => void;
  setChartScaleMode: (mode: ChartScaleMode) => void;
  toggleAutoScale: () => void;
  reset: () => void;
}

const INITIAL: TerminalUiState = {
  chartCollapsed: false,
  bottomFullscreen: false,
  favoriteMarkets: [],
  openMarkets: [],
  changeUnit: "pct",
  chartInterval: "1h",
  chartRange: "1D",
  chartScaleMode: "normal",
  chartAutoScale: true,
};
```

Действия внутри `persist`:

```ts
toggleFavorite: (marketId) =>
  set((s) => ({
    favoriteMarkets: s.favoriteMarkets.includes(marketId)
      ? s.favoriteMarkets.filter((id) => id !== marketId)
      : [...s.favoriteMarkets, marketId],
  })),
openMarket: (marketId) =>
  set((s) =>
    s.openMarkets.includes(marketId)
      ? s
      : { openMarkets: [...s.openMarkets, marketId] },
  ),
closeMarket: (marketId) =>
  set((s) =>
    // Последняя вкладка не закрывается: экран без рынка нечем наполнить.
    s.openMarkets.length <= 1
      ? s
      : { openMarkets: s.openMarkets.filter((id) => id !== marketId) },
  ),
setChangeUnit: (changeUnit) => set({ changeUnit }),
setChartInterval: (chartInterval) => set({ chartInterval }),
setChartRange: (chartRange) => set({ chartRange }),
setChartScaleMode: (mode) =>
  set((s) => ({ chartScaleMode: s.chartScaleMode === mode ? "normal" : mode })),
toggleAutoScale: () => set((s) => ({ chartAutoScale: !s.chartAutoScale })),
```

`ChartRangeKey` и `ChartScaleMode` экспортируются **отсюда** — `chartRanges.ts` из задачи 8 их
импортирует, чтобы направление зависимости шло от стора к чарту, а не по кругу.

- [ ] **Шаг 4: Прогнать тест**

Run: `pnpm test src/stores/__tests__/useTerminalUiStore.test.ts`
Expected: PASS.

- [ ] **Шаг 5: Гейт и коммит**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test`

```bash
git add src/stores/
git commit -m "feat(store): избранное, вкладки рынков и настройки чарта (Ф4, задача 2)"
```

---

### Задача 3: Мок шлюза — показатели рынка и оракульные свечи

**Files:**

- Modify: `e2e/support/world.ts`
- Modify: `e2e/support/mockGateway.ts`

**Interfaces:**

- Produces: `MockWorld.marketDynamic`, `MockWorld.marketVolume24h`, `MockWorld.oracleCandles`;
  ручка `GET /markets/:id/oracle-candles`.
- Consumes: `MARKET`, `MARKET_ETH`, `WAD` из `e2e/support/constants.ts`.

Без этой задачи шапка в e2e показывает пять прочерков, и спеки задачи 10 доказывали бы только то,
что прочерк рисуется.

- [ ] **Шаг 1: Поля мира**

В `e2e/support/world.ts` рядом с существующими полями:

```ts
/** Динамика рынка — то, что шлюз отдаёт в `dynamic` строки `/markets/full`. */
export interface WireMarketDynamic {
  openInterest: string | null;
  currentFundingRate: string | null;
  indexPrice: string | null;
}

/** Окно объёма — три состояния, и мир обязан уметь выразить каждое. */
export interface WireVolumeWindow {
  volumeUsd: string;
  volumeBase: string;
  trades: number;
  windowStart: number;
  windowEnd: number;
}
```

В `MockWorld`:

```ts
/** По id рынка; отсутствие ключа — `dynamic: null` в ответе. */
marketDynamic: Record<string, WireMarketDynamic>;
/**
 * По id рынка. Три состояния: ключа нет — поле не отправляется вовсе (шлюз
 * старее 0.33.0); `null` — отправлено пустым; объект — измерено.
 */
marketVolume24h: Record<string, WireVolumeWindow | null>;
/** Оракульные бары по id рынка. */
oracleCandles: Record<string, WireCandle[]>;
```

Соответствующие поля в `ScenarioOptions`, и в `freshWorld` — умолчания, при которых шапка
показывает числа:

```ts
marketDynamic: {
  [MARKET.id]: {
    openInterest: (211_980n * WAD).toString(),
    currentFundingRate: (-9n * WAD / 1_000_000n).toString(), // −0.0009 %/сут
    indexPrice: (70_000n * WAD).toString(),
  },
},
marketVolume24h: {
  [MARKET.id]: {
    volumeUsd: (3_350_000n * WAD).toString(),
    volumeBase: (48n * WAD).toString(),
    trades: 120,
    windowStart: 1_717_113_600,
    windowEnd: 1_717_200_000,
  },
},
oracleCandles: {},
```

Тип `WireCandle` уже существует в файле (его использует `world.candles`) — переиспользовать его,
не заводя второй.

- [ ] **Шаг 2: Отдавать динамику и объём**

В `e2e/support/mockGateway.ts` переписать `marketFull`:

```ts
function marketFull(world: MockWorld) {
  return world.markets.map((m) => {
    const volume = world.marketVolume24h[m.id];
    return {
      id: m.id,
      symbol: m.symbol,
      pythFeedId: m.pythFeedId,
      isActive: true,
      initialMarginBps: "200",
      maintenanceMarginBps: "50",
      dynamic: world.marketDynamic[m.id]
        ? {
            skew: "0",
            size: "0",
            maxFundingVelocity: "0",
            skewScale: "0",
            makerFee: "0",
            takerFee: "0",
            currentFundingVelocity: null,
            maxOpenInterest: null,
            updatedAt: Date.now(),
            ...world.marketDynamic[m.id],
          }
        : null,
      // Ключа нет — поля нет в ответе: это «шлюз его не шлёт», а не «null».
      ...(m.id in world.marketVolume24h ? { volume24h: volume } : {}),
    };
  });
}
```

- [ ] **Шаг 3: Ручка оракульных свечей**

Рядом с существующим разбором `/markets/:id/candles`, **до** него (иначе `candles`-регексп с
`$`-якорем не поймает оракульный путь, но порядок всё равно объявить явно):

```ts
const oracle = path.match(/\/markets\/([^/]+)\/oracle-candles$/);
if (oracle) {
  await send(route, world.oracleCandles[oracle[1]] ?? world.candles);
  return;
}
```

- [ ] **Шаг 4: Проверить, что мир не сломал существующие спеки**

Run: `pnpm test:e2e e2e/tier1/02-market-data.spec.ts`
Expected: PASS — задача 3 ничего не переименовывает, только добавляет поля.

- [ ] **Шаг 5: Коммит**

```bash
git add e2e/support/
git commit -m "test(e2e): показатели рынка и оракульные свечи в моке шлюза (Ф4, задача 3)"
```

---

### Задача 4: Изменение за сутки

**Files:**

- Create: `src/features/market/useDailyChange.ts`
- Create: `src/features/market/__tests__/dailyChange.test.ts`

**Interfaces:**

- Produces: `changeFromBars(bars): { pct: number; abs: bigint } | null` и
  `useDailyChange(marketId, opts?): { change: ... | null; isLoading: boolean }`.
- Consumes: `useCandles` из `@liq/react`, `CandleBar` из `@liq/core`.

Изменения за сутки нет ни в одном ответе шлюза: `PriceInfo.change` — это направление последнего
тика (`'up' | 'down' | null`), а не величина. Считается оно из оракульного ряда: двадцать пять
часовых баров, разница закрытий крайних.

- [ ] **Шаг 1: Написать падающий тест**

`src/features/market/__tests__/dailyChange.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { changeFromBars } from "../useDailyChange";

const WAD = 10n ** 18n;
const bar = (close: bigint) => ({
  timestamp: 0,
  open: close,
  high: close,
  low: close,
  close,
  volume: null,
});

describe("changeFromBars", () => {
  it("считает процент и величину против первого бара окна", () => {
    const out = changeFromBars([bar(100n * WAD), bar(110n * WAD)]);
    expect(out).toEqual({ pct: 10, abs: 10n * WAD });
  });

  it("падение приходит отрицательным", () => {
    const out = changeFromBars([bar(100n * WAD), bar(95n * WAD)]);
    expect(out?.pct).toBeCloseTo(-5, 6);
  });

  it("одного бара мало — сравнивать не с чем", () => {
    expect(changeFromBars([bar(100n * WAD)])).toBeNull();
    expect(changeFromBars([])).toBeNull();
  });

  it("нулевое закрытие не делится", () => {
    // Ряд с нулём в основании — не «изменение на бесконечность», а отсутствие
    // основания для сравнения.
    expect(changeFromBars([bar(0n), bar(100n * WAD)])).toBeNull();
  });
});
```

- [ ] **Шаг 2: Убедиться, что падает**

Run: `pnpm test src/features/market/__tests__/dailyChange.test.ts`
Expected: FAIL — модуля нет.

- [ ] **Шаг 3: Реализация**

`src/features/market/useDailyChange.ts`:

```ts
import type { CandleBar } from "@liq/core";
import { useCandles } from "@liq/react";

/** Сколько часовых баров нужно, чтобы у последнего был сосед сутками раньше. */
const BARS = 25;

export interface DailyChange {
  /** Проценты, знаковые. */
  pct: number;
  /** Абсолютная разница цены, WAD, знаковая. */
  abs: bigint;
}

/**
 * Изменение против закрытия первого бара окна.
 *
 * @remarks
 * `null` — «сравнивать не с чем»: ряд короче двух баров или основание нулевое.
 * Ноль возвращается только когда цена действительно не изменилась.
 */
export function changeFromBars(bars: readonly CandleBar[]): DailyChange | null {
  if (bars.length < 2) return null;
  const base = bars[0].close;
  const last = bars[bars.length - 1].close;
  if (base === 0n) return null;
  const abs = last - base;
  // Через bigint, а не Number(abs) / Number(base): при 18 знаках оба
  // операнда выходят за безопасное целое, и деление теряет младшие разряды.
  return { pct: Number((abs * 1_000_000n) / base) / 10_000, abs };
}

/**
 * Изменение цены рынка за сутки.
 *
 * @remarks
 * Оракульный маршрут выбран намеренно: торговый ряд на рынке, где час никто не
 * торговал, просто не содержит бара, и «изменение» посчиталось бы против
 * произвольно давнего.
 */
export function useDailyChange(
  marketId: bigint | undefined,
  opts?: { enabled?: boolean },
): { change: DailyChange | null; isLoading: boolean } {
  const { bars, isLoading } = useCandles(marketId, "1h", {
    bars: BARS,
    route: "oracle",
    enabled: opts?.enabled ?? true,
  });
  return { change: changeFromBars(bars), isLoading };
}
```

- [ ] **Шаг 4: Прогнать**

Run: `pnpm test src/features/market/__tests__/dailyChange.test.ts`
Expected: PASS (4 теста).

- [ ] **Шаг 5: Коммит**

```bash
git add src/features/market/useDailyChange.ts src/features/market/__tests__/dailyChange.test.ts
git commit -m "feat(market): изменение цены за сутки из оракульного ряда (Ф4, задача 4)"
```

---

### Задача 5: Строки списка рынков

**Files:**

- Create: `src/features/market/useMarketRows.ts`
- Create: `src/features/market/__tests__/marketRow.test.ts`

**Interfaces:**

- Produces: `MarketRow`, `marketRow(full, favorite)`, `useMarketRows()`.
- Consumes: `useMarketsFullRestQuery` из `@liq/react`, `MarketFullRow` из `@liq/api-client`,
  `favoriteMarkets` из `useTerminalUiStore`.

- [ ] **Шаг 1: Написать падающий тест**

`src/features/market/__tests__/marketRow.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { marketRow } from "../useMarketRows";

const WAD = 10n ** 18n;
const base = {
  id: 200n,
  symbol: "BTC",
  pythFeedId: "0x00",
  isActive: true,
  initialMarginBps: 200n,
  maintenanceMarginBps: 50n,
  dynamic: null,
};

describe("marketRow", () => {
  it("выводит плечо из начальной маржи", () => {
    // 200 bps = 2 % начальной маржи = 50x. `maxLeverage` из `/markets` не
    // приходит вовсе, и `?? 25` выдавал бы выдумку за конфигурацию рынка.
    expect(marketRow(base, false).maxLeverage).toBe(50);
  });

  it("нулевая начальная маржа не даёт плеча", () => {
    expect(marketRow({ ...base, initialMarginBps: 0n }, false).maxLeverage).toBeNull();
  });

  it("различает три состояния объёма", () => {
    expect(marketRow(base, false).volumeUsd).toBeNull();
    expect(marketRow({ ...base, volume24h: null }, false).volumeUsd).toBeNull();
    expect(
      marketRow(
        {
          ...base,
          volume24h: {
            volumeUsd: 5n * WAD,
            volumeBase: 0n,
            trades: 0,
            windowStart: 0,
            windowEnd: 0,
          },
        },
        false,
      ).volumeUsd,
    ).toBe(5n * WAD);
  });

  it("несёт признак избранного и открытый интерес", () => {
    const row = marketRow(
      { ...base, dynamic: { ...dynamicStub, openInterest: 7n * WAD } },
      true,
    );
    expect(row.favorite).toBe(true);
    expect(row.openInterest).toBe(7n * WAD);
  });
});
```

`dynamicStub` объявить в файле теста: все поля `MarketFullDynamic` нулями, `openInterest`
переопределяется в кейсе.

- [ ] **Шаг 2: Убедиться, что падает**

Run: `pnpm test src/features/market/__tests__/marketRow.test.ts`
Expected: FAIL.

- [ ] **Шаг 3: Реализация**

```ts
import type { MarketFullRow } from "@liq/api-client";
import { useMarketsFullRestQuery } from "@liq/react";
import { useMemo } from "react";

import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

export interface MarketRow {
  id: bigint;
  symbol: string;
  /** Плечо из начальной маржи; `null` — маржа неизвестна или нулевая. */
  maxLeverage: number | null;
  /** Открытый интерес рынка в USD, WAD; `null` — шлюз не вывел. */
  openInterest: bigint | null;
  /** Объём за сутки, WAD; `null` — «не знаем», не ноль. */
  volumeUsd: bigint | null;
  favorite: boolean;
}

export function marketRow(full: MarketFullRow, favorite: boolean): MarketRow {
  const bps = full.initialMarginBps;
  return {
    id: full.id,
    symbol: full.symbol,
    maxLeverage: bps > 0n ? Number(10_000n / bps) : null,
    openInterest: full.dynamic?.openInterest ?? null,
    // `undefined` (поля нет) и `null` (шлюз не смог) — одно утверждение для
    // экрана: неизвестно. Разница между ними ничего не меняет в отрисовке.
    volumeUsd: full.volume24h?.volumeUsd ?? null,
    favorite,
  };
}

export function useMarketRows(): { rows: MarketRow[]; isLoading: boolean } {
  const { data, isLoading } = useMarketsFullRestQuery();
  const favorites = useTerminalUiStore((s) => s.favoriteMarkets);
  const rows = useMemo(
    () =>
      (data ?? []).map((full) =>
        marketRow(full, favorites.includes(full.id.toString())),
      ),
    [data, favorites],
  );
  return { rows, isLoading };
}
```

- [ ] **Шаг 4: Прогнать**

Run: `pnpm test src/features/market/__tests__/marketRow.test.ts`
Expected: PASS.

- [ ] **Шаг 5: Коммит**

```bash
git add src/features/market/useMarketRows.ts src/features/market/__tests__/marketRow.test.ts
git commit -m "feat(market): строки списка рынков из полного списка (Ф4, задача 5)"
```

---

### Задача 6: Поиск рынка

**Files:**

- Create: `src/features/market/MarketSearch.tsx`
- Delete: `src/features/market/MarketSelect.tsx`

**Interfaces:**

- Consumes: `useMarketRows` (задача 5), `useDailyChange` (задача 4), примитивы `Popover` и
  `Command` (задача 1), `useSelectedMarket`, `useTerminalUiStore`.
- Produces: `<MarketSearch />` и testid'ы `market-pill`, `market-search-popover`,
  `market-search-input`, `market-search-scope-all`, `market-search-scope-favorites`,
  `market-row-{id}`, `market-favorite-{id}`.

- [ ] **Шаг 1: Компонент**

```tsx
import { Star } from "lucide-react";
import { useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

import { compactUsd } from "@liq/core";
import { DASH, fmtPrice, fmtSignedPct } from "../../lib/format";
import { useDailyChange } from "./useDailyChange";
import { type MarketRow, useMarketRows } from "./useMarketRows";
import { useSelectedMarket } from "./useSelectedMarket";

const QUOTE = "USD";

/** Изменение одной строки: свой хук на строку, чтобы не звать его в цикле. */
function ChangeCell({ id, enabled }: { id: bigint; enabled: boolean }) {
  const { change } = useDailyChange(id, { enabled });
  if (!change) return <span className="text-muted">{DASH}</span>;
  return (
    <span className={change.pct < 0 ? "text-short" : "text-long"}>
      {change.pct >= 0 ? "+" : ""}
      {change.pct.toFixed(2)}%
    </span>
  );
}

export function MarketSearch() {
  const { market, setMarketId } = useSelectedMarket();
  const { rows } = useMarketRows();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"all" | "favorites">("all");
  const toggleFavorite = useTerminalUiStore((s) => s.toggleFavorite);
  const openMarket = useTerminalUiStore((s) => s.openMarket);

  const shown = scope === "all" ? rows : rows.filter((r) => r.favorite);

  function pick(row: MarketRow) {
    setMarketId(row.id);
    openMarket(row.id.toString());
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="market-pill"
          className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 hover:bg-surface-2"
        >
          <Monogram symbol={market?.symbol ?? "?"} />
          <span className="text-sm font-bold text-text">{market?.symbol ?? DASH}</span>
          <span className="text-sm text-muted">{QUOTE}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[680px] p-0"
        data-testid="market-search-popover"
      >
        <Command>
          <div className="flex items-center gap-2 border-b border-border p-2">
            <CommandInput
              placeholder="Search"
              data-testid="market-search-input"
              className="flex-1"
            />
            <button
              type="button"
              data-testid="market-search-scope-all"
              onClick={() => setScope("all")}
              className={scope === "all" ? "text-text" : "text-muted"}
            >
              All
            </button>
            <button
              type="button"
              data-testid="market-search-scope-favorites"
              onClick={() => setScope("favorites")}
              className={scope === "favorites" ? "text-text" : "text-muted"}
            >
              Favorites
            </button>
          </div>
          <CommandList>
            <CommandEmpty>No markets.</CommandEmpty>
            <CommandGroup>
              {shown.map((row) => (
                <CommandItem
                  key={row.id.toString()}
                  value={row.symbol}
                  data-testid={`market-row-${row.id}`}
                  onSelect={() => pick(row)}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-2"
                >
                  <span className="flex items-center gap-2">
                    <Monogram symbol={row.symbol} />
                    <span className="font-semibold text-text">{row.symbol}</span>
                    <span className="text-muted">{QUOTE}</span>
                    {row.maxLeverage !== null && (
                      <span className="rounded border border-border px-1 text-[10px] text-muted">
                        {row.maxLeverage}x
                      </span>
                    )}
                  </span>
                  <LastPrice id={row.id} />
                  <ChangeCell id={row.id} enabled={open} />
                  <span className="text-right">
                    {row.volumeUsd === null ? DASH : compactUsd(row.volumeUsd)}
                  </span>
                  {/* Рыночной капитализации нет ни в шлюзе, ни в SDK: она
                      требует circulating supply, которого у контура нет. */}
                  <span className="text-right text-muted">{DASH}</span>
                  <button
                    type="button"
                    data-testid={`market-favorite-${row.id}`}
                    aria-label="Toggle favorite"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(row.id.toString());
                    }}
                  >
                    <Star
                      size={14}
                      className={row.favorite ? "text-accent" : "text-muted"}
                      fill={row.favorite ? "currentColor" : "none"}
                    />
                  </button>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

`Monogram` и `LastPrice` объявить в этом же файле: первый — кружок `bg-surface-2` с первой буквой
символа (иконок токенов в репозитории нет), второй — цена из `usePricesQuery([id])`,
отформатированная `fmtPrice`, с `DASH` при отсутствии.

Заголовок колонок (`Pair / Last Price / Change / Volume / Market Cap`) — строка `div` над
`CommandList` с той же сеткой.

- [ ] **Шаг 2: Удалить старый селектор**

```bash
git rm src/features/market/MarketSelect.tsx
```

Импорт в `MarketHeader.tsx` заменит задача 8; до неё сборка будет красной — это ожидаемо внутри
задачи, но коммит делается только после шага 4.

- [ ] **Шаг 3: Подставить поиск в шапку временно**

В `MarketHeader.tsx` заменить `<MarketSelect />` на `<MarketSearch />` (полная переделка шапки —
задача 8; здесь только чтобы дерево собиралось).

- [ ] **Шаг 4: Гейт и коммит**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build`

```bash
git add src/features/market/
git commit -m "feat(market): поиск рынка на Command с избранным (Ф4, задача 6)"
```

Спеки, ходившие по `market-select`, к этому моменту красные — их чинит задача 10. Не запускать
`pnpm test:e2e` как гейт этой задачи.

---

### Задача 7: Полоса вкладок рынков

**Files:**

- Create: `src/features/market/MarketTabs.tsx`
- Modify: `src/features/terminal/Terminal.tsx`

**Interfaces:**

- Consumes: `useTerminalUiStore` (`openMarkets`, `changeUnit`, `openMarket`, `closeMarket`,
  `setChangeUnit`), `useSelectedMarket`, `useDailyChange`, `MarketSearch` (кнопка `+`).
- Produces: testid'ы `market-tabs`, `market-tab-{id}`, `market-tab-close-{id}`,
  `market-tabs-add`, `change-unit-pct`, `change-unit-usd`.

- [ ] **Шаг 1: Компонент**

```tsx
import { Plus, X } from "lucide-react";

import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

import { DASH, fmtSignedUsd } from "../../lib/format";
import { useDailyChange } from "./useDailyChange";
import { useSelectedMarket } from "./useSelectedMarket";

const QUOTE = "USD";

function TabChange({ id }: { id: bigint }) {
  const unit = useTerminalUiStore((s) => s.changeUnit);
  const { change } = useDailyChange(id);
  if (!change) return <span className="text-muted">{DASH}</span>;
  const negative = change.pct < 0;
  return (
    <span className={negative ? "text-short" : "text-long"}>
      {unit === "pct"
        ? `${change.pct >= 0 ? "+" : ""}${change.pct.toFixed(2)}%`
        : fmtSignedUsd(change.abs)}
    </span>
  );
}

export function MarketTabs() {
  const { markets, marketId, setMarketId } = useSelectedMarket();
  const openMarkets = useTerminalUiStore((s) => s.openMarkets);
  const changeUnit = useTerminalUiStore((s) => s.changeUnit);
  const setChangeUnit = useTerminalUiStore((s) => s.setChangeUnit);
  const closeMarket = useTerminalUiStore((s) => s.closeMarket);
  const openMarket = useTerminalUiStore((s) => s.openMarket);

  // Первое открытие экрана: вкладок в сторе нет, а рынок уже выбран — он и
  // становится единственной вкладкой. Иначе полоса пуста при выбранном рынке.
  const ids = openMarkets.length
    ? openMarkets
    : marketId !== undefined
      ? [marketId.toString()]
      : [];

  return (
    <div
      className="flex items-center gap-1 border-b border-border px-2"
      data-testid="market-tabs"
    >
      <button
        type="button"
        data-testid="change-unit-pct"
        onClick={() => setChangeUnit("pct")}
        className={changeUnit === "pct" ? "text-text" : "text-muted"}
      >
        %
      </button>
      <button
        type="button"
        data-testid="change-unit-usd"
        onClick={() => setChangeUnit("usd")}
        className={changeUnit === "usd" ? "text-text" : "text-muted"}
      >
        $
      </button>
      <div className="mx-2 h-4 w-px bg-border" />
      {ids.map((id) => {
        const market = markets.find((m) => m.id.toString() === id);
        const active = marketId?.toString() === id;
        return (
          <div
            key={id}
            data-testid={`market-tab-${id}`}
            data-active={active ? "true" : "false"}
            className={`flex items-center gap-2 rounded-t px-2 py-1 text-xs ${
              active ? "bg-surface-2 text-text" : "text-muted"
            }`}
          >
            <button type="button" onClick={() => setMarketId(BigInt(id))}>
              <span className="font-semibold">{market?.symbol ?? id}</span>
              <span className="text-muted">{QUOTE}</span>{" "}
              <TabChange id={BigInt(id)} />
            </button>
            <button
              type="button"
              aria-label="Close tab"
              data-testid={`market-tab-close-${id}`}
              onClick={() => closeMarket(id)}
              className="text-muted hover:text-text"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        aria-label="Add market"
        data-testid="market-tabs-add"
        onClick={() => {
          // `+` открывает тот же поиск, что и пилюля шапки: второй поиск с
          // собственным состоянием разошёлся бы с первым по избранному.
          document.querySelector<HTMLButtonElement>('[data-testid="market-pill"]')?.click();
        }}
        className="text-muted hover:text-text"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
```

Если при реализации окажется, что клик по чужой кнопке через `querySelector` работает ненадёжно
(портал `Popover` уже смонтирован, фокус уходит), поднять состояние `open` поиска в
`useTerminalUiStore` (`searchOpen`) и открыть его напрямую — решение принимает исполнитель,
но оба варианта обязаны оставить ровно один экземпляр поиска.

- [ ] **Шаг 2: Вставить полосу в раскладку**

В `src/features/terminal/Terminal.tsx`, перед `<MarketHeader />`:

```tsx
{!bottomFullscreen && <MarketTabs />}
```

- [ ] **Шаг 3: Гейт и коммит**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build`

```bash
git add src/features/market/MarketTabs.tsx src/features/terminal/Terminal.tsx
git commit -m "feat(market): полоса вкладок рынков и переключатель единицы (Ф4, задача 7)"
```

---

### Задача 8: Шапка рынка по макету

**Files:**

- Create: `src/features/market/MarketStat.tsx`
- Modify: `src/features/market/MarketHeader.tsx`

**Interfaces:**

- Consumes: `MarketSearch`, `useDailyChange`, `useMarketRows`, `useFunding`, `usePricesQuery`,
  `useAvailableMarginQuery`.
- Produces: testid'ы `market-change`, `stat-mark-price`, `stat-spot-price`,
  `stat-funding` (внутри — существующий `funding-rate`), `stat-open-interest`, `stat-volume-24h`.
  Сохраняются без переименования: `market-header`, `market-price`, `funding-rate`,
  `available-margin`, `open-deposit-button`, `open-withdraw-button`.

- [ ] **Шаг 1: Ячейка показателя**

`src/features/market/MarketStat.tsx`:

```tsx
import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Одна ячейка шапки: подпись сверху, значение снизу.
 *
 * @param note - почему значение такое, какое есть. Появляется тултипом только
 * там, где источника нет вовсе, — чтобы прочерк не читался как поломка.
 */
export function MarketStat({
  label,
  testid,
  note,
  children,
}: {
  label: string;
  testid: string;
  note?: string;
  children: ReactNode;
}) {
  const value = (
    <span className="text-xs font-semibold text-text" data-testid={testid}>
      {children}
    </span>
  );
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted">{label}</span>
      {note ? (
        <Tooltip>
          <TooltipTrigger asChild>{value}</TooltipTrigger>
          <TooltipContent>{note}</TooltipContent>
        </Tooltip>
      ) : (
        value
      )}
    </div>
  );
}
```

Сверить имена экспортов с уже существующим `src/components/ui/tooltip.tsx` перед написанием — если
там `TooltipProvider` обязателен, обернуть шапку им один раз, а не каждую ячейку.

- [ ] **Шаг 2: Переписать шапку**

Каркас: `MarketSearch` → крупная цена + изменение → пять ячеек → распорка → маржа и две кнопки.

```tsx
const { marketId, marketIds, market } = useSelectedMarket();
const { data: prices } = usePricesQuery(marketIds);
const { data: funding } = useFunding(marketId);
const { data: margins } = useAvailableMarginQuery();
const { change } = useDailyChange(marketId);
const { rows } = useMarketRows();
const row = rows.find((r) => r.id === marketId);

const info = marketId !== undefined ? prices?.[marketId.toString()] : undefined;
```

Крупная цена и изменение:

```tsx
<div className="flex flex-col">
  <span className="text-lg font-bold text-text" data-testid="market-price">
    {info ? `$${fmtPrice(info.price)}` : DASH}
  </span>
  <span
    className={`text-[11px] ${change && change.pct < 0 ? "text-short" : "text-long"}`}
    data-testid="market-change"
  >
    {change ? `${change.pct >= 0 ? "+" : ""}${change.pct.toFixed(2)}%` : DASH}
  </span>
</div>
```

Пять ячеек:

```tsx
<MarketStat label="Mark Price" testid="stat-mark-price">
  {info ? fmtPrice(info.price) : DASH}
</MarketStat>
<MarketStat
  label="Spot Price"
  testid="stat-spot-price"
  note="Спотового рынка у контура нет, а индексная цена — тот же фид Pyth, что и Mark."
>
  {DASH}
</MarketStat>
<MarketStat
  label="Funding Rate"
  testid="stat-funding"
  note="Фандинг начисляется непрерывно — момента следующего списания не существует."
>
  {/* Суточная ставка, WAD, знаковая. Пустой снимок (синк лежит, рынок новый,
      шлюз старее 0.34.0) обязан быть прочерком: его null, отформатированный
      числом, показал бы измеренные 0.0000 %. */}
  <span data-testid="funding-rate">
    {funding?.available && funding.rate !== null
      ? `${(toNum(funding.rate) * 100).toFixed(4)}%`
      : DASH}
  </span>
</MarketStat>
<MarketStat label="Open Interest" testid="stat-open-interest">
  {row?.openInterest == null ? DASH : compactUsd(row.openInterest)}
</MarketStat>
<MarketStat label="24h Volume" testid="stat-volume-24h">
  {row?.volumeUsd == null ? DASH : compactUsd(row.volumeUsd)}
</MarketStat>
```

Правый край (маржа + две кнопки + диалоги) переносится из нынешней шапки **без единого
переименования**.

Бейдж плеча (`{row.maxLeverage}x`) рисуется внутри `MarketSearch` — он уже там, дублировать в
шапке не надо.

- [ ] **Шаг 3: Гейт**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build`

- [ ] **Шаг 4: Коммит**

```bash
git add src/features/market/
git commit -m "feat(market): шапка рынка по макету (Ф4, задача 8)"
```

---

### Задача 9: Рамка чарта

**Files:**

- Create: `src/features/chart/chartRanges.ts`
- Create: `src/features/chart/__tests__/chartRanges.test.ts`
- Create: `src/features/chart/ChartFrame.tsx`
- Modify: `src/features/chart/CandleChart.tsx`, `src/features/chart/candleMapping.ts`
- Modify: `src/features/terminal/Terminal.tsx`
- Delete: `src/features/chart/useCandles.ts`

**Interfaces:**

- Produces: `CHART_RANGES`, `barsForRange(range, interval)`, `fitInterval(range, interval)`;
  `<ChartFrame marketId />`; testid'ы `chart-interval-{iv}`, `chart-range-{key}`,
  `chart-scale-percent`, `chart-scale-log`, `chart-scale-auto`. Сохраняются `chart-panel`,
  `chart-collapse-toggle`.
- Consumes: `ORACLE_INTERVALS`, `intervalSeconds`, `maxBarsPerRequest` из `@liq/core`;
  `useCandles` из `@liq/react`; `ChartRangeKey`, `ChartScaleMode` из стора (задача 2).

- [ ] **Шаг 1: Написать падающий тест окон**

`src/features/chart/__tests__/chartRanges.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { barsForRange, CHART_RANGES, fitInterval } from "../chartRanges";

describe("chartRanges", () => {
  it("сутки часовыми барами — это 24 бара", () => {
    expect(barsForRange("1D", "1h")).toBe(24);
  });

  it("год минутными барами не влезает в маршрут", () => {
    // 525 600 баров против потолка маршрута: запрос отдал бы хвост окна и
    // подписал бы его «1Y» — это не «1Y», это последние сутки под чужой
    // подписью.
    expect(fitInterval("1Y", "1m")).not.toBe("1m");
  });

  it("поднятый интервал сам влезает", () => {
    const iv = fitInterval("1Y", "1m");
    expect(barsForRange("1Y", iv)).toBeLessThanOrEqual(
      maxBarsPerRequest(iv, "oracle"),
    );
  });

  it("интервал, который и так влезает, не поднимается", () => {
    expect(fitInterval("1D", "1h")).toBe("1h");
  });

  it("окна перечислены по возрастанию", () => {
    const values = Object.values(CHART_RANGES);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });
});
```

`maxBarsPerRequest` импортировать в тест из `@liq/core`.

- [ ] **Шаг 2: Убедиться, что падает**

Run: `pnpm test src/features/chart/__tests__/chartRanges.test.ts`
Expected: FAIL — модуля нет.

- [ ] **Шаг 3: Реализация окон**

```ts
import {
  intervalSeconds,
  maxBarsPerRequest,
  ORACLE_INTERVALS,
  type OracleCandleInterval,
} from "@liq/core";

import type { ChartRangeKey } from "@/stores/useTerminalUiStore";

const DAY = 86_400;

/** Ширина окна в секундах — нижний ряд рамки макета. */
export const CHART_RANGES: Record<ChartRangeKey, number> = {
  "1D": DAY,
  "5D": 5 * DAY,
  "1M": 30 * DAY,
  "3M": 90 * DAY,
  "6M": 180 * DAY,
  "1Y": 365 * DAY,
};

/**
 * Чарт всегда читает оракульный ряд.
 *
 * @remarks
 * У торгового маршрута окно ограничено тридцатью сутками независимо от
 * интервала, и на рынке, где час никто не торговал, бара просто нет — оба
 * свойства ломают именно длинные окна, ради которых нижний ряд и существует.
 */
export const CHART_ROUTE = "oracle" as const;

export function barsForRange(
  range: ChartRangeKey,
  interval: OracleCandleInterval,
): number {
  return Math.ceil(CHART_RANGES[range] / intervalSeconds(interval));
}

/**
 * Самый мелкий интервал не грубее запрошенного, которым окно ещё влезает.
 *
 * @remarks
 * Окно, не влезающее в потолок маршрута, отдаётся хвостом — и подписывается
 * ярлыком всего окна. Поднять интервал честнее, чем показать сутки под
 * подписью «1Y».
 */
export function fitInterval(
  range: ChartRangeKey,
  interval: OracleCandleInterval,
): OracleCandleInterval {
  const from = ORACLE_INTERVALS.indexOf(interval);
  const start = from === -1 ? 0 : from;
  for (const candidate of ORACLE_INTERVALS.slice(start)) {
    if (barsForRange(range, candidate) <= maxBarsPerRequest(candidate, CHART_ROUTE))
      return candidate;
  }
  return ORACLE_INTERVALS[ORACLE_INTERVALS.length - 1];
}
```

- [ ] **Шаг 4: Прогнать тест**

Run: `pnpm test src/features/chart/__tests__/chartRanges.test.ts`
Expected: PASS (5 тестов).

- [ ] **Шаг 5: Перевести чарт на хук SDK**

`candleMapping.ts` — заменить `import type { ExchangeCandle } from "@liq/sdk"` на
`import type { CandleBar } from "@liq/core"` и тип параметра; тело не трогать (формы совпадают:
секунды в `timestamp`, WAD-`bigint` в OHLC). Тест маппинга остаётся зелёным без правки.

`CandleChart.tsx` — принять пропсы и читать хук SDK:

```tsx
export function CandleChart({
  marketId,
  interval,
  bars: barCount,
  scaleMode,
  autoScale,
}: {
  marketId: bigint | undefined;
  interval: OracleCandleInterval;
  bars: number;
  scaleMode: ChartScaleMode;
  autoScale: boolean;
}) {
  const { bars: raw } = useCandles(marketId, interval, {
    bars: barCount,
    route: CHART_ROUTE,
  });
  const bars = useMemo(() => raw.map(toLwcBar), [raw]);
  …
}
```

Отдельный эффект на режим шкалы:

```tsx
useEffect(() => {
  const chart = chartRef.current;
  if (!chart) return;
  chart.priceScale("right").applyOptions({
    mode:
      scaleMode === "percent"
        ? PriceScaleMode.Percentage
        : scaleMode === "log"
          ? PriceScaleMode.Logarithmic
          : PriceScaleMode.Normal,
    autoScale,
  });
}, [scaleMode, autoScale]);
```

`PriceScaleMode` импортируется из `lightweight-charts`. Удалить `src/features/chart/useCandles.ts`
(`git rm`).

- [ ] **Шаг 6: Рамка**

`ChartFrame.tsx` — три ряда управления вокруг `CandleChart`:

```tsx
const interval = useTerminalUiStore((s) => s.chartInterval);
const range = useTerminalUiStore((s) => s.chartRange);
const scaleMode = useTerminalUiStore((s) => s.chartScaleMode);
const autoScale = useTerminalUiStore((s) => s.chartAutoScale);
…
// Интервал, которым окно действительно рисуется. Кнопка остаётся подсвеченной
// по выбранному, но график строится по влезающему — и оба видны.
const effective = fitInterval(range, interval);
```

Верхний ряд — `ORACLE_INTERVALS.map(...)` с `data-testid={`chart-interval-${iv}`}` и
`data-active`; нижний ряд — ключи `CHART_RANGES` с `data-testid={`chart-range-${key}`}`, справа
три кнопки `%` / `log` / `auto` (`chart-scale-percent`, `chart-scale-log`, `chart-scale-auto`,
каждая с `data-active`). Кнопки `1s` нет: минимальный интервал обоих маршрутов — минута.

`Terminal.tsx` — заменить `<CandleChart marketId={marketId} />` на `<ChartFrame marketId={marketId} />`,
сохранив `data-testid="chart-panel"` на обёртке `Card`.

- [ ] **Шаг 7: Гейт**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build`

- [ ] **Шаг 8: Коммит**

```bash
git add src/features/chart/ src/features/terminal/Terminal.tsx
git commit -m "feat(chart): рамка интервалов, окон и шкалы (Ф4, задача 9)"
```

---

### Задача 10: e2e tier-1

**Files:**

- Modify: `e2e/pages/TerminalPanels.ts`, `e2e/tier1/02-market-data.spec.ts`,
  `e2e/tier1/12-errors.spec.ts`, `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`
- Create: `e2e/tier1/25-market-search.spec.ts`, `e2e/tier1/26-market-tabs.spec.ts`,
  `e2e/tier1/27-chart-frame.spec.ts`

**Interfaces:**

- Consumes: все testid'ы задач 6–9, мир из задачи 3.

- [ ] **Шаг 1: Локаторы**

В `e2e/pages/TerminalPanels.ts` заменить `marketSelect` на поиск и добавить рамку:

```ts
readonly marketPill: Locator;
readonly marketSearch: Locator;
readonly marketSearchInput: Locator;
…
this.marketPill = page.getByTestId("market-pill");
this.marketSearch = page.getByTestId("market-search-popover");
this.marketSearchInput = page.getByTestId("market-search-input");

marketRow(id: string): Locator {
  return this.page.getByTestId(`market-row-${id}`);
}
async pickMarket(id: string): Promise<void> {
  await this.marketPill.click();
  await this.marketRow(id).click();
}
```

Добавить класс `ChartFramePage` с `interval(iv)`, `range(key)`, `scale(name)`.

- [ ] **Шаг 2: Починить две существующие спеки**

`02-market-data.spec.ts` — четыре места с `marketSelect`. Замены:
`expect(market.marketSelect).toHaveValue("200")` → `expect(market.marketPill).toContainText("BTC")`;
`selectOption("201")` → `await market.pickMarket("201")`;
`marketSelect.locator("option")).toHaveCount(1)` → открыть поиск и посчитать
`page.locator('[data-testid^="market-row-"]')`.

`12-errors.spec.ts:138` — тот же счётчик строк вместо `option`.

- [ ] **Шаг 3: Спека поиска**

`e2e/tier1/25-market-search.spec.ts`, пять тестов:

```ts
test("пилюля открывает поиск со всеми рынками", …);       // market-row-200 и market-row-201 видны
test("ввод сужает список", …);                            // fill("ETH") → строка BTC исчезает
test("выбор строки меняет рынок", …);                     // pickMarket(ETH) → market-pill содержит ETH
test("звезда переживает перезагрузку", …);                // toggle → page.reload() → Favorites содержит рынок
test("капитализация и спот — прочерки, а не нули", …);    // stat-spot-price === "—"
```

Мир для первых трёх: `readyWorld({ markets: [MARKET, MARKET_ETH] })`.

- [ ] **Шаг 4: Спека вкладок**

`e2e/tier1/26-market-tabs.spec.ts`, четыре теста:

```ts
test("выбранный рынок становится вкладкой", …);            // market-tab-200 виден
test("выбор второго рынка добавляет вторую вкладку", …);   // после pickMarket(201) обе видны
test("последняя вкладка не закрывается", …);               // клик по close при одной вкладке ничего не меняет
test("переключатель единицы меняет подпись изменения", …); // $ → подпись начинается с $ или —
```

- [ ] **Шаг 5: Спека рамки чарта**

`e2e/tier1/27-chart-frame.spec.ts`, четыре теста:

```ts
test("кнопки интервалов и окон на месте", …);              // chart-interval-1h, chart-range-1D
test("кнопки 1s нет", …);                                  // getByTestId("chart-interval-1s") → count 0
test("выбор окна переживает перезагрузку", …);             // chart-range-1M active → reload → active
test("процент и лог взаимно исключают друг друга", …);     // клик %, клик log → у % data-active=false
```

- [ ] **Шаг 6: Обновить снапшот testid'ов**

Run: `pnpm test -u`
Expected: снапшот дополнен новыми идентификаторами. **Проверить `git diff` файла снапшота:** он
обязан вырасти, а не сократиться. Если строк стало меньше — это тот же провал, что был в Ф3b:
утверждение упало раньше `toMatchSnapshot()`, и vitest счёл снапшот устаревшим.

- [ ] **Шаг 7: Прогнать весь ярус**

Run: `pnpm test:e2e`
Expected: все спеки зелёные, включая три новые (13 тестов).

- [ ] **Шаг 8: Коммит**

```bash
git add e2e/ src/__tests__/
git commit -m "test(e2e): поиск рынка, вкладки и рамка чарта (Ф4, задача 10)"
```

---

### Задача 11: Живой ярус, гейт фазы, PR

**Files:**

- Create: `e2e/tier2/live-market-header.live.spec.ts`

- [ ] **Шаг 1: Живая спека**

```ts
import { AppPage } from "../pages/AppPage";
import { MarketPanel } from "../pages/TerminalPanels";
import { liveConfigured } from "./env";
import { expect, test } from "./liveFixtures";

test.describe("live: шапка рынка", () => {
  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
  });

  test("показатели шапки приходят со staging", async ({ page }) => {
    const failures: string[] = [];
    page.on("response", (r) => {
      if (/\/markets(\/|\?|$)|oracle-candles/.test(r.url()) && r.status() >= 400)
        failures.push(`${r.status()} ${r.url()}`);
    });

    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();

    // Числа не проверяются: на staging их никто не обещает. Проверяется, что
    // ячейка отрисована — прочерком или значением, но не разрывом.
    for (const id of ["stat-mark-price", "stat-open-interest", "stat-volume-24h"])
      await expect(page.getByTestId(id)).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("market-pill").click();
    await expect(page.getByTestId("market-search-popover")).toBeVisible();

    expect(failures, failures.join("\n")).toEqual([]);
  });
});
```

Имя класса локаторов сверить с фактическим в `e2e/pages/TerminalPanels.ts`.

- [ ] **Шаг 2: Прогнать живой ярус**

Run: `pnpm test:e2e:live e2e/tier2/live-market-header.live.spec.ts`
Expected: PASS либо `skipped` с причиной `liveConfigured()`. Пропуск — не провал задачи, но в
отчёте фазы он называется пропуском, а не прогоном.

- [ ] **Шаг 3: Финальный гейт**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build && pnpm test:e2e`
Expected: всё зелёное.

- [ ] **Шаг 4: Коммит и draft-PR**

```bash
git add e2e/tier2/
git commit -m "test(e2e): живая проба шапки рынка (Ф4, задача 11)"
git push -u origin feat-cld/market-header-chart
gh pr create --draft --base main --title "feat(terminal): шапка рынка, поиск, вкладки и рамка чарта (Ф4)"
```

Тело PR перечисляет долги из раздела ниже.

---

## Что уезжает вперёд

1. **`?? 25` в тикете.** `useOrderSizing` и `TradeForm` читают `market?.maxLeverage ?? 25`, а
   `GET /markets` этого поля не отдаёт вовсе — значит, лестница плеча всегда строится по выдуманным
   25x. Шапка Ф4 берёт плечо из `initialMarginBps`; тикет остаётся на выдумке до отдельной
   карточки, потому что смена лестницы меняет поведение подачи ордера.
2. **Панель рисования чарта.** Из макета взята рамка, инструменты рисования — нет: они принадлежат
   TradingView Advanced Charts, и решение зафиксировано спекой.
3. **Изменение за сутки — 25 запросов на список.** Каждая строка поиска просит свой ряд свечей.
   Пока рынков пять, это пять запросов, погашенных кэшем react-query; на списке в полсотни рынков
   нужна одна ручка «изменение по всем рынкам» в шлюзе.
4. **Market Cap.** Нужен circulating supply — источника нет ни в шлюзе, ни в SDK. Колонка
   существует прочерком, чтобы не расходиться с макетом структурно.
5. **Spot Price.** Появится, если у контура появится второй ценовой источник; сегодня Mark и Spot
   — один фид Pyth.
6. **Свёртка нижней панели шевроном** — долг Ф3b, не закрытый и здесь.

## Самопроверка плана

- **Покрытие спеки.** «Ф4 · Шапка, выбор рынка, вкладки рынков, рамка чарта» просит четыре вещи:
  `Command`-поиск с избранным (задачи 1, 5, 6), вкладки открытых рынков (задачи 2, 7), OI / 24h
  volume / countdown фандинга (задачи 3, 4, 8), таймфреймы и `%`/`log`/`auto` (задача 9). Countdown
  назван отсутствующим в разделе «Что макет просит, а источника нет» — это отступление от макета,
  объявленное вслух, а не пропуск.
- **Согласованность типов.** `ChartRangeKey` и `ChartScaleMode` объявлены в задаче 2 и потребляются
  задачами 9 (`chartRanges.ts`, `ChartFrame`) — направление импорта одно, цикла нет.
  `MarketRow.volumeUsd` и `MarketRow.openInterest` объявлены `bigint | null` в задаче 5 и всюду
  сверяются через `== null`, покрывая и `undefined`. `CHART_ROUTE` объявлен в задаче 9 и
  используется и в `barsForRange`-тесте, и в `CandleChart`.
- **Заглушек нет.** Каждый шаг несёт либо команду, либо код. Два места оставлены на решение
  исполнителя явно: способ открыть поиск из `+` (задача 7, шаг 1) и обязательность
  `TooltipProvider` (задача 8, шаг 1) — оба с названными вариантами и критерием выбора.
- **Порядок задач.** Мок (задача 3) идёт до всего визуального: без него шапка в e2e показывает
  пять прочерков, и спеки доказывали бы отрисовку прочерка. Спеки, ходившие по `market-select`,
  красные между задачами 6 и 10 — это названо в задаче 6 и не должно пугать исполнителя.
