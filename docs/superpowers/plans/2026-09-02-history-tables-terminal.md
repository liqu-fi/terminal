# Семь историй и панель Account (Ф3b) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** нижняя панель терминала получает семь вкладок на `@tanstack/react-table` —
Positions, Open Orders, Trade History, Order History, Position History, Funding History,
Account History — с сортировкой, видимостью колонок, фильтром по рынку и фуллскрином, а
правая колонка получает панель Account из шести строк макета.

**Architecture:** один общий `DataTable` поверх `useTable` v9 держит механику (модели
строк, состояние сортировки/видимости/фильтра, пустое и загрузочное состояние); каждая
вкладка приносит только описание колонок и хук данных из `@liq/react`. Тулбар вкладки
портируется в строку табов через `createPortal`, поэтому активная таблица владеет своими
меню, а раскладка остаётся одной строкой макета. Данные историй уже есть в SDK 0.45.0
(`usePositionHistoryQuery`, `useSettlementLedgerQuery`, `useOrderHistoryQuery`) — в
терминале не появляется ни одной доменной функции.

**Tech Stack:** React 19, TypeScript 6, `@liq/*` 0.44.0 → 0.45.0,
`@tanstack/react-table` 9.2.4, `radix-ui` через `shadcn/ui`, `@tanstack/react-query`,
`zustand`, Vitest (юниты), Playwright (e2e).

**Spec:** [`docs/superpowers/specs/2026-09-01-trade-core-design.md`](../specs/2026-09-01-trade-core-design.md)
(раздел «Ф3 · Семь историй и панель Account» и таблица «Карта данных»).
**Макет:** `Trading_Flows/Frame-13.png` (фуллскрин, семь вкладок, колонки Positions),
`Frame-14.png` (панель Account), `Frame-15..17.png` (состояния тулбара). Кадры лежат в
`../monorepo/Trading_Flows/` — вне этого репозитория, читать по пути.

## Global Constraints

- **Доменной логики в терминале не появляется.** Любая арифметика — из `@liq/core` /
  `@liq/onchain`. Если нужной функции там нет, это карточка в `monorepo`, а не функция
  здесь. Суммирование колонки по строкам (экспозиция, нереализованный PnL) — не
  арифметика домена, а свод того, что уже посчитано; он допустим.
- **Свои примитивы UI не писать.** Только `pnpm dlx shadcn@latest add <name>` в
  `src/components/ui/`. После генерации — перевод словаря токенов класс в класс
  (см. ниже) и сверка вида.
- **Словарь токенов терминала обязателен.** `bg-surface`, `bg-surface-2`, `text-text`,
  `text-muted`, `text-accent`, `text-long`, `text-short`, `border-border`. Имена shadcn
  (`primary`, `secondary`, `destructive`, `background`, `foreground`, `input`, `popover`,
  `card`, `ring`) запрещены — их стережёт `src/components/ui/__tests__/vocabulary.test.ts`,
  и Tailwind не ломается на них, а молча отдаёт пустоту.
- **Ветка:** `feat-cld/history-tables` (уже создана, стоит на `origin/main` = `79686a7`).
  PR — draft, база `main`, репозиторий `liqu-fi/terminal`.
- **Гейт репозитория** (каждая задача заканчивается зелёным):
  `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build`.
  `pnpm lint` **не использовать** — он резолвится в чужой глобальный ESLint 9.
  e2e (`pnpm test:e2e`) — там, где задача это называет, и обязательно в конце фазы.
- **`data-testid` — контракт.** Снапшот-страж: `src/__tests__/testid-inventory.test.ts`.
  Каждая задача, добавляющая идентификатор, обновляет снапшот в том же коммите
  (`pnpm test -u`), и каждое переименование сопровождается правкой спек, которые по
  нему ходят.
- **Прочерк там, где данных нет.** `—`, а не `0`. Подставленный ноль читается как
  измеренная величина. Это касается `null` в леджере (`fee`, `realizedPnl`,
  `pricePnl`), `undefined` в позиции (`accruedFunding`, `initialMarginUsd`) и ставки
  фандинга, которой нет ни в одном источнике.
- **Подписи валют — из рынка и конфигурации**, а не с картинки (макет подписан `USDT`,
  контур торгует `sUSD`/`USDC`).
- Комментарии — TSDoc, «почему», а не «что». Русский в докблоках допустим (репозиторий
  двуязычен), английский в идентификаторах.

## Что макет показывает, а чего нет

Кадры 13–17 называют все семь вкладок, но **рисуют только Positions**. Колонки шести
остальных в макете не показаны ни разу. Таксономия Liqu (`../Liqu`) им тоже не
соответствует: там вкладки `Limit|Market`, `TP-SL`, `Filled History`, `Forced
Liquidation` — другое деление. Значит колонки шести вкладок выводятся **из формы
данных SDK**, а не переносятся с картинки; ниже они выписаны поимённо.

Три элемента макета в Ф3b не рисуются, и это решения, а не забывчивость:

- **`Close All` и построчные «реверс» / `✕` в Positions** — это подача reduce-only
  ордера, то есть торговля, а не механика таблицы. Спека в Ф3 просит «колонки,
  сортировка, видимость колонок, фильтр, фуллскрин»; в «Карте данных» строка Positions
  называет только `useEnrichedPositions`, `useOpenOrdersQuery`, `orders.count`.
  Переносится вперёд отдельной карточкой.
- **Карандаш «править TP/SL»** — редактирование условного ордера, та же причина.
  Значения TP и SL показываются (они есть в `useConditionalOrders`), править их нельзя.
- **Шеврон «свернуть панель»** в тулбаре — свёртки нижней панели нет ни в состоянии
  экрана (`useTerminalUiStore` знает `chartCollapsed` и `bottomFullscreen`), ни в
  списке Ф3. Тулбар получает три кнопки из четырёх.

## Карта источников (что и откуда)

| Вкладка          | Хук                                                                                                       | Ключевые оговорки                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Positions        | `useEnrichedPositions(allMarketIds)` + `usePricesQuery` + `useConditionalOrders`                          | `isError` ≠ «позиций нет»: это протухший оракул (ERC-7412 ревертит чтение целиком)                                     |
| Open Orders      | `useOpenOrdersQuery` + `useConditionalOrders`                                                             | два списка склеиваются; счётчик в бейдже — длина склейки                                                               |
| Trade History    | `useTradesRestQuery({ accountId, limit: 100 })`                                                           | `fee`, `settlementFee`, `realizedPnl` бывают `null` — «недоказуемо», не ноль                                           |
| Order History    | `useOrderHistoryQuery(accountId)`                                                                         | покрывает терминальные статусы; `MATCHED`, `SETTLEMENT_SUBMITTED`, `FAILED_RETRYABLE` не видны ни здесь, ни в открытых |
| Position History | `usePositionHistoryQuery(accountId)`                                                                      | `available: false` — «источник молчит», это не пустая история                                                          |
| Funding History  | `useAccountLedger()` → строки с `accruedFunding`                                                          | ставки на момент платежа нет ни в одном источнике — колонка обязана быть прочерком                                     |
| Account History  | `useAccountLedger()` → все строки                                                                         | `totals`/`coverage` приезжают только на первой странице                                                                |
| Account (панель) | `useAvailableMarginQuery`, `client.accounts.getMargin`, `onchain.collateral.debt`, `useEnrichedPositions` | см. «Панель Account: откуда шесть чисел»                                                                               |

### Панель Account: откуда шесть чисел

Спека называет источниками `usePortfolioQuery` и `accounts.getMargin`. **`usePortfolioQuery`
в панели не используется**, и это отступление от спеки записано осознанно: его ответ —
серверная реконструкция из сабграфа, кэшируемая пять минут, а суммы в нём пожизненные,
не оконные (`PortfolioSummary` прямо это документирует). Панель, которая обязана
сходиться с `Available` в тикете и с таблицей Positions на том же экране, не может брать
числа из пятиминутной давности пересборки. Цена ошибки — одна замена хука, если продукт
хотел именно исторические числа.

| Строка макета    | Источник                                           | Смысл                                                     |
| ---------------- | -------------------------------------------------- | --------------------------------------------------------- |
| Unrealized PnL   | Σ `EnrichedPosition.unrealizedPnl`                 | ценовая часть PnL открытых позиций                        |
| Account Value    | `Margins.available` (onchain `getAvailableMargin`) | залог, переоценённый по марку                             |
| Equity           | `Margins.available − AccountMargin.locked`         | то же за вычетом офчейн-локов под неурегулированные филлы |
| Borrowed         | `onchain.collateral.debt(accountId)`               | долг Synthetix (копится при закрытии в убыток)            |
| Exposure         | Σ `EnrichedPosition.notional`                      | валовый ноционал                                          |
| Account Leverage | Exposure / Account Value                           | прочерк, когда Account Value ≤ 0                          |

Двух хуков в `@liq/react` для этого нет: `accounts.getMargin` и `collateral.debt` живут
в SDK только методами сервисов. Терминал заворачивает их в локальный `useQuery` — логика
остаётся в SDK, здесь только проводка. **Это пробел SDK и карточка вперёд**
(`useAccountMarginQuery`, `useAccountDebtQuery` в `@liq/react`), а не место, где терминалу
разрешили считать самому.

## Структура файлов

**Создаются:**

- `src/components/ui/table.tsx` — примитив shadcn `table` в словаре терминала.
- `src/components/data-table/features.ts` — набор `tableFeatures` и тип метаданных колонки.
- `src/components/data-table/DataTable.tsx` — рендер таблицы: шапка с сортировкой, тело,
  пустое/загрузочное состояние, портал тулбара.
- `src/components/data-table/DataTableToolbar.tsx` — меню видимости колонок, фильтр по
  рынку, кнопка фуллскрина.
- `src/components/data-table/ToolbarSlotContext.ts` — контейнер тулбара (элемент строки табов).
- `src/components/data-table/__tests__/marketFilter.test.ts` — юнит на чистую функцию фильтра.
- `src/features/userinfo/tabs.ts` — единственный список вкладок и слагов.
- `src/features/orders/OrderHistoryTable.tsx`
- `src/features/history/TradeHistoryTable.tsx` (заменяет `HistoryTable.tsx`)
- `src/features/history/PositionHistoryTable.tsx`
- `src/features/history/FundingHistoryTable.tsx`
- `src/features/history/AccountHistoryTable.tsx`
- `src/features/history/useAccountLedger.ts` — один запрос леджера на две вкладки.
- `src/features/history/__tests__/ledgerRows.test.ts` — юнит на отбор строк фандинга.
- `src/features/account/AccountPanel.tsx`
- `src/features/account/useAccountSummary.ts`
- `src/features/account/__tests__/accountSummary.test.ts` — юнит на свод шести чисел.
- `e2e/tier1/23-history-tables.spec.ts`
- `e2e/tier1/24-account-panel.spec.ts`
- `e2e/tier2/live-history.live.spec.ts`

**Изменяются:**

- `package.json` — `@tanstack/react-table`, восемь пинов SDK.
- `src/lib/format.ts` — `DASH`, `fmtSignedPct`, `fmtLeverage`, `fmtTime`, `fmtHash`.
- `src/features/userinfo/UserInfoTabs.tsx` — семь вкладок, строка табов с тулбаром.
- `src/features/positions/PositionsTable.tsx` — на `DataTable`, колонки по макету.
- `src/features/orders/OpenOrdersTable.tsx` — на `DataTable`.
- `src/features/terminal/Terminal.tsx` — панель Account в правой колонке, кнопка
  фуллскрина уезжает в тулбар.
- `e2e/pages/TerminalPanels.ts` — семь слагов, локаторы тулбара и панели Account.
- `e2e/support/world.ts`, `e2e/support/mockGateway.ts` — ручки историй и фикстуры.
- `e2e/tier1/10-history.spec.ts` — переименованные локаторы.
- `src/__tests__/__snapshots__/testid-inventory.test.ts.snap` — новые идентификаторы.

**Удаляется:** `src/features/history/HistoryTable.tsx` (переезжает в `TradeHistoryTable.tsx`).

---

### Задача 1: Зависимости и подъём SDK

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml` (генерируется)

**Interfaces:**

- Consumes: ничего.
- Produces: `@tanstack/react-table@^9.2.4` и `@liq/*` 0.45.0 доступны остальным задачам;
  из `@liq/react` появляются `useOrderHistoryQuery`, `usePositionHistoryQuery`,
  `useSettlementLedgerQuery`, из `@liq/core` — `OPEN_ORDER_STATUSES`,
  `TERMINAL_ORDER_STATUSES`.

- [ ] **Шаг 1: Поставить таблицу и поднять восемь пинов SDK**

```bash
cd /Users/alex/Work/perps/terminal
pnpm add @tanstack/react-table@^9.2.4
sed -i '' 's#@liqpro/liq-\(api-client\|core\|onchain\|prices\|react\|sdk\|subgraph\|turnkey\)@^0.44.0#@liqpro/liq-\1@^0.45.0#' package.json
pnpm install
```

- [ ] **Шаг 2: Убедиться, что подъём реален, а не только в манифесте**

Run: `node -e "console.log(require('./node_modules/@liq/react/package.json').version)"`
Expected: `0.45.0`

Run: `node -e "const m=require('./node_modules/@liq/react/dist/index.js');console.log(typeof m.useSettlementLedgerQuery, typeof m.useOrderHistoryQuery, typeof m.usePositionHistoryQuery)"`
Expected: три раза `function`. Если хоть одно `undefined` — установился не тот пакет,
дальше идти нельзя: остальные задачи молча упрутся в отсутствующий экспорт.

- [ ] **Шаг 3: Гейт**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build`
Expected: всё зелёное. Кода ещё нет — задача проверяет только то, что подъём версии
ничего не сломал в существующем.

- [ ] **Шаг 4: Коммит**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build(deps): @tanstack/react-table 9 и SDK 0.45.0 (Ф3b, задача 1)"
```

---

### Задача 2: Примитив `table`

**Files:**

- Create: `src/components/ui/table.tsx`

**Interfaces:**

- Consumes: `cn` из `@/lib/utils`.
- Produces: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`,
  `TableCaption` — компоненты `React.ComponentProps<"table"|"thead"|...>`, каждый со
  своим `data-slot`.

- [ ] **Шаг 1: Сгенерировать примитив**

```bash
cd /Users/alex/Work/perps/terminal
pnpm dlx shadcn@latest add table
```

Если сеть недоступна — файл пишется руками по образцу ниже; он и есть каноничный
`new-york`-вариант с уже переведённым словарём.

- [ ] **Шаг 2: Перевести словарь и записать перевод прозой**

`src/components/ui/table.tsx`:

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

// shadcn-словарь заменён нашим, дословно:
//   text-muted-foreground → text-muted   (подписи шапки и caption)
//   bg-muted/50, data-[state=selected]:bg-muted → bg-surface-2
//     (в словаре shadcn `muted` — нейтральная подложка, у нас этот тон занят
//      под «выделено/нажато»: тем же bg-surface-2 красит активный таб TabsList)
//   border-b/border-t у строк оставлены голыми: базовый слой в index.css
//     красит любую границу в var(--border), поэтому цвет называть не нужно.

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-surface-2 font-medium", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-surface-2 data-[state=selected]:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-8 px-2 text-left align-middle text-[11px] font-normal whitespace-nowrap text-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("p-2 align-middle whitespace-nowrap", className)}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
```

- [ ] **Шаг 3: Проверить, что страж словаря доволен**

Run: `pnpm test -- vocabulary`
Expected: PASS. Тест сам обходит весь `src/components/ui`, поэтому новый файл он
подхватывает без правок; падение назовёт файл и запрещённый токен.

- [ ] **Шаг 4: Гейт и коммит**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build`

```bash
git add src/components/ui/table.tsx
git commit -m "feat(ui): примитив table в словаре терминала (Ф3b, задача 2)"
```

---

### Задача 3: Каркас `DataTable`

**Files:**

- Create: `src/components/data-table/features.ts`
- Create: `src/components/data-table/ToolbarSlotContext.ts`
- Create: `src/components/data-table/DataTableToolbar.tsx`
- Create: `src/components/data-table/DataTable.tsx`
- Test: `src/components/data-table/__tests__/marketFilter.test.ts`
- Modify: `src/lib/format.ts`
- Modify: `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`

**Interfaces:**

- Consumes: примитив `table` из задачи 2; `@tanstack/react-table` из задачи 1.
- Produces:
  - `tableFeatures` набор `features` (сортировка, видимость колонок, фильтрация) и
    `type Features = typeof features`;
  - `marketFilterFn(rowMarketId: string, filter: unknown): boolean`;
  - `<DataTable data columns testid empty loading error toolbarExtra />`;
  - `ToolbarSlotContext` — `React.Context<HTMLElement | null>`;
  - из `format.ts`: `DASH`, `fmtSignedPct`, `fmtLeverage`, `fmtTime`, `fmtHash`.

- [ ] **Шаг 1: Написать падающий юнит на фильтр рынка**

`src/components/data-table/__tests__/marketFilter.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { marketFilterFn } from "../features";

describe("фильтр по рынку", () => {
  it("пропускает всё, пока рынок не назван", () => {
    // Значение фильтра приходит из radix-меню, где «все рынки» — это отсутствие
    // выбора. Пустая строка и undefined обязаны значить одно и то же, иначе
    // сброс фильтра оставлял бы таблицу пустой.
    expect(marketFilterFn("200", undefined)).toBe(true);
    expect(marketFilterFn("200", "")).toBe(true);
    expect(marketFilterFn("200", ALL)).toBe(true);
  });

  it("сравнивает идентификаторы как строки, а не как числа", () => {
    // marketId доезжает и bigint-ом (позиции), и строкой (ордера). Строгое
    // равенство разных типов молча отфильтровало бы всё.
    expect(marketFilterFn("200", "200")).toBe(true);
    expect(marketFilterFn("201", "200")).toBe(false);
  });
});

const ALL = "all";
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Run: `pnpm test -- marketFilter`
Expected: FAIL — `Failed to resolve import "../features"`.

- [ ] **Шаг 3: Набор фич и фильтр**

`src/components/data-table/features.ts`:

```ts
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * Значение фильтра «рынок не выбран».
 *
 * @remarks Отдельная строка, а не `undefined`: radix `DropdownMenuRadioGroup`
 * хранит выбор строкой и пустую строку считает «ничего не выбрано», из-за чего
 * пункт «все рынки» не подсвечивался бы как активный.
 */
export const ALL_MARKETS = "all";

/**
 * Набор возможностей таблицы. В v9 фичи регистрируются явно: без
 * `rowSortingFeature` у колонки нет ни `getIsSorted`, ни `getToggleSortingHandler`,
 * и отсутствие метода читается как ошибка типов, а не как незарегистрированная фича.
 */
export const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnVisibilityFeature,
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  sortFns,
});

export type Features = typeof features;

/**
 * Общий предикат фильтра по рынку.
 *
 * @remarks Один на все семь таблиц: рынок — единственное измерение, которое есть
 * в каждой из них, и фильтр обязан значить в них одно и то же. Сравнение
 * строковое, потому что `marketId` доезжает в строках `bigint`-ом (позиции) и
 * строкой (ордера, сделки, леджер).
 */
export function marketFilterFn(rowMarketId: string, filter: unknown): boolean {
  if (filter === undefined || filter === null) return true;
  const wanted = String(filter);
  if (wanted === "" || wanted === ALL_MARKETS) return true;
  return rowMarketId === wanted;
}
```

- [ ] **Шаг 4: Прогнать юнит**

Run: `pnpm test -- marketFilter`
Expected: PASS (обе спеки).

- [ ] **Шаг 5: Форматтеры**

Дописать в конец `src/lib/format.ts`:

```ts
/** Прочерк — единственное написание «данных нет» на экране. */
export const DASH = "—";

/** WAD-доля (1e18 = 100%) со знаком: «+1.23%». */
export function fmtSignedPct(ratio: bigint): string {
  const pct = toNum(ratio) * 100;
  return `${pct < 0 ? "" : "+"}${pct.toFixed(2)}%`;
}

/** WAD-плечо: «10x», «3.5x». Целое печатается без дробной части. */
export function fmtLeverage(wad: bigint): string {
  const n = toNum(wad);
  return `${Number(n.toFixed(1))}x`;
}

/** Unix-миллисекунды → «02.09 14:35» в локали пользователя. */
export function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Хэш транзакции в человеческий вид: «0xabcd…ef01». */
export function fmtHash(hash: string): string {
  return hash.length <= 12 ? hash : `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}
```

- [ ] **Шаг 6: Контекст слота тулбара**

`src/components/data-table/ToolbarSlotContext.ts`:

```ts
import { createContext } from "react";

/**
 * Куда активная таблица кладёт свой тулбар.
 *
 * @remarks Меню видимости колонок и фильтр принадлежат конкретной таблице (у
 * каждой вкладки свои колонки и своё состояние), а по макету стоят в строке
 * табов. Портал в этот элемент — способ оставить владение таблице, не переставая
 * рисовать тулбар там, где он нарисован в макете. `null` значит «слота нет»:
 * тогда `DataTable` рисует тулбар над собой и остаётся годным в одиночку.
 */
export const ToolbarSlotContext = createContext<HTMLElement | null>(null);
```

- [ ] **Шаг 7: Тулбар**

`src/components/data-table/DataTableToolbar.tsx`:

```tsx
import { Columns3, Filter } from "lucide-react";
import type { ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ALL_MARKETS } from "./features";

/** Что тулбару нужно знать о колонке — ровно столько и ничего больше. */
export interface ToolbarColumn {
  id: string;
  label: string;
  visible: boolean;
  canHide: boolean;
  toggle: () => void;
}

export interface ToolbarMarket {
  id: string;
  symbol: string;
}

export function DataTableToolbar({
  columns,
  markets,
  market,
  onMarketChange,
  extra,
}: {
  columns: ToolbarColumn[];
  markets: ToolbarMarket[];
  market: string;
  onMarketChange: (value: string) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2" data-testid="table-toolbar">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="text-muted hover:text-text data-[state=open]:text-text"
          aria-label="Видимость колонок"
          data-testid="table-columns-button"
        >
          <Columns3 size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" data-testid="table-columns-menu">
          {columns.map((c) => (
            <DropdownMenuCheckboxItem
              key={c.id}
              checked={c.visible}
              disabled={!c.canHide}
              onCheckedChange={c.toggle}
              onSelect={(e) => e.preventDefault()}
              data-testid={`table-column-toggle-${c.id}`}
            >
              {c.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={
            market === ALL_MARKETS
              ? "text-muted hover:text-text"
              : "text-accent"
          }
          aria-label="Фильтр по рынку"
          data-testid="table-filter-button"
        >
          <Filter size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" data-testid="table-filter-menu">
          <DropdownMenuRadioGroup value={market} onValueChange={onMarketChange}>
            <DropdownMenuRadioItem
              value={ALL_MARKETS}
              data-testid="table-filter-option-all"
            >
              All markets
            </DropdownMenuRadioItem>
            {markets.map((m) => (
              <DropdownMenuRadioItem
                key={m.id}
                value={m.id}
                data-testid={`table-filter-option-${m.id}`}
              >
                {m.symbol}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {extra}
    </div>
  );
}
```

- [ ] **Шаг 8: Сам `DataTable`**

`src/components/data-table/DataTable.tsx`:

```tsx
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  useTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { useContext, useState } from "react";
import { createPortal } from "react-dom";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ALL_MARKETS, features } from "./features";
import { DataTableToolbar, type ToolbarMarket } from "./DataTableToolbar";
import { ToolbarSlotContext } from "./ToolbarSlotContext";

/** Идентификатор колонки, по которой фильтруют рынок. Один во всех таблицах. */
export const MARKET_COLUMN_ID = "market";

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<typeof features, T, any>[];
  /** Корневой `data-testid`; из него же выводятся `-empty` и `-loading`. */
  testid: string;
  rowId: (row: T) => string;
  markets: ToolbarMarket[];
  loading?: boolean;
  /** Сообщение вместо таблицы: пусто, ошибка, источник молчит. */
  notice?: { testid: string; text: string } | null;
  emptyText: string;
  /** Кнопка фуллскрина — её владелец панель, а не таблица. */
  toolbarExtra?: ReactNode;
}

/**
 * Одна механика на семь вкладок: сортировка кликом по шапке, видимость колонок,
 * фильтр по рынку.
 *
 * @remarks Состояние держит React, а не таблица: `useTable` в v9 отдаёт слайс
 * во владение тому, кто передал пару `state` + `on…Change`, и оба обязаны быть
 * названы вместе — один только колбэк оставил бы значение неписанным.
 *
 * Тулбар уезжает порталом в `ToolbarSlotContext`, когда слот есть: по макету он
 * стоит в строке табов, а принадлежит таблице. Без слота рисуется над таблицей,
 * так что компонент остаётся самодостаточным.
 */
export function DataTable<T>({
  data,
  columns,
  testid,
  rowId,
  markets,
  loading = false,
  notice = null,
  emptyText,
  toolbarExtra,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const slot = useContext(ToolbarSlotContext);

  const table = useTable({
    features,
    data,
    columns,
    getRowId: (row) => rowId(row),
    state: { sorting, columnVisibility, columnFilters },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
  });

  const marketFilter = table.getColumn(MARKET_COLUMN_ID);
  const market = (marketFilter?.getFilterValue() as string) ?? ALL_MARKETS;

  const toolbar = (
    <DataTableToolbar
      columns={table.getAllLeafColumns().map((c) => ({
        id: c.id,
        label:
          typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
        visible: c.getIsVisible(),
        canHide: c.getCanHide(),
        toggle: () => c.toggleVisibility(),
      }))}
      markets={markets}
      market={market}
      onMarketChange={(value) =>
        marketFilter?.setFilterValue(value === ALL_MARKETS ? undefined : value)
      }
      extra={toolbarExtra}
    />
  );

  const rows = table.getRowModel().rows;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {slot ? createPortal(toolbar, slot) : toolbar}
      {loading ? (
        <div
          className="py-6 text-center text-sm text-muted"
          data-testid={`${testid}-loading`}
        >
          Loading…
        </div>
      ) : notice ? (
        <div
          className="py-6 text-center text-sm text-muted"
          data-testid={notice.testid}
        >
          {notice.text}
        </div>
      ) : rows.length === 0 ? (
        <div
          className="py-6 text-center text-sm text-muted"
          data-testid={`${testid}-empty`}
        >
          {emptyText}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Table data-testid={testid}>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className={
                          header.column.getCanSort()
                            ? "cursor-pointer select-none hover:text-text"
                            : undefined
                        }
                        data-testid={`table-header-${header.column.id}`}
                      >
                        {header.isPlaceholder ? null : (
                          <span className="inline-flex items-center gap-1">
                            <table.FlexRender header={header} />
                            {sorted === "asc" ? (
                              <ChevronUp size={12} />
                            ) : sorted === "desc" ? (
                              <ChevronDown size={12} />
                            ) : null}
                          </span>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-testid={`${testid}-row-${row.id}`}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Шаг 9: Гейт и снапшот идентификаторов**

Run: `pnpm test -u && pnpm typecheck && node_modules/.bin/eslint . && pnpm build`
Expected: всё зелёное; в снапшоте появляются `table-toolbar`, `table-columns-button`,
`table-columns-menu`, `table-column-toggle-*`, `table-filter-button`,
`table-filter-menu`, `table-filter-option-*`, `table-header-*`.

- [ ] **Шаг 10: Коммит**

```bash
git add src/components/data-table src/lib/format.ts src/__tests__/__snapshots__
git commit -m "feat(table): каркас DataTable на react-table v9 (Ф3b, задача 3)"
```

---

### Задача 4: Семь вкладок и строка тулбара

**Files:**

- Create: `src/features/userinfo/tabs.ts`
- Modify: `src/features/userinfo/UserInfoTabs.tsx`
- Modify: `src/features/terminal/Terminal.tsx`
- Modify: `e2e/pages/TerminalPanels.ts`
- Modify: `e2e/tier1/10-history.spec.ts`
- Modify: `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`

**Interfaces:**

- Consumes: `ToolbarSlotContext` из задачи 3; существующие `PositionsTable`,
  `OpenOrdersTable`, `HistoryTable`.
- Produces: `USER_TABS` — массив `{ slug, label }` из семи элементов; вкладка
  `trade-history` заменяет прежнюю `history`; кнопка `bottom-fullscreen-toggle`
  живёт теперь в строке табов, а не в `Terminal.tsx`.

На этой задаче шесть вкладок из семи ещё рисуют заглушку «скоро» — данные приезжают
задачами 5–10. Так вкладки, тулбар и фуллскрин проверяются отдельно от колонок.

- [ ] **Шаг 1: Список вкладок одним местом**

`src/features/userinfo/tabs.ts`:

```ts
/**
 * Семь вкладок нижней панели в порядке макета (Frame-13).
 *
 * @remarks Слаг — контракт с e2e (`userinfo-tab-{slug}`), поэтому список живёт
 * отдельно от разметки: переименование ярлыка не должно двигать локаторы.
 */
export const USER_TABS = [
  { slug: "positions", label: "Positions" },
  { slug: "open-orders", label: "Open Orders" },
  { slug: "trade-history", label: "Trade History" },
  { slug: "order-history", label: "Order History" },
  { slug: "position-history", label: "Position History" },
  { slug: "funding-history", label: "Funding History" },
  { slug: "account-history", label: "Account History" },
] as const;

export type UserTabSlug = (typeof USER_TABS)[number]["slug"];
```

- [ ] **Шаг 2: Строка табов с тулбаром и фуллскрином**

`src/features/userinfo/UserInfoTabs.tsx` целиком:

```tsx
import { Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";

import { ToolbarSlotContext } from "@/components/data-table/ToolbarSlotContext";
import { Card } from "@/components/ui/card";
import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

import { HistoryTable } from "../history/HistoryTable";
import { OpenOrdersTable } from "../orders/OpenOrdersTable";
import { PositionsTable } from "../positions/PositionsTable";
import { USER_TABS, type UserTabSlug } from "./tabs";
import { useLiveOrders } from "./useLiveOrders";

export function UserInfoTabs() {
  useLiveOrders(); // SSE subscription side-effect
  const [tab, setTab] = useState<UserTabSlug>("positions");
  // Элемент, а не ref: портал должен перерисоваться, когда узел появится, а
  // изменение ref-объекта рендер не запускает — таблица нарисовала бы тулбар
  // мимо слота на первом проходе и осталась бы так навсегда.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const bottomFullscreen = useTerminalUiStore((s) => s.bottomFullscreen);
  const toggleBottomFullscreen = useTerminalUiStore(
    (s) => s.toggleBottomFullscreen,
  );

  const fullscreenButton = (
    <button
      type="button"
      onClick={toggleBottomFullscreen}
      data-testid="bottom-fullscreen-toggle"
      aria-label={bottomFullscreen ? "Свернуть панель" : "Развернуть панель"}
      className="text-muted hover:text-text"
    >
      {bottomFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  );

  return (
    <Card className="flex min-h-0 flex-1 flex-col p-3" data-testid="userinfo">
      <div className="mb-2 flex items-center gap-4 border-b border-border pb-2 text-sm">
        {USER_TABS.map((t) => (
          <button
            key={t.slug}
            onClick={() => setTab(t.slug)}
            className={
              tab === t.slug ? "font-semibold text-text" : "text-muted"
            }
            data-testid={`userinfo-tab-${t.slug}`}
            aria-pressed={tab === t.slug}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <div ref={setSlot} className="flex items-center gap-2" />
      </div>
      <ToolbarSlotContext.Provider value={slot}>
        {tab === "positions" && <PositionsTable toolbarExtra={fullscreenButton} />}
        {tab === "open-orders" && (
          <OpenOrdersTable toolbarExtra={fullscreenButton} />
        )}
        {tab === "trade-history" && (
          <HistoryTable toolbarExtra={fullscreenButton} />
        )}
        {tab === "order-history" && <Soon slug="order-history" />}
        {tab === "position-history" && <Soon slug="position-history" />}
        {tab === "funding-history" && <Soon slug="funding-history" />}
        {tab === "account-history" && <Soon slug="account-history" />}
      </ToolbarSlotContext.Provider>
    </Card>
  );
}

/** Временная заглушка вкладки, чью таблицу приносит одна из задач 8–10. */
function Soon({ slug }: { slug: string }) {
  return (
    <div
      className="py-6 text-center text-sm text-muted"
      data-testid={`${slug}-empty`}
    >
      —
    </div>
  );
}
```

`PositionsTable`, `OpenOrdersTable` и `HistoryTable` на этом шаге получают новый
необязательный проп и **пока его игнорируют** — сигнатура меняется одной строкой в
каждом:

```tsx
export function PositionsTable({ toolbarExtra }: { toolbarExtra?: ReactNode }) {
```

`toolbarExtra` не используется до задач 5–7; ESLint на неиспользованный проп не
ругается (правило включено на переменные, не на деструктуризацию пропсов) — если
ругнётся, добавить `void toolbarExtra;` первой строкой и убрать её в своей задаче.

- [ ] **Шаг 3: Убрать кнопку фуллскрина из оболочки**

В `src/features/terminal/Terminal.tsx` удалить весь блок

```tsx
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={toggleBottomFullscreen}
                data-testid="bottom-fullscreen-toggle"
                …
              </button>
            </div>
```

вместе с чтением `bottomFullscreen`/`toggleBottomFullscreen`, которые после этого
нужны только для `defaultSize` панели и условной шапки:

```tsx
  const bottomFullscreen = useTerminalUiStore((s) => s.bottomFullscreen);
```

`toggleBottomFullscreen` и импорты `Maximize2`/`Minimize2` из `Terminal.tsx` уходят.

- [ ] **Шаг 4: Обновить page object**

В `e2e/pages/TerminalPanels.ts`:

```ts
type UserTab =
  | "positions"
  | "open-orders"
  | "trade-history"
  | "order-history"
  | "position-history"
  | "funding-history"
  | "account-history";
```

и добавить в `UserInfoPanel` локаторы тулбара:

```ts
  get columnsButton(): Locator {
    return this.page.getByTestId("table-columns-button");
  }
  get columnsMenu(): Locator {
    return this.page.getByTestId("table-columns-menu");
  }
  columnToggle(id: string): Locator {
    return this.page.getByTestId(`table-column-toggle-${id}`);
  }
  get filterButton(): Locator {
    return this.page.getByTestId("table-filter-button");
  }
  filterOption(marketId: string): Locator {
    return this.page.getByTestId(`table-filter-option-${marketId}`);
  }
  header(columnId: string): Locator {
    return this.page.getByTestId(`table-header-${columnId}`);
  }
```

- [ ] **Шаг 5: Починить спеку истории под новый слаг**

В `e2e/tier1/10-history.spec.ts` четыре вызова `userInfo.selectTab("history")`
заменить на `userInfo.selectTab("trade-history")`. Больше в этой спеке ничего не
меняется — `history-table` и `history-empty` переименуются в задаче 7.

- [ ] **Шаг 6: Гейт, включая e2e**

Run: `pnpm test -u && pnpm typecheck && node_modules/.bin/eslint . && pnpm build`
Run: `pnpm test:e2e`
Expected: 143 спеки зелёные. Спека `19-layout` ходит по `bottom-fullscreen-toggle` —
кнопка переехала, но идентификатор тот же, поэтому она обязана пройти без правок; её
падение значит, что кнопка не отрисовалась (слот тулбара не смонтирован).

- [ ] **Шаг 7: Коммит**

```bash
git add src/features/userinfo src/features/terminal/Terminal.tsx \
  src/features/positions/PositionsTable.tsx src/features/orders/OpenOrdersTable.tsx \
  src/features/history/HistoryTable.tsx e2e/pages/TerminalPanels.ts \
  e2e/tier1/10-history.spec.ts src/__tests__/__snapshots__
git commit -m "feat(userinfo): семь вкладок и строка тулбара (Ф3b, задача 4)"
```

---

### Задача 5: Positions на `DataTable`

**Files:**

- Modify: `src/features/positions/PositionsTable.tsx`
- Modify: `e2e/tier1/08-positions.spec.ts`
- Modify: `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`

**Interfaces:**

- Consumes: `DataTable`, `MARKET_COLUMN_ID`, `features`, `marketFilterFn` (задача 3);
  `USER_TABS` (задача 4).
- Produces: `data-testid="positions-table"` теперь на `<table>` внутри `DataTable`;
  строка — `positions-table-row-{marketId}`. **Прежний `position-row-{marketId}`
  сохраняется** как алиас на той же `<tr>`, чтобы спеки 08 не переписывать целиком.

- [ ] **Шаг 1: Колонки и таблица**

`src/features/positions/PositionsTable.tsx` целиком:

```tsx
import { abs, Qty, Side, Usd } from "@liq/sdk";
import { useConditionalOrders, useEnrichedPositions, usePricesQuery } from "@liq/react";
import type { EnrichedPosition } from "@liq/onchain";
import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useMemo } from "react";

import {
  DataTable,
  MARKET_COLUMN_ID,
} from "@/components/data-table/DataTable";
import { features, marketFilterFn } from "@/components/data-table/features";

import {
  DASH,
  fmtLeverage,
  fmtPrice,
  fmtQty,
  fmtSignedPct,
  fmtSignedUsd,
  fmtUsd,
} from "../../lib/format";
import { useSelectedMarket } from "../market/useSelectedMarket";

/** Строка таблицы: позиция плюс то, что к ней приклеено с других запросов. */
interface PositionRow {
  position: EnrichedPosition;
  symbol: string;
  markPrice: bigint | undefined;
  takeProfit: bigint | undefined;
  stopLoss: bigint | undefined;
}

const helper = createColumnHelper<typeof features, PositionRow>();

const columns = helper.columns([
  helper.accessor((r) => r.symbol, {
    id: MARKET_COLUMN_ID,
    header: "Market",
    enableHiding: false,
    filterFn: (row, _id, value) =>
      marketFilterFn(row.original.position.marketId.toString(), value),
    cell: (info) => (
      <span className="font-semibold">{info.getValue()}</span>
    ),
  }),
  helper.accessor((r) => (r.position.side === Side.BUY ? 1 : 0), {
    id: "side",
    header: "Side",
    cell: (info) => {
      const p = info.row.original.position;
      const long = p.side === Side.BUY;
      return (
        <span className="inline-flex items-center gap-1">
          <span
            className={`rounded-sm px-1 text-[11px] ${long ? "bg-long-soft text-long" : "bg-short-soft text-short"}`}
          >
            {long ? "Long" : "Short"}
          </span>
          <span className="rounded-sm bg-surface-2 px-1 text-[11px] text-muted">
            {fmtLeverage(p.leverage)}
          </span>
        </span>
      );
    },
  }),
  helper.accessor((r) => Number(r.position.notional), {
    id: "value",
    header: "Value / Size",
    cell: (info) => {
      const r = info.row.original;
      return (
        <span className="flex flex-col leading-tight">
          <span>{fmtUsd(r.position.notional)}</span>
          <span className="text-[11px] text-muted">
            ≈ {fmtQty(abs(r.position.size))}
          </span>
        </span>
      );
    },
  }),
  helper.accessor((r) => Number(r.position.entryPrice), {
    id: "entry",
    header: "Entry Price",
    cell: (info) => fmtPrice(info.row.original.position.entryPrice),
  }),
  helper.accessor((r) => Number(r.markPrice ?? 0n), {
    id: "mark",
    header: "Mark Price",
    cell: (info) => {
      const mark = info.row.original.markPrice;
      return mark === undefined ? DASH : fmtPrice(mark);
    },
  }),
  helper.accessor((r) => Number(r.position.liquidationPrice), {
    id: "liq",
    header: "Liq. Price",
    // ZERO_PRICE — «показывать нечего» (неизвестный марк, плоская позиция,
    // уровень ниже нуля), а не цена ноль.
    cell: (info) => {
      const liq = info.row.original.position.liquidationPrice;
      return liq === 0n ? DASH : fmtPrice(liq);
    },
  }),
  helper.accessor((r) => Number(r.position.initialMarginUsd ?? 0n), {
    id: "margin",
    header: "Margin",
    cell: (info) => {
      const m = info.row.original.position.initialMarginUsd;
      return m === undefined ? DASH : fmtUsd(m);
    },
  }),
  helper.accessor((r) => Number(r.position.accruedFunding ?? 0n), {
    id: "funding",
    header: "Funding",
    // `undefined` — «фандинг не известен». Ноль читался бы как «платежей не было».
    cell: (info) => {
      const f = info.row.original.position.accruedFunding;
      return f === undefined ? DASH : fmtSignedUsd(f);
    },
  }),
  helper.accessor((r) => Number(r.position.unrealizedPnl), {
    id: "upnl",
    header: "Unrealized P&L",
    cell: (info) => {
      const p = info.row.original.position;
      const tone = p.unrealizedPnl < 0n ? "text-short" : "text-long";
      return (
        <span className={`flex flex-col leading-tight ${tone}`}>
          <span>{fmtSignedUsd(p.unrealizedPnl)}</span>
          <span className="text-[11px]">{fmtSignedPct(p.pnlRatio)}</span>
        </span>
      );
    },
  }),
  helper.display({
    id: "rpnl",
    header: "Realized P&L",
    // У открытой позиции реализованного PnL нет ни в одном чтении: он появляется
    // строкой леджера при расчёте и эпизодом в истории позиций. Ноль здесь
    // означал бы «сделок не было», что для позиции с историей ложь.
    cell: () => <span className="text-muted">{DASH}</span>,
  }),
  helper.display({
    id: "tpsl",
    header: "TP / SL",
    cell: (info) => {
      const { takeProfit, stopLoss } = info.row.original;
      return (
        <span className="flex flex-col leading-tight text-[11px]">
          <span className="text-long">
            {takeProfit === undefined ? DASH : fmtPrice(takeProfit)}
          </span>
          <span className="text-short">
            {stopLoss === undefined ? DASH : fmtPrice(stopLoss)}
          </span>
        </span>
      );
    },
  }),
]);

export function PositionsTable({ toolbarExtra }: { toolbarExtra?: ReactNode }) {
  const { markets, allMarketIds } = useSelectedMarket();
  const {
    data: positions = EMPTY_POSITIONS,
    isLoading,
    isError,
  } = useEnrichedPositions(allMarketIds);
  const { data: prices } = usePricesQuery(allMarketIds);
  const { data: conditional = EMPTY_ORDERS } = useConditionalOrders();

  const rows = useMemo<PositionRow[]>(
    () =>
      positions.map((position) => {
        const key = position.marketId.toString();
        const triggers = conditional.filter((o) => o.marketId === key);
        const tp = triggers.find((o) => o.orderType.startsWith("TAKE_PROFIT"));
        const sl = triggers.find((o) => o.orderType.startsWith("STOP"));
        return {
          position,
          symbol:
            markets.find((m) => m.id === position.marketId)?.symbol ?? key,
          markPrice: prices?.[key]?.price,
          takeProfit: tp?.triggerPrice ? BigInt(tp.triggerPrice) : undefined,
          stopLoss: sl?.triggerPrice ? BigInt(sl.triggerPrice) : undefined,
        };
      }),
    [positions, conditional, markets, prices],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      testid="positions-table"
      rowId={(r) => r.position.marketId.toString()}
      markets={markets.map((m) => ({ id: m.id.toString(), symbol: m.symbol }))}
      loading={isLoading}
      // Пустой ответ и провалившееся чтение — разные вещи: `useEnrichedPositions`
      // роняет запрос, когда ERC-7412 отревертил чтение по протухшему оракулу,
      // и «позиций нет» на этом месте было бы прямой ложью.
      notice={
        isError
          ? { testid: "positions-error", text: "Price feed is stale — positions unavailable." }
          : null
      }
      emptyText="No open positions."
      toolbarExtra={toolbarExtra}
    />
  );
}

const EMPTY_POSITIONS: EnrichedPosition[] = [];
const EMPTY_ORDERS: ReturnType<typeof useConditionalOrders>["data"] & object =
  [] as never;
```

Идентификаторы `positions-loading` / `positions-empty` из прежней таблицы становятся
`positions-table-loading` / `positions-table-empty` (их выводит `DataTable` из
`testid`). Прежние имена в спеках заменяются на шаге 2.

- [ ] **Шаг 2: Обновить спеку позиций**

В `e2e/tier1/08-positions.spec.ts`:

- `userInfo.positionsLoading` → локатор `positions-table-loading`,
  `userInfo.positionsEmpty` → `positions-table-empty` (правится в
  `e2e/pages/TerminalPanels.ts`, не в спеке);
- `userInfo.positionRow(id)` → `positions-table-row-{id}` (тоже в page object);
- индексы ячеек: колонок стало 11 вместо 5. `Entry` — индекс 3, `uPnL` — индекс 8.
  Заменить `nth(2)` → `nth(3)` и `nth(3)` → `nth(8)` в первом тесте; в третьем
  `nth(1)` (размер) → `nth(2)`, а проверка «↓» заменяется на `toContainText("Short")`
  и класс `text-short` берётся с ячейки `nth(1)`.

Правки page object:

```ts
  get positionsLoading(): Locator {
    return this.page.getByTestId("positions-table-loading");
  }
  get positionsEmpty(): Locator {
    return this.page.getByTestId("positions-table-empty");
  }
  positionRow(marketId: string): Locator {
    return this.page.getByTestId(`positions-table-row-${marketId}`);
  }
```

- [ ] **Шаг 3: Прогнать спеку позиций**

Run: `pnpm test:e2e e2e/tier1/08-positions.spec.ts`
Expected: 6 тестов зелёные.

- [ ] **Шаг 4: Гейт и коммит**

Run: `pnpm test -u && pnpm typecheck && node_modules/.bin/eslint . && pnpm build`

```bash
git add src/features/positions e2e/tier1/08-positions.spec.ts \
  e2e/pages/TerminalPanels.ts src/__tests__/__snapshots__
git commit -m "feat(positions): таблица позиций по макету на DataTable (Ф3b, задача 5)"
```

---

### Задача 6: Open Orders на `DataTable`

**Files:**

- Modify: `src/features/orders/OpenOrdersTable.tsx`
- Modify: `src/features/userinfo/UserInfoTabs.tsx` (счётчик в ярлыке вкладки)
- Modify: `e2e/pages/TerminalPanels.ts`
- Modify: `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`

**Interfaces:**

- Consumes: `DataTable`, `MARKET_COLUMN_ID`, `marketFilterFn`, `parseWadLoose`.
- Produces: `orders-table` на `<table>`, строка `orders-table-row-{id}`; кнопка
  `cancel-order-{id}` сохраняет имя; вкладка получает бейдж
  `userinfo-tab-badge-open-orders`.

- [ ] **Шаг 1: Колонки и таблица**

`src/features/orders/OpenOrdersTable.tsx` целиком:

```tsx
import type { GatewayOrder } from "@liq/core";
import {
  useAccountId,
  useCancelOrderMutation,
  useConditionalOrders,
  useOpenOrdersQuery,
} from "@liq/react";
import { Side } from "@liq/sdk";
import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { DataTable, MARKET_COLUMN_ID } from "@/components/data-table/DataTable";
import { features, marketFilterFn } from "@/components/data-table/features";

import {
  DASH,
  fmtPrice,
  fmtQty,
  fmtTime,
  parseWadLoose,
} from "../../lib/format";
import { useSelectedMarket } from "../market/useSelectedMarket";

interface OrderRow {
  order: GatewayOrder;
  symbol: string;
  cancel: (id: string) => void;
  cancelling: boolean;
}

const helper = createColumnHelper<typeof features, OrderRow>();

const columns = helper.columns([
  helper.accessor((r) => Date.parse(r.order.createdAt), {
    id: "time",
    header: "Time",
    cell: (info) => (
      <span className="text-muted">{fmtTime(info.getValue())}</span>
    ),
  }),
  helper.accessor((r) => r.symbol, {
    id: MARKET_COLUMN_ID,
    header: "Market",
    enableHiding: false,
    filterFn: (row, _id, value) =>
      marketFilterFn(row.original.order.marketId, value),
    cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
  }),
  helper.accessor((r) => r.order.orderType, {
    id: "type",
    header: "Type",
    cell: (info) => <span className="text-muted">{info.getValue()}</span>,
  }),
  helper.accessor((r) => r.order.side, {
    id: "side",
    header: "Side",
    cell: (info) => (
      <span
        className={
          info.getValue() === Side.BUY ? "text-long" : "text-short"
        }
      >
        {info.getValue()}
      </span>
    ),
  }),
  helper.accessor((r) => Number(parseWadLoose(r.order.sizeDelta)), {
    id: "size",
    header: "Size",
    cell: (info) => {
      const size = parseWadLoose(info.row.original.order.sizeDelta);
      return fmtQty(size < 0n ? -size : size);
    },
  }),
  helper.accessor((r) => Number(parseWadLoose(r.order.limitPrice ?? "0")), {
    id: "price",
    header: "Price",
    cell: (info) => {
      const px = info.row.original.order.limitPrice;
      return px && px !== "0" ? fmtPrice(parseWadLoose(px)) : DASH;
    },
  }),
  helper.accessor((r) => Number(parseWadLoose(r.order.triggerPrice ?? "0")), {
    id: "trigger",
    header: "Trigger",
    cell: (info) => {
      const px = info.row.original.order.triggerPrice;
      return px && px !== "0" ? fmtPrice(parseWadLoose(px)) : DASH;
    },
  }),
  helper.accessor((r) => r.order.status, {
    id: "status",
    header: "Status",
    cell: (info) => <span className="text-muted">{info.getValue()}</span>,
  }),
  helper.display({
    id: "actions",
    header: "",
    enableHiding: false,
    cell: (info) => {
      const r = info.row.original;
      return (
        <button
          type="button"
          className="text-[11px] text-short disabled:opacity-50"
          disabled={r.cancelling}
          onClick={() => r.cancel(r.order.id)}
          data-testid={`cancel-order-${r.order.id}`}
        >
          Cancel
        </button>
      );
    },
  }),
]);

/** Открытые и условные ордера одной таблицей — как их видит трейдер. */
export function useOpenOrderRows(): {
  rows: OrderRow[];
  isLoading: boolean;
} {
  const { markets } = useSelectedMarket();
  const accountId = useAccountId();
  const { data: open = EMPTY, isLoading } = useOpenOrdersQuery(accountId);
  const { data: conditional = EMPTY } = useConditionalOrders();
  // Отмена в SDK инвалидирует оба списка (monorepo#453), поэтому здесь ничего
  // инвалидировать не надо.
  const cancel = useCancelOrderMutation(accountId);

  const rows = useMemo<OrderRow[]>(
    () =>
      [...open, ...conditional].map((order) => ({
        order,
        symbol:
          markets.find((m) => m.id.toString() === order.marketId)?.symbol ??
          order.marketId,
        cancel: (id: string) => cancel.mutate(id),
        cancelling: cancel.isPending,
      })),
    [open, conditional, markets, cancel],
  );

  return { rows, isLoading };
}

export function OpenOrdersTable({
  toolbarExtra,
}: {
  toolbarExtra?: ReactNode;
}) {
  const { markets } = useSelectedMarket();
  const { rows, isLoading } = useOpenOrderRows();

  return (
    <DataTable
      data={rows}
      columns={columns}
      testid="orders-table"
      rowId={(r) => r.order.id}
      markets={markets.map((m) => ({ id: m.id.toString(), symbol: m.symbol }))}
      loading={isLoading}
      emptyText="No open orders."
      toolbarExtra={toolbarExtra}
    />
  );
}

const EMPTY: GatewayOrder[] = [];
```

- [ ] **Шаг 2: Бейдж со счётчиком на вкладке**

В `UserInfoTabs.tsx` вкладка `open-orders` получает число рядом с ярлыком:

```tsx
import { useOpenOrderRows } from "../orders/OpenOrdersTable";
```

```tsx
  const { rows: openOrderRows } = useOpenOrderRows();
```

и внутри `USER_TABS.map`:

```tsx
            {t.label}
            {t.slug === "open-orders" && openOrderRows.length > 0 && (
              <span
                className="ml-1 rounded-sm bg-surface-2 px-1 text-[11px] text-muted"
                data-testid="userinfo-tab-badge-open-orders"
              >
                {openOrderRows.length}
              </span>
            )}
```

Бейдж считает **загруженные** строки, а не всё, что есть на шлюзе: `orders.count`
отдельным запросом здесь не зовётся, а полная страница неотличима от обрезанной.
Для нынешнего лимита это одно и то же число.

- [ ] **Шаг 3: Обновить page object**

```ts
  get ordersEmpty(): Locator {
    return this.page.getByTestId("orders-table-empty");
  }
  orderRow(id: string): Locator {
    return this.page.getByTestId(`orders-table-row-${id}`);
  }
```

- [ ] **Шаг 4: Прогнать спеку ордеров**

Run: `pnpm test:e2e e2e/tier1/09-orders-cancel.spec.ts e2e/tier1/06-trade-conditional.spec.ts`
Expected: зелёные. Спека 06 кладёт условный ордер и ищет его в списке — она проверяет
склейку двух источников.

- [ ] **Шаг 5: Гейт и коммит**

Run: `pnpm test -u && pnpm typecheck && node_modules/.bin/eslint . && pnpm build`

```bash
git add src/features/orders src/features/userinfo e2e/pages/TerminalPanels.ts \
  src/__tests__/__snapshots__
git commit -m "feat(orders): открытые ордера на DataTable и счётчик вкладки (Ф3b, задача 6)"
```

---

### Задача 7: Trade History

**Files:**

- Create: `src/features/history/TradeHistoryTable.tsx`
- Delete: `src/features/history/HistoryTable.tsx`
- Modify: `src/features/userinfo/UserInfoTabs.tsx`
- Modify: `e2e/pages/TerminalPanels.ts`
- Modify: `e2e/tier1/10-history.spec.ts`
- Modify: `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`

**Interfaces:**

- Consumes: `DataTable`, `useTradesRestQuery`, `useAccountId`.
- Produces: `trade-history-table`, строки `trade-history-table-row-{id}`;
  `history-table` / `history-empty` / `trade-row-*` исчезают.

- [ ] **Шаг 1: Таблица сделок**

`src/features/history/TradeHistoryTable.tsx`:

```tsx
import type { TradeRow } from "@liq/api-client";
import { useAccountId, useTradesRestQuery } from "@liq/react";
import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { DataTable, MARKET_COLUMN_ID } from "@/components/data-table/DataTable";
import { features, marketFilterFn } from "@/components/data-table/features";

import {
  DASH,
  fmtHash,
  fmtPrice,
  fmtQty,
  fmtSignedUsd,
  fmtTime,
  fmtUsd,
} from "../../lib/format";
import { useSelectedMarket } from "../market/useSelectedMarket";

interface Row {
  trade: TradeRow;
  symbol: string;
}

const helper = createColumnHelper<typeof features, Row>();

const columns = helper.columns([
  helper.accessor((r) => r.trade.timestamp, {
    id: "time",
    header: "Time",
    cell: (info) => (
      <span className="text-muted">{fmtTime(info.getValue())}</span>
    ),
  }),
  helper.accessor((r) => r.symbol, {
    id: MARKET_COLUMN_ID,
    header: "Market",
    enableHiding: false,
    filterFn: (row, _id, value) =>
      marketFilterFn(row.original.trade.marketId.toString(), value),
    cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
  }),
  helper.accessor((r) => r.trade.side, {
    id: "side",
    header: "Side",
    cell: (info) => (
      <span
        className={info.getValue() === "BUY" ? "text-long" : "text-short"}
      >
        {info.getValue()}
      </span>
    ),
  }),
  helper.accessor((r) => Number(r.trade.price), {
    id: "price",
    header: "Price",
    cell: (info) => fmtPrice(info.row.original.trade.price),
  }),
  helper.accessor((r) => Number(r.trade.size), {
    id: "size",
    header: "Size",
    cell: (info) => fmtQty(info.row.original.trade.size),
  }),
  helper.accessor((r) => r.trade.role ?? "", {
    id: "role",
    header: "Role",
    cell: (info) => (
      <span className="text-muted">{info.getValue() || DASH}</span>
    ),
  }),
  helper.accessor((r) => Number(r.trade.fee ?? 0n), {
    id: "fee",
    header: "Fee",
    // `null` — «доля этого филла недоказуема» (контракт списывает агрегат по
    // счёту в транзакции) или «батч ещё не расчитан». Ноль читался бы как
    // бесплатная сделка.
    cell: (info) => {
      const fee = info.row.original.trade.fee;
      return fee === null ? DASH : fmtUsd(fee);
    },
  }),
  helper.accessor((r) => Number(r.trade.realizedPnl ?? 0n), {
    id: "rpnl",
    header: "Realized P&L",
    cell: (info) => {
      const pnl = info.row.original.trade.realizedPnl;
      if (pnl === null) return <span className="text-muted">{DASH}</span>;
      return (
        <span className={pnl < 0n ? "text-short" : "text-long"}>
          {fmtSignedUsd(pnl)}
        </span>
      );
    },
  }),
  helper.accessor((r) => r.trade.txHash ?? "", {
    id: "tx",
    header: "Tx",
    cell: (info) => {
      const hash = info.row.original.trade.txHash;
      return (
        <span className="text-muted">{hash === null ? DASH : fmtHash(hash)}</span>
      );
    },
  }),
]);

export function TradeHistoryTable({
  toolbarExtra,
}: {
  toolbarExtra?: ReactNode;
}) {
  const { markets } = useSelectedMarket();
  const accountId = useAccountId();
  const { data, isLoading } = useTradesRestQuery({ accountId, limit: 50 });

  const rows = useMemo<Row[]>(
    () =>
      (data?.rows ?? []).map((trade) => ({
        trade,
        symbol:
          markets.find((m) => m.id === trade.marketId)?.symbol ??
          trade.marketId.toString(),
      })),
    [data, markets],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      testid="trade-history-table"
      rowId={(r) => r.trade.id}
      markets={markets.map((m) => ({ id: m.id.toString(), symbol: m.symbol }))}
      loading={isLoading}
      emptyText="No trades yet."
      toolbarExtra={toolbarExtra}
    />
  );
}
```

- [ ] **Шаг 2: Заменить в `UserInfoTabs` и удалить старую таблицу**

```bash
git rm src/features/history/HistoryTable.tsx
```

В `UserInfoTabs.tsx` импорт `HistoryTable` заменить на `TradeHistoryTable` и вкладку —
на `<TradeHistoryTable toolbarExtra={fullscreenButton} />`.

- [ ] **Шаг 3: Обновить page object и спеку**

```ts
  get historyTable(): Locator {
    return this.page.getByTestId("trade-history-table");
  }
  get historyEmpty(): Locator {
    return this.page.getByTestId("trade-history-table-empty");
  }
  tradeRow(id: string): Locator {
    return this.page.getByTestId(`trade-history-table-row-${id}`);
  }
```

Спека `10-history.spec.ts` меняется в одном месте: в тесте «renders a SELL fill with
short styling» строка теперь содержит и красную сторону, и, возможно, красный PnL,
поэтому `row.locator(".text-short")` заменить на
`row.locator("td").nth(2).locator(".text-short")` — сторона живёт в третьей ячейке.

- [ ] **Шаг 4: Прогнать спеку истории**

Run: `pnpm test:e2e e2e/tier1/10-history.spec.ts`
Expected: 4 теста зелёные.

- [ ] **Шаг 5: Гейт и коммит**

Run: `pnpm test -u && pnpm typecheck && node_modules/.bin/eslint . && pnpm build`

```bash
git add -A src/features/history src/features/userinfo e2e/pages/TerminalPanels.ts \
  e2e/tier1/10-history.spec.ts src/__tests__/__snapshots__
git commit -m "feat(history): история сделок на DataTable (Ф3b, задача 7)"
```

---

### Задача 8: Order History

**Files:**

- Create: `src/features/orders/OrderHistoryTable.tsx`
- Modify: `src/features/userinfo/UserInfoTabs.tsx`
- Modify: `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`

**Interfaces:**

- Consumes: `useOrderHistoryQuery` из `@liq/react` 0.45.0, `DataTable`.
- Produces: `order-history-table`, строки `order-history-table-row-{id}`.

- [ ] **Шаг 1: Таблица**

`src/features/orders/OrderHistoryTable.tsx`:

```tsx
import type { GatewayOrder } from "@liq/core";
import { useAccountId, useOrderHistoryQuery } from "@liq/react";
import { Side } from "@liq/sdk";
import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { DataTable, MARKET_COLUMN_ID } from "@/components/data-table/DataTable";
import { features, marketFilterFn } from "@/components/data-table/features";

import { DASH, fmtPrice, fmtQty, fmtTime, parseWadLoose } from "../../lib/format";
import { useSelectedMarket } from "../market/useSelectedMarket";

interface Row {
  order: GatewayOrder;
  symbol: string;
}

const helper = createColumnHelper<typeof features, Row>();

const columns = helper.columns([
  helper.accessor((r) => Date.parse(r.order.createdAt), {
    id: "time",
    header: "Time",
    cell: (info) => (
      <span className="text-muted">{fmtTime(info.getValue())}</span>
    ),
  }),
  helper.accessor((r) => r.symbol, {
    id: MARKET_COLUMN_ID,
    header: "Market",
    enableHiding: false,
    filterFn: (row, _id, value) =>
      marketFilterFn(row.original.order.marketId, value),
    cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
  }),
  helper.accessor((r) => r.order.orderType, {
    id: "type",
    header: "Type",
    cell: (info) => <span className="text-muted">{info.getValue()}</span>,
  }),
  helper.accessor((r) => r.order.side, {
    id: "side",
    header: "Side",
    cell: (info) => (
      <span className={info.getValue() === Side.BUY ? "text-long" : "text-short"}>
        {info.getValue()}
      </span>
    ),
  }),
  helper.accessor((r) => Number(parseWadLoose(r.order.sizeDelta)), {
    id: "size",
    header: "Size",
    cell: (info) => {
      const size = parseWadLoose(info.row.original.order.sizeDelta);
      return fmtQty(size < 0n ? -size : size);
    },
  }),
  helper.accessor((r) => Number(parseWadLoose(r.order.limitPrice ?? "0")), {
    id: "price",
    header: "Price",
    cell: (info) => {
      const px = info.row.original.order.limitPrice;
      return px && px !== "0" ? fmtPrice(parseWadLoose(px)) : DASH;
    },
  }),
  helper.accessor((r) => r.order.status, {
    id: "status",
    header: "Status",
    cell: (info) => <span className="text-muted">{info.getValue()}</span>,
  }),
]);

/**
 * Ордера, вышедшие из конвейера матчинга.
 *
 * @remarks Хук спрашивает `TERMINAL_ORDER_STATUSES`. Вместе с
 * `OPEN_ORDER_STATUSES`, которыми живёт вкладка Open Orders, это НЕ все статусы:
 * `MATCHED`, `SETTLEMENT_SUBMITTED` и `FAILED_RETRYABLE` не видны ни там, ни
 * здесь — ордер в этих состояниях исчезает с экрана и возвращается уже
 * исполненным. Закрывается расширением `useOpenOrdersQuery` в SDK; здесь
 * замалчивать это нечем.
 */
export function OrderHistoryTable({
  toolbarExtra,
}: {
  toolbarExtra?: ReactNode;
}) {
  const { markets } = useSelectedMarket();
  const accountId = useAccountId();
  const { data = EMPTY, isLoading } = useOrderHistoryQuery(accountId);

  const rows = useMemo<Row[]>(
    () =>
      data.map((order) => ({
        order,
        symbol:
          markets.find((m) => m.id.toString() === order.marketId)?.symbol ??
          order.marketId,
      })),
    [data, markets],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      testid="order-history-table"
      rowId={(r) => r.order.id}
      markets={markets.map((m) => ({ id: m.id.toString(), symbol: m.symbol }))}
      loading={isLoading}
      emptyText="No past orders."
      toolbarExtra={toolbarExtra}
    />
  );
}

const EMPTY: GatewayOrder[] = [];
```

- [ ] **Шаг 2: Подключить вкладку**

В `UserInfoTabs.tsx` заменить `{tab === "order-history" && <Soon slug="order-history" />}`
на `{tab === "order-history" && <OrderHistoryTable toolbarExtra={fullscreenButton} />}`
и добавить импорт.

- [ ] **Шаг 3: Гейт и коммит**

Run: `pnpm test -u && pnpm typecheck && node_modules/.bin/eslint . && pnpm build`

```bash
git add src/features/orders/OrderHistoryTable.tsx src/features/userinfo \
  src/__tests__/__snapshots__
git commit -m "feat(orders): история ордеров (Ф3b, задача 8)"
```

---

### Задача 9: Position History

**Files:**

- Create: `src/features/history/PositionHistoryTable.tsx`
- Modify: `src/features/userinfo/UserInfoTabs.tsx`
- Modify: `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`

**Interfaces:**

- Consumes: `usePositionHistoryQuery`, `DataTable`.
- Produces: `position-history-table`, строки
  `position-history-table-row-{marketId}-{openedAt}`, и отдельное состояние
  `position-history-unavailable`.

- [ ] **Шаг 1: Таблица эпизодов**

`src/features/history/PositionHistoryTable.tsx`:

```tsx
import type { PositionEpisode } from "@liq/api-client";
import { useAccountId, usePositionHistoryQuery } from "@liq/react";
import { createColumnHelper } from "@tanstack/react-table";
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { DataTable, MARKET_COLUMN_ID } from "@/components/data-table/DataTable";
import { features, marketFilterFn } from "@/components/data-table/features";

import {
  DASH,
  fmtPrice,
  fmtQty,
  fmtSignedUsd,
  fmtTime,
  fmtUsd,
} from "../../lib/format";
import { useSelectedMarket } from "../market/useSelectedMarket";

interface Row {
  episode: PositionEpisode;
  symbol: string;
}

const helper = createColumnHelper<typeof features, Row>();

/** Что в этом эпизоде реконструировано, а не измерено. */
function caveats(e: PositionEpisode): string[] {
  const notes: string[] = [];
  if (e.openInferred) notes.push("Opening trade predates the indexed window");
  if (e.liquidationTouched) notes.push("A liquidation touched this episode");
  if (e.sizeDiverged) notes.push("Chain size disagreed with the rebuild");
  return notes;
}

const columns = helper.columns([
  helper.accessor((r) => r.symbol, {
    id: MARKET_COLUMN_ID,
    header: "Market",
    enableHiding: false,
    filterFn: (row, _id, value) =>
      marketFilterFn(row.original.episode.marketId.toString(), value),
    cell: (info) => {
      const notes = caveats(info.row.original.episode);
      return (
        <span className="inline-flex items-center gap-1 font-semibold">
          {info.getValue()}
          {notes.length > 0 && (
            <TriangleAlert
              size={12}
              className="text-muted"
              aria-label={notes.join("; ")}
            />
          )}
        </span>
      );
    },
  }),
  helper.accessor((r) => r.episode.direction, {
    id: "direction",
    header: "Direction",
    cell: (info) => (
      <span className={info.getValue() === "long" ? "text-long" : "text-short"}>
        {info.getValue() === "long" ? "Long" : "Short"}
      </span>
    ),
  }),
  helper.accessor((r) => r.episode.openedAt, {
    id: "opened",
    header: "Opened",
    // Секунды, а не миллисекунды: гейтвей отдаёт unix-seconds.
    cell: (info) => (
      <span className="text-muted">{fmtTime(info.getValue() * 1000)}</span>
    ),
  }),
  helper.accessor((r) => r.episode.closedAt, {
    id: "closed",
    header: "Closed",
    cell: (info) => (
      <span className="text-muted">{fmtTime(info.getValue() * 1000)}</span>
    ),
  }),
  helper.accessor((r) => Number(r.episode.avgEntryPrice), {
    id: "entry",
    header: "Avg Entry",
    cell: (info) => fmtPrice(info.row.original.episode.avgEntryPrice),
  }),
  helper.accessor((r) => Number(r.episode.avgClosePrice ?? 0n), {
    id: "close",
    header: "Avg Close",
    cell: (info) => {
      const px = info.row.original.episode.avgClosePrice;
      return px === null ? DASH : fmtPrice(px);
    },
  }),
  helper.accessor((r) => Number(r.episode.maxSize), {
    id: "size",
    header: "Max Size",
    cell: (info) => fmtQty(info.row.original.episode.maxSize),
  }),
  helper.accessor((r) => Number(r.episode.realizedPnl ?? 0n), {
    id: "rpnl",
    header: "Realized P&L",
    cell: (info) => {
      const pnl = info.row.original.episode.realizedPnl;
      if (pnl === null) return <span className="text-muted">{DASH}</span>;
      return (
        <span className={pnl < 0n ? "text-short" : "text-long"}>
          {fmtSignedUsd(pnl)}
        </span>
      );
    },
  }),
  helper.accessor((r) => Number(r.episode.feesUsd ?? 0n), {
    id: "fees",
    header: "Fees",
    cell: (info) => {
      const fees = info.row.original.episode.feesUsd;
      return fees === null ? DASH : fmtUsd(fees);
    },
  }),
  helper.accessor((r) => r.episode.closedBy, {
    id: "closedBy",
    header: "Close Type",
    // Различает `trade` и `liquidation` — и только их. Market против Limit
    // гейтвей в эпизоде не хранит.
    cell: (info) => (
      <span
        className={
          info.getValue() === "liquidation" ? "text-short" : "text-muted"
        }
      >
        {info.getValue() === "liquidation" ? "Liquidation" : "Trade"}
      </span>
    ),
  }),
]);

export function PositionHistoryTable({
  toolbarExtra,
}: {
  toolbarExtra?: ReactNode;
}) {
  const { markets } = useSelectedMarket();
  const accountId = useAccountId();
  const { data, isLoading } = usePositionHistoryQuery(accountId);

  const rows = useMemo<Row[]>(
    () =>
      (data?.episodes ?? []).map((episode) => ({
        episode,
        symbol:
          episode.symbol ??
          markets.find((m) => m.id === episode.marketId)?.symbol ??
          episode.marketId.toString(),
      })),
    [data, markets],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      testid="position-history-table"
      rowId={(r) => `${r.episode.marketId}-${r.episode.openedAt}`}
      markets={markets.map((m) => ({ id: m.id.toString(), symbol: m.symbol }))}
      loading={isLoading}
      // `available: false` — «индексатор не держит событий этого счёта вовсе»,
      // а пустой `episodes` при `available: true` — «счёт торговал и ничего не
      // закрыл». Схлопнуть их значило бы сказать «истории нет» там, где сказать
      // нечего.
      notice={
        data && !data.available
          ? {
              testid: "position-history-unavailable",
              text: "History source is silent for this account.",
            }
          : null
      }
      emptyText="No closed positions."
      toolbarExtra={toolbarExtra}
    />
  );
}
```

- [ ] **Шаг 2: Подключить вкладку**

Заменить `<Soon slug="position-history" />` на
`<PositionHistoryTable toolbarExtra={fullscreenButton} />` + импорт.

- [ ] **Шаг 3: Гейт и коммит**

Run: `pnpm test -u && pnpm typecheck && node_modules/.bin/eslint . && pnpm build`

```bash
git add src/features/history/PositionHistoryTable.tsx src/features/userinfo \
  src/__tests__/__snapshots__
git commit -m "feat(history): история позиций (Ф3b, задача 9)"
```

---

### Задача 10: Леджер — Account History и Funding History

**Files:**

- Create: `src/features/history/useAccountLedger.ts`
- Create: `src/features/history/AccountHistoryTable.tsx`
- Create: `src/features/history/FundingHistoryTable.tsx`
- Test: `src/features/history/__tests__/ledgerRows.test.ts`
- Modify: `src/features/userinfo/UserInfoTabs.tsx`
- Modify: `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`

**Interfaces:**

- Consumes: `useSettlementLedgerQuery`, `DataTable`.
- Produces: `useAccountLedger()` → `{ rows, isLoading }`;
  `fundingRows(rows: SettlementLedgerRow[]): SettlementLedgerRow[]`;
  `account-history-table`, `funding-history-table`, строки
  `{testid}-row-{txHash}-{logIndex}`.

- [ ] **Шаг 1: Падающий юнит на отбор строк фандинга**

`src/features/history/__tests__/ledgerRows.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { fundingRows } from "../useAccountLedger";

const row = (accruedFunding: bigint | null, logIndex = 0) => ({
  timestampMs: 1_717_200_000_000,
  txHash: "0xabc",
  logIndex,
  marketId: 200n,
  kind: "settlement" as const,
  sizeDelta: null,
  newSize: null,
  fillPrice: null,
  pricePnl: null,
  accruedFunding,
  interest: null,
  totalFees: null,
  netBalanceDelta: null,
  liquidationTouched: false,
});

describe("строки фандинга", () => {
  it("берёт только расчёты, где фандинг действительно двигался", () => {
    expect(fundingRows([row(5n, 0), row(0n, 1)])).toHaveLength(1);
  });

  it("не считает недоказуемый фандинг нулевым и выбрасывает его", () => {
    // `null` — «не смогли доказать», а не «ноль». Строка с null в колонке
    // платежа показала бы прочерк там, где вкладка обещает список платежей.
    expect(fundingRows([row(null)])).toHaveLength(0);
  });

  it("оставляет отрицательный платёж — трейдер платил", () => {
    expect(fundingRows([row(-7n)])).toHaveLength(1);
  });
});
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Run: `pnpm test -- ledgerRows`
Expected: FAIL — `Failed to resolve import "../useAccountLedger"`.

- [ ] **Шаг 3: Один запрос на две вкладки**

`src/features/history/useAccountLedger.ts`:

```ts
import type { SettlementLedgerRow } from "@liq/api-client";
import { useAccountId, useSettlementLedgerQuery } from "@liq/react";

/** Сколько строк леджера тянет нижняя панель за раз. */
const PAGE = 100;

/**
 * Страница расчётного леджера — общая для вкладок Account History и Funding
 * History.
 *
 * @remarks Обе вкладки читают один и тот же запрос с одними параметрами,
 * поэтому в react-query это одна запись кэша и один поход на шлюз: переключение
 * между вкладками не стоит ничего. `totals`/`coverage` первой страницы здесь не
 * используются — панель не показывает сводов.
 */
export function useAccountLedger(): {
  rows: SettlementLedgerRow[];
  isLoading: boolean;
} {
  const accountId = useAccountId();
  const { data, isLoading } = useSettlementLedgerQuery(accountId, {
    limit: PAGE,
  });
  return { rows: data?.rows ?? EMPTY, isLoading };
}

/**
 * Строки, в которых фандинг действительно двигал залог.
 *
 * @remarks `null` выбрасывается вместе с нулём, но по другой причине: ноль —
 * доказанное «платежа не было», `null` — «доказать не удалось». Ни то ни другое
 * не платёж, а вкладка обещает список платежей.
 */
export function fundingRows(
  rows: SettlementLedgerRow[],
): SettlementLedgerRow[] {
  return rows.filter(
    (r) => r.accruedFunding !== null && r.accruedFunding !== 0n,
  );
}

const EMPTY: SettlementLedgerRow[] = [];
```

- [ ] **Шаг 4: Прогнать юнит**

Run: `pnpm test -- ledgerRows`
Expected: PASS (три спеки).

- [ ] **Шаг 5: Account History**

`src/features/history/AccountHistoryTable.tsx`:

```tsx
import type { SettlementLedgerRow } from "@liq/api-client";
import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { DataTable, MARKET_COLUMN_ID } from "@/components/data-table/DataTable";
import { features, marketFilterFn } from "@/components/data-table/features";

import {
  DASH,
  fmtHash,
  fmtPrice,
  fmtQty,
  fmtSignedUsd,
  fmtTime,
  fmtUsd,
} from "../../lib/format";
import { useSelectedMarket } from "../market/useSelectedMarket";
import { useAccountLedger } from "./useAccountLedger";

interface Row {
  ledger: SettlementLedgerRow;
  symbol: string;
}

const helper = createColumnHelper<typeof features, Row>();

/** WAD со знаком либо прочерк — `null` в леджере значит «недоказуемо». */
function signed(v: bigint | null): ReactNode {
  if (v === null) return <span className="text-muted">{DASH}</span>;
  return (
    <span className={v < 0n ? "text-short" : "text-long"}>
      {fmtSignedUsd(v)}
    </span>
  );
}

const columns = helper.columns([
  helper.accessor((r) => r.ledger.timestampMs, {
    id: "time",
    header: "Time",
    cell: (info) => (
      <span className="text-muted">{fmtTime(info.getValue())}</span>
    ),
  }),
  helper.accessor((r) => r.symbol, {
    id: MARKET_COLUMN_ID,
    header: "Market",
    enableHiding: false,
    filterFn: (row, _id, value) =>
      marketFilterFn(row.original.ledger.marketId.toString(), value),
    cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
  }),
  helper.accessor((r) => r.ledger.kind, {
    id: "kind",
    header: "Kind",
    cell: (info) => (
      <span
        className={
          info.getValue() === "liquidation" ? "text-short" : "text-muted"
        }
      >
        {info.getValue() === "liquidation" ? "Liquidation" : "Settlement"}
      </span>
    ),
  }),
  helper.accessor((r) => Number(r.ledger.sizeDelta ?? 0n), {
    id: "sizeDelta",
    header: "Size Δ",
    cell: (info) => {
      const d = info.row.original.ledger.sizeDelta;
      return d === null ? DASH : fmtQty(d);
    },
  }),
  helper.accessor((r) => Number(r.ledger.fillPrice ?? 0n), {
    id: "fillPrice",
    header: "Fill Price",
    cell: (info) => {
      const px = info.row.original.ledger.fillPrice;
      return px === null ? DASH : fmtPrice(px);
    },
  }),
  helper.accessor((r) => Number(r.ledger.pricePnl ?? 0n), {
    id: "pricePnl",
    header: "Price PnL",
    cell: (info) => signed(info.row.original.ledger.pricePnl),
  }),
  helper.accessor((r) => Number(r.ledger.accruedFunding ?? 0n), {
    id: "funding",
    header: "Funding",
    cell: (info) => signed(info.row.original.ledger.accruedFunding),
  }),
  helper.accessor((r) => Number(r.ledger.interest ?? 0n), {
    id: "interest",
    header: "Interest",
    cell: (info) => {
      const i = info.row.original.ledger.interest;
      return i === null ? DASH : fmtUsd(i);
    },
  }),
  helper.accessor((r) => Number(r.ledger.totalFees ?? 0n), {
    id: "fees",
    header: "Fees",
    cell: (info) => {
      const f = info.row.original.ledger.totalFees;
      return f === null ? DASH : fmtUsd(f);
    },
  }),
  helper.accessor((r) => Number(r.ledger.netBalanceDelta ?? 0n), {
    id: "net",
    header: "Net Δ",
    cell: (info) => signed(info.row.original.ledger.netBalanceDelta),
  }),
  helper.accessor((r) => r.ledger.txHash, {
    id: "tx",
    header: "Tx",
    cell: (info) => (
      <span className="text-muted">{fmtHash(info.getValue())}</span>
    ),
  }),
]);

export function AccountHistoryTable({
  toolbarExtra,
}: {
  toolbarExtra?: ReactNode;
}) {
  const { markets } = useSelectedMarket();
  const { rows: ledger, isLoading } = useAccountLedger();

  const rows = useMemo<Row[]>(
    () =>
      ledger.map((row) => ({
        ledger: row,
        symbol:
          markets.find((m) => m.id === row.marketId)?.symbol ??
          row.marketId.toString(),
      })),
    [ledger, markets],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      testid="account-history-table"
      rowId={(r) => `${r.ledger.txHash}-${r.ledger.logIndex}`}
      markets={markets.map((m) => ({ id: m.id.toString(), symbol: m.symbol }))}
      loading={isLoading}
      emptyText="No settlements yet."
      toolbarExtra={toolbarExtra}
    />
  );
}
```

- [ ] **Шаг 6: Funding History**

`src/features/history/FundingHistoryTable.tsx`:

```tsx
import type { SettlementLedgerRow } from "@liq/api-client";
import { createColumnHelper } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { DataTable, MARKET_COLUMN_ID } from "@/components/data-table/DataTable";
import { features, marketFilterFn } from "@/components/data-table/features";

import { DASH, fmtHash, fmtSignedUsd, fmtTime } from "../../lib/format";
import { useSelectedMarket } from "../market/useSelectedMarket";
import { fundingRows, useAccountLedger } from "./useAccountLedger";

interface Row {
  ledger: SettlementLedgerRow;
  symbol: string;
}

const helper = createColumnHelper<typeof features, Row>();

const columns = helper.columns([
  helper.accessor((r) => r.ledger.timestampMs, {
    id: "time",
    header: "Time",
    cell: (info) => (
      <span className="text-muted">{fmtTime(info.getValue())}</span>
    ),
  }),
  helper.accessor((r) => r.symbol, {
    id: MARKET_COLUMN_ID,
    header: "Market",
    enableHiding: false,
    filterFn: (row, _id, value) =>
      marketFilterFn(row.original.ledger.marketId.toString(), value),
    cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
  }),
  helper.accessor((r) => Number(r.ledger.accruedFunding ?? 0n), {
    id: "payment",
    header: "Funding",
    // Знак — протокольный: положительное КРЕДИТУЕТ трейдера.
    cell: (info) => {
      const v = info.row.original.ledger.accruedFunding!;
      return (
        <span className={v < 0n ? "text-short" : "text-long"}>
          {fmtSignedUsd(v)}
        </span>
      );
    },
  }),
  helper.display({
    id: "rate",
    header: "Rate",
    // Ставки НА МОМЕНТ ПЛАТЕЖА не хранит никто: гейтвей отдаёт текущую ставку
    // рынка (`markets.getFunding`), а она к прошлому расчёту отношения не имеет.
    // Подставить её сюда значило бы напечатать измеренной величиной цифру,
    // которой в этот момент не было.
    cell: () => <span className="text-muted">{DASH}</span>,
  }),
  helper.accessor((r) => r.ledger.txHash, {
    id: "tx",
    header: "Tx",
    cell: (info) => (
      <span className="text-muted">{fmtHash(info.getValue())}</span>
    ),
  }),
]);

export function FundingHistoryTable({
  toolbarExtra,
}: {
  toolbarExtra?: ReactNode;
}) {
  const { markets } = useSelectedMarket();
  const { rows: ledger, isLoading } = useAccountLedger();

  const rows = useMemo<Row[]>(
    () =>
      fundingRows(ledger).map((row) => ({
        ledger: row,
        symbol:
          markets.find((m) => m.id === row.marketId)?.symbol ??
          row.marketId.toString(),
      })),
    [ledger, markets],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      testid="funding-history-table"
      rowId={(r) => `${r.ledger.txHash}-${r.ledger.logIndex}`}
      markets={markets.map((m) => ({ id: m.id.toString(), symbol: m.symbol }))}
      loading={isLoading}
      emptyText="No funding payments yet."
      toolbarExtra={toolbarExtra}
    />
  );
}
```

- [ ] **Шаг 7: Подключить две вкладки и убрать `Soon`**

Заменить обе заглушки на таблицы, удалить компонент `Soon` из `UserInfoTabs.tsx` —
после этой задачи заглушек не остаётся.

- [ ] **Шаг 8: Гейт и коммит**

Run: `pnpm test -u && pnpm typecheck && node_modules/.bin/eslint . && pnpm build`

```bash
git add src/features/history src/features/userinfo src/__tests__/__snapshots__
git commit -m "feat(history): леджер счёта и история фандинга (Ф3b, задача 10)"
```

---

### Задача 11: Панель Account

**Files:**

- Create: `src/features/account/useAccountSummary.ts`
- Create: `src/features/account/AccountPanel.tsx`
- Test: `src/features/account/__tests__/accountSummary.test.ts`
- Modify: `src/features/terminal/Terminal.tsx`
- Modify: `src/__tests__/__snapshots__/testid-inventory.test.ts.snap`

**Interfaces:**

- Consumes: `useAvailableMarginQuery`, `useEnrichedPositions`, `useLiqClient`,
  `useLiqOnchain`, `useAccountId`; диалоги `DepositDialog` / `WithdrawDialog`.
- Produces: `summarize(input): AccountSummary` — чистая функция; `useAccountSummary()`;
  `<AccountPanel />` с идентификаторами `account-panel`, `account-unrealized-pnl`,
  `account-value`, `account-equity`, `account-borrowed`, `account-exposure`,
  `account-leverage`, `account-deposit-button`, `account-withdraw-button`.

- [ ] **Шаг 1: Падающий юнит на свод**

`src/features/account/__tests__/accountSummary.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { summarize } from "../useAccountSummary";

const WAD = 10n ** 18n;

describe("свод счёта", () => {
  it("плечо — это экспозиция к стоимости счёта", () => {
    const s = summarize({
      available: 1000n * WAD,
      locked: 0n,
      debt: 0n,
      positions: [{ unrealizedPnl: 0n, notional: 2000n * WAD }],
    });
    expect(s.leverage).toBe(2n * WAD);
  });

  it("не делит на ноль: пустой счёт не имеет плеча", () => {
    // Ноль здесь читался бы как «плеча нет», что для счёта без залога неверно:
    // плеча не «нет», его нечем измерить.
    const s = summarize({
      available: 0n,
      locked: 0n,
      debt: 0n,
      positions: [{ unrealizedPnl: 0n, notional: 5n * WAD }],
    });
    expect(s.leverage).toBeUndefined();
  });

  it("equity вычитает офчейн-лок, а не долг", () => {
    const s = summarize({
      available: 1000n * WAD,
      locked: 40n * WAD,
      debt: 7n * WAD,
      positions: [],
    });
    expect(s.accountValue).toBe(1000n * WAD);
    expect(s.equity).toBe(960n * WAD);
    expect(s.borrowed).toBe(7n * WAD);
  });

  it("складывает PnL и ноционал по всем позициям", () => {
    const s = summarize({
      available: 1000n * WAD,
      locked: 0n,
      debt: 0n,
      positions: [
        { unrealizedPnl: 5n * WAD, notional: 100n * WAD },
        { unrealizedPnl: -2n * WAD, notional: 300n * WAD },
      ],
    });
    expect(s.unrealizedPnl).toBe(3n * WAD);
    expect(s.exposure).toBe(400n * WAD);
  });

  it("неизвестный залог — неизвестны и стоимость, и equity, и плечо", () => {
    // `undefined` доезжает сюда, когда чтение маржи ещё в полёте или упало.
    // Ноль в этих трёх строках выглядел бы как обнулившийся счёт.
    const s = summarize({
      available: undefined,
      locked: 0n,
      debt: 0n,
      positions: [{ unrealizedPnl: 0n, notional: 100n * WAD }],
    });
    expect(s.accountValue).toBeUndefined();
    expect(s.equity).toBeUndefined();
    expect(s.leverage).toBeUndefined();
  });
});
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Run: `pnpm test -- accountSummary`
Expected: FAIL — `Failed to resolve import "../useAccountSummary"`.

- [ ] **Шаг 3: Свод и хук**

`src/features/account/useAccountSummary.ts`:

```ts
import type { AccountMargin } from "@liq/api-client";
import {
  useAccountId,
  useAvailableMarginQuery,
  useEnrichedPositions,
  useLiqClient,
  useLiqOnchain,
} from "@liq/react";
import { useQuery } from "@tanstack/react-query";

import { useSelectedMarket } from "../market/useSelectedMarket";

const WAD = 10n ** 18n;

/** Ровно то, что панели нужно знать о позиции. */
export interface SummaryPosition {
  unrealizedPnl: bigint;
  notional: bigint;
}

export interface SummaryInput {
  /** `getAvailableMargin` — залог, переоценённый по марку. `undefined` = не прочитано. */
  available: bigint | undefined;
  /** Офчейн-лок под неурегулированные филлы. */
  locked: bigint;
  debt: bigint;
  positions: SummaryPosition[];
}

export interface AccountSummary {
  unrealizedPnl: bigint;
  accountValue: bigint | undefined;
  equity: bigint | undefined;
  borrowed: bigint;
  exposure: bigint;
  /** WAD-кратность. `undefined`, когда стоимость счёта неизвестна или неположительна. */
  leverage: bigint | undefined;
}

/**
 * Шесть чисел панели из четырёх чтений.
 *
 * @remarks Чистая функция — вся её работа складывать и делить уже посчитанное:
 * `unrealizedPnl` и `notional` приходят из `enrichPosition`, `available` из
 * `getAvailableMargin`. Ни одна величина здесь не выводится заново.
 *
 * `undefined` вместо нуля там, где чтение не состоялось: обнулившийся счёт и
 * непрочитанный счёт — разные вещи, и на экране кризиса их путать нельзя.
 */
export function summarize(input: SummaryInput): AccountSummary {
  const unrealizedPnl = input.positions.reduce(
    (sum, p) => sum + p.unrealizedPnl,
    0n,
  );
  const exposure = input.positions.reduce((sum, p) => sum + p.notional, 0n);
  const accountValue = input.available;
  const equity =
    accountValue === undefined ? undefined : accountValue - input.locked;
  const leverage =
    accountValue === undefined || accountValue <= 0n
      ? undefined
      : (exposure * WAD) / accountValue;
  return {
    unrealizedPnl,
    accountValue,
    equity,
    borrowed: input.debt,
    exposure,
    leverage,
  };
}

/**
 * Панель Account поверх четырёх чтений SDK.
 *
 * @remarks Двух из них нет хуками в `@liq/react` — `accounts.getMargin` и
 * `collateral.debt` живут только методами сервисов, поэтому здесь стоит
 * локальный `useQuery`. Это пробел SDK, а не разрешение считать в терминале:
 * логика чтения остаётся за швом, снаружи только проводка. Имена запросов не
 * начинаются с `liq/`, поэтому `resetAuthedQueries` их не сметает; ключ несёт
 * `accountId`, так что вход другим кошельком получает другую запись кэша, а не
 * чужие числа.
 */
export function useAccountSummary(): {
  summary: AccountSummary;
  isLoading: boolean;
} {
  const accountId = useAccountId();
  const client = useLiqClient();
  const onchain = useLiqOnchain();
  const { allMarketIds } = useSelectedMarket();

  const { data: margins, isLoading: marginsLoading } =
    useAvailableMarginQuery();
  const { data: positions = EMPTY } = useEnrichedPositions(allMarketIds);

  const { data: gatewayMargin } = useQuery<AccountMargin>({
    queryKey: ["terminal", "account-margin", accountId?.toString() ?? "none"],
    queryFn: () => client.accounts.getMargin(accountId!),
    enabled: accountId !== undefined,
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  const { data: debt } = useQuery<bigint>({
    queryKey: ["terminal", "account-debt", accountId?.toString() ?? "none"],
    queryFn: () => onchain.collateral.debt(accountId!),
    enabled: accountId !== undefined,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    summary: summarize({
      available: margins?.available,
      locked: gatewayMargin?.locked ?? 0n,
      debt: debt ?? 0n,
      positions: positions.map((p) => ({
        unrealizedPnl: p.unrealizedPnl,
        notional: p.notional,
      })),
    }),
    isLoading: marginsLoading,
  };
}

const EMPTY: { unrealizedPnl: bigint; notional: bigint }[] = [];
```

- [ ] **Шаг 4: Прогнать юнит**

Run: `pnpm test -- accountSummary`
Expected: PASS (пять спек).

- [ ] **Шаг 5: Панель**

`src/features/account/AccountPanel.tsx`:

```tsx
import { useState } from "react";

import { Card } from "@/components/ui/card";

import { DASH, fmtSignedUsd, fmtUsd, toNum } from "../../lib/format";
import { DepositDialog } from "./DepositDialog";
import { useAccountSummary } from "./useAccountSummary";
import { WithdrawDialog } from "./WithdrawDialog";

export function AccountPanel() {
  const { summary } = useAccountSummary();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <Card className="flex flex-col gap-2 p-3" data-testid="account-panel">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Account</span>
        <span className="flex gap-2">
          <button
            type="button"
            className="rounded-sm border px-2 py-0.5 text-[11px] text-accent"
            onClick={() => setDepositOpen(true)}
            data-testid="account-deposit-button"
          >
            Deposit
          </button>
          <button
            type="button"
            className="rounded-sm border px-2 py-0.5 text-[11px] text-muted"
            onClick={() => setWithdrawOpen(true)}
            data-testid="account-withdraw-button"
          >
            Withdraw
          </button>
        </span>
      </div>

      <Row
        label="Unrealized PnL"
        testid="account-unrealized-pnl"
        tone={summary.unrealizedPnl < 0n ? "text-short" : "text-long"}
        value={fmtSignedUsd(summary.unrealizedPnl)}
      />
      <Row
        label="Account Value"
        testid="account-value"
        value={
          summary.accountValue === undefined
            ? DASH
            : fmtUsd(summary.accountValue)
        }
      />
      <Row
        label="Equity"
        testid="account-equity"
        value={summary.equity === undefined ? DASH : fmtUsd(summary.equity)}
      />
      <Row
        label="Borrowed"
        testid="account-borrowed"
        value={fmtUsd(summary.borrowed)}
      />
      <Row
        label="Exposure"
        testid="account-exposure"
        value={fmtUsd(summary.exposure)}
      />
      <Row
        label="Account Leverage"
        testid="account-leverage"
        value={
          summary.leverage === undefined
            ? DASH
            : toNum(summary.leverage).toFixed(2)
        }
      />

      <DepositDialog open={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
      />
    </Card>
  );
}

function Row({
  label,
  value,
  testid,
  tone,
}: {
  label: string;
  value: string;
  testid: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={tone ?? "text-text"} data-testid={testid}>
        {value}
      </span>
    </div>
  );
}
```

- [ ] **Шаг 6: Смонтировать под тикетом**

В `src/features/terminal/Terminal.tsx` колонка `trade-column` держит теперь два блока:

```tsx
                <ResizablePanel
                  id="trade-column"
                  defaultSize={chartCollapsed ? "65" : "26"}
                  minSize="20"
                >
                  <div className="flex h-full flex-col gap-2">
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <TradeForm />
                    </div>
                    <AccountPanel />
                  </div>
                </ResizablePanel>
```

плюс импорт `import { AccountPanel } from "../account/AccountPanel";`.

- [ ] **Шаг 7: Гейт и коммит**

Run: `pnpm test -u && pnpm typecheck && node_modules/.bin/eslint . && pnpm build`
Run: `pnpm test:e2e e2e/tier1/03-deposit-withdraw.spec.ts e2e/tier1/19-layout.spec.ts`
Expected: зелёные. Диалоги депозита и вывода теперь монтируются с двух точек входа —
спека 03 ходит через `open-deposit-button` в шапке и обязана работать как раньше.

```bash
git add src/features/account src/features/terminal/Terminal.tsx \
  src/__tests__/__snapshots__
git commit -m "feat(account): панель счёта по макету (Ф3b, задача 11)"
```

---

### Задача 12: Ручки историй в моке шлюза

**Files:**

- Modify: `e2e/support/world.ts`
- Modify: `e2e/support/mockGateway.ts`

**Interfaces:**

- Consumes: `MockWorld`, `ScenarioOptions`.
- Produces: поля мира `orderHistory`, `positionHistory`, `settlementLedger`,
  `accountMargin`; фабрики `settledOrderFixture`, `positionEpisodeFixture`,
  `ledgerRowFixture`; ручки `GET /accounts/:id/margin`,
  `GET /accounts/:id/position-history`, `GET /accounts/:id/settlement-ledger` и
  разделение `GET /orders` по статусу.

- [ ] **Шаг 1: Новые поля мира и фабрики**

В `e2e/support/world.ts` — типы рядом с `GatewayOrder`:

```ts
/** Провод `GET /accounts/:id/position-history` — числа строками, как у шлюза. */
export interface WirePositionEpisode {
  marketId: string;
  symbol: string | null;
  direction: "long" | "short";
  /** unix SECONDS */
  openedAt: number;
  closedAt: number;
  avgEntryPrice: string;
  avgClosePrice: string | null;
  maxSize: string;
  realizedPnl: string | null;
  feesUsd: string | null;
  closedBy: "trade" | "liquidation";
  liquidationPrice: null;
  openInferred: boolean;
  liquidationTouched: boolean;
  sizeDiverged: boolean;
}

/** Провод `GET /accounts/:id/settlement-ledger`. */
export interface WireLedgerRow {
  timestampMs: number;
  txHash: string;
  logIndex: number;
  marketId: string;
  kind: "settlement" | "liquidation";
  sizeDelta: string | null;
  newSize: string | null;
  fillPrice: string | null;
  pricePnl: string | null;
  accruedFunding: string | null;
  interest: string | null;
  totalFees: string | null;
  netBalanceDelta: string | null;
  liquidationTouched: boolean;
}
```

В `MockWorld` добавить рядом с `trades`:

```ts
  /** Ордера в терминальных статусах — вкладка Order History. */
  orderHistory: GatewayOrder[];
  /** Закрытые эпизоды; `available: false` = индексатор молчит про счёт. */
  positionHistory: { available: boolean; episodes: WirePositionEpisode[] };
  settlementLedger: WireLedgerRow[];
  /** `GET /accounts/:id/margin` — офчейн-лок питает строку Equity панели. */
  accountMargin: { available: string; locked: string; free: string };
```

В `ScenarioOptions` — те же четыре поля, необязательными. В `freshWorld` — умолчания:

```ts
    orderHistory: opts.orderHistory ?? [],
    positionHistory: opts.positionHistory ?? { available: true, episodes: [] },
    settlementLedger: opts.settlementLedger ?? [],
    accountMargin: opts.accountMargin ?? {
      available: (5_000n * WAD).toString(),
      locked: "0",
      free: (5_000n * WAD).toString(),
    },
```

И три фабрики рядом с `tradeFixture`:

```ts
/** Исполненный ордер — строка вкладки Order History. */
export function settledOrderFixture(
  overrides: Partial<GatewayOrder> = {},
): GatewayOrder {
  return {
    ...limitOrderFixture(),
    id: "ord-filled-1",
    status: "SETTLED",
    ...overrides,
  };
}

/** Закрытый лонг на 1 BTC с прибылью $100. */
export function positionEpisodeFixture(
  overrides: Partial<WirePositionEpisode> = {},
): WirePositionEpisode {
  return {
    marketId: MARKET.id,
    symbol: MARKET.symbol,
    direction: "long",
    openedAt: 1_717_200_000,
    closedAt: 1_717_203_600,
    avgEntryPrice: (69_900n * WAD).toString(),
    avgClosePrice: (70_000n * WAD).toString(),
    maxSize: WAD.toString(),
    realizedPnl: (100n * WAD).toString(),
    feesUsd: WAD.toString(),
    closedBy: "trade",
    liquidationPrice: null,
    openInferred: false,
    liquidationTouched: false,
    sizeDiverged: false,
    ...overrides,
  };
}

/** Строка леджера с ненулевым фандингом — она же строка Funding History. */
export function ledgerRowFixture(
  overrides: Partial<WireLedgerRow> = {},
): WireLedgerRow {
  return {
    timestampMs: 1_717_203_600_000,
    txHash: "0x" + "cd".repeat(32),
    logIndex: 3,
    marketId: MARKET.id,
    kind: "settlement",
    sizeDelta: (-WAD).toString(),
    newSize: "0",
    fillPrice: (70_000n * WAD).toString(),
    pricePnl: (100n * WAD).toString(),
    accruedFunding: (-2n * WAD).toString(),
    interest: "0",
    totalFees: WAD.toString(),
    netBalanceDelta: (99n * WAD).toString(),
    liquidationTouched: false,
    ...overrides,
  };
}
```

- [ ] **Шаг 2: Ручки шлюза**

В `e2e/support/mockGateway.ts`, в секции `// --- accounts ---`, **перед** веткой
`register` (иначе `/accounts/:id/margin` в неё не попадёт — она матчит другой хвост,
но порядок держит секцию читаемой):

```ts
    const margin = path.match(/\/accounts\/([^/]+)\/margin$/);
    if (margin) {
      await send(route, {
        accountId: margin[1],
        ...world.accountMargin,
      });
      return;
    }
    const positionHistory = path.match(
      /\/accounts\/([^/]+)\/position-history$/,
    );
    if (positionHistory) {
      await send(route, {
        accountId: positionHistory[1],
        generatedAt: Math.floor(Date.now() / 1000),
        available: world.positionHistory.available,
        episodes: world.positionHistory.episodes,
        coverage: {
          oldestEventAt: world.positionHistory.episodes[0]?.openedAt ?? null,
          eventsComplete: true,
          indexedFrom: 1_717_000_000,
        },
      });
      return;
    }
    const ledger = path.match(/\/accounts\/([^/]+)\/settlement-ledger$/);
    if (ledger) {
      // `totals`/`coverage` только на первой странице — мок отдаёт одну
      // страницу, поэтому они всегда есть, а `nextCursor` всегда null.
      await send(route, {
        rows: world.settlementLedger,
        totals: null,
        coverage: null,
        nextCursor: null,
      });
      return;
    }
```

И заменить `orderListFor`, чтобы терминальные статусы вели в свой список:

```ts
/**
 * Разводит три запроса, которые ходят на один `/orders`: открытые, условные и
 * история. Признак — статус в query: `TRIGGER_PENDING` у условных, любой
 * терминальный (`SETTLED`, `CANCELLED`, `REJECTED`, `EXPIRED`, `FAILED`) — у
 * истории. Без этого история показывала бы открытые ордера и спека проходила
 * бы на неверных данных.
 */
function orderListFor(world: MockWorld, status: string | null): GatewayOrder[] {
  if (status && status.includes("TRIGGER_PENDING"))
    return world.conditionalOrders;
  if (status && /SETTLED|CANCELLED|REJECTED|EXPIRED|FAILED/.test(status))
    return world.orderHistory;
  return world.openOrders;
}
```

- [ ] **Шаг 3: Проверить, что ничего не сломалось**

Run: `pnpm test:e2e`
Expected: те же спеки зелёные — новые ручки пока никто не зовёт, а `orderListFor`
для открытых и условных ведёт себя как раньше.

- [ ] **Шаг 4: Коммит**

```bash
git add e2e/support/world.ts e2e/support/mockGateway.ts
git commit -m "test(e2e): ручки историй и маржи в моке шлюза (Ф3b, задача 12)"
```

---

### Задача 13: e2e tier-1 — семь вкладок, тулбар, панель Account

**Files:**

- Create: `e2e/tier1/23-history-tables.spec.ts`
- Create: `e2e/tier1/24-account-panel.spec.ts`
- Modify: `e2e/pages/TerminalPanels.ts`

**Interfaces:**

- Consumes: локаторы и фикстуры задач 4–12.
- Produces: покрытие четырёх новых вкладок, трёх механик тулбара и шести строк панели.

- [ ] **Шаг 1: Локаторы панели Account**

Добавить в `e2e/pages/TerminalPanels.ts` класс:

```ts
export class AccountPanelPage {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId("account-panel");
  }
  row(name: string): Locator {
    return this.page.getByTestId(`account-${name}`);
  }
  get depositButton(): Locator {
    return this.page.getByTestId("account-deposit-button");
  }
  get withdrawButton(): Locator {
    return this.page.getByTestId("account-withdraw-button");
  }
}
```

- [ ] **Шаг 2: Спека четырёх новых вкладок и тулбара**

`e2e/tier1/23-history-tables.spec.ts`:

```ts
import { enterTerminal } from "../pages/flows";
import { MARKET, MARKET_ETH, WAD } from "../support/constants";
import { expect, test } from "../support/fixtures";
import {
  ledgerRowFixture,
  positionEpisodeFixture,
  readyWorld,
  settledOrderFixture,
  tradeFixture,
} from "../support/world";

test.describe("истории нижней панели", () => {
  test("история ордеров показывает исполненный ордер, а не открытый", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ orderHistory: [settledOrderFixture()] }),
    );

    await userInfo.selectTab("order-history");
    const row = page.getByTestId("order-history-table-row-ord-filled-1");
    await expect(row).toBeVisible();
    await expect(row).toContainText("SETTLED");
  });

  test("история позиций рисует закрытый эпизод", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({
        positionHistory: {
          available: true,
          episodes: [positionEpisodeFixture()],
        },
      }),
    );

    await userInfo.selectTab("position-history");
    const row = page.getByTestId(
      `position-history-table-row-${MARKET.id}-1717200000`,
    );
    await expect(row).toBeVisible();
    await expect(row).toContainText("Long");
    await expect(row).toContainText("Trade");
  });

  test("молчащий индексатор отличается от пустой истории", async ({
    page,
    world,
  }) => {
    // `available: false` — «событий этого счёта у индексатора нет вовсе».
    // Показать здесь «закрытых позиций нет» значило бы утверждать знание,
    // которого нет.
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ positionHistory: { available: false, episodes: [] } }),
    );

    await userInfo.selectTab("position-history");
    await expect(
      page.getByTestId("position-history-unavailable"),
    ).toBeVisible();
    await expect(
      page.getByTestId("position-history-table-empty"),
    ).toHaveCount(0);
  });

  test("леджер счёта показывает строку расчёта", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ settlementLedger: [ledgerRowFixture()] }),
    );

    await userInfo.selectTab("account-history");
    await expect(page.getByTestId("account-history-table")).toBeVisible();
    await expect(page.getByTestId("account-history-table")).toContainText(
      "Settlement",
    );
  });

  test("фандинг берёт из леджера только платежи и не выдумывает ставку", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({
        settlementLedger: [
          ledgerRowFixture(),
          ledgerRowFixture({ logIndex: 4, accruedFunding: "0" }),
        ],
      }),
    );

    await userInfo.selectTab("funding-history");
    const rows = page.locator(
      '[data-testid^="funding-history-table-row-"]',
    );
    // Двух строк в леджере, платёж один — нулевой фандинг не платёж.
    await expect(rows).toHaveCount(1);
    // Колонка Rate — прочерк: ставки на момент платежа нет ни в одном источнике.
    await expect(rows.first().locator("td").nth(4)).toHaveText("—");
  });

  test("скрытая колонка исчезает из таблицы", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({ trades: [tradeFixture()] }),
    );

    await userInfo.selectTab("trade-history");
    await expect(userInfo.header("price")).toBeVisible();
    await userInfo.columnsButton.click();
    await userInfo.columnToggle("price").click();
    await expect(userInfo.header("price")).toHaveCount(0);
  });

  test("фильтр по рынку оставляет строки одного рынка", async ({
    page,
    world,
  }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({
        markets: [MARKET, MARKET_ETH],
        trades: [
          tradeFixture(),
          tradeFixture({ id: "fill-eth", marketId: MARKET_ETH.id }),
        ],
      }),
    );

    await userInfo.selectTab("trade-history");
    await expect(userInfo.tradeRow("fill-1")).toBeVisible();
    await expect(userInfo.tradeRow("fill-eth")).toBeVisible();

    await userInfo.filterButton.click();
    await userInfo.filterOption(MARKET_ETH.id).click();

    await expect(userInfo.tradeRow("fill-eth")).toBeVisible();
    await expect(userInfo.tradeRow("fill-1")).toHaveCount(0);
  });

  test("клик по шапке переставляет строки", async ({ page, world }) => {
    const { userInfo } = await enterTerminal(page, world, () =>
      readyWorld({
        trades: [
          tradeFixture({ id: "fill-cheap", price: (60_000n * WAD).toString() }),
          tradeFixture({ id: "fill-rich", price: (80_000n * WAD).toString() }),
        ],
      }),
    );

    await userInfo.selectTab("trade-history");
    const rows = page.locator('[data-testid^="trade-history-table-row-"]');
    await userInfo.header("price").click(); // asc
    await expect(rows.first()).toHaveAttribute(
      "data-testid",
      "trade-history-table-row-fill-cheap",
    );
    await userInfo.header("price").click(); // desc
    await expect(rows.first()).toHaveAttribute(
      "data-testid",
      "trade-history-table-row-fill-rich",
    );
  });
});
```

- [ ] **Шаг 3: Спека панели Account**

`e2e/tier1/24-account-panel.spec.ts`:

```ts
import { AccountPanelPage } from "../pages/TerminalPanels";
import { enterTerminal } from "../pages/flows";
import { WAD } from "../support/constants";
import { expect, test } from "../support/fixtures";
import { longPositionFixture, readyWorld } from "../support/world";

test.describe("панель Account", () => {
  test("шесть строк макета на месте", async ({ page, world }) => {
    await enterTerminal(page, world);
    const account = new AccountPanelPage(page);

    await expect(account.root).toBeVisible();
    for (const name of [
      "unrealized-pnl",
      "value",
      "equity",
      "borrowed",
      "exposure",
      "leverage",
    ]) {
      await expect(account.row(name)).toBeVisible();
    }
  });

  test("equity меньше стоимости счёта ровно на офчейн-лок", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world, () =>
      readyWorld({
        accountMargin: {
          available: (5_000n * WAD).toString(),
          locked: (40n * WAD).toString(),
          free: (4_960n * WAD).toString(),
        },
      }),
    );
    const account = new AccountPanelPage(page);

    // Стоимость счёта — ончейн getAvailableMargin (5 000 в readyWorld);
    // лок приходит со шлюза и вычитается только из Equity.
    await expect(account.row("value")).toHaveText("$5,000.00");
    await expect(account.row("equity")).toHaveText("$4,960.00");
  });

  test("экспозиция и нереализованный PnL считаются по открытым позициям", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world, () => {
      const w = readyWorld();
      w.accounts[0].positions = [longPositionFixture()];
      return w;
    });
    const account = new AccountPanelPage(page);

    // +$100 из фикстуры позиции; экспозиция = 1 BTC × mark 70 000.
    await expect(account.row("unrealized-pnl")).toHaveText("+$100.00");
    await expect(account.row("exposure")).toHaveText("$70,000.00");
  });

  test("кнопка Deposit панели открывает тот же диалог", async ({
    page,
    world,
  }) => {
    await enterTerminal(page, world);
    const account = new AccountPanelPage(page);

    await account.depositButton.click();
    await expect(page.getByTestId("deposit-dialog")).toBeVisible();
  });
});
```

- [ ] **Шаг 4: Прогнать новые спеки и весь tier-1**

Run: `pnpm test:e2e e2e/tier1/23-history-tables.spec.ts e2e/tier1/24-account-panel.spec.ts`
Expected: 12 тестов зелёные.

Run: `pnpm test:e2e`
Expected: весь tier-1 зелёный (143 прежних + 12 новых).

- [ ] **Шаг 5: Коммит**

```bash
git add e2e/tier1/23-history-tables.spec.ts e2e/tier1/24-account-panel.spec.ts \
  e2e/pages/TerminalPanels.ts
git commit -m "test(e2e): вкладки историй, тулбар и панель Account (Ф3b, задача 13)"
```

---

### Задача 14: e2e tier-2 — чтение историй на staging

**Files:**

- Create: `e2e/tier2/live-history.live.spec.ts`

**Interfaces:**

- Consumes: `liveConfigured`, `liveFixtures`, `AppPage`, `UserInfoPanel`.
- Produces: живое подтверждение, что четыре новых чтения доходят до контура staging.

Живой ярус не проверяет числа — на staging их никто не гарантирует. Он проверяет
единственное, чего мок проверить не может: что путь до шлюза существует и ответ
разбирается без ошибки.

- [ ] **Шаг 1: Спека**

`e2e/tier2/live-history.live.spec.ts`:

```ts
import { AppPage } from "../pages/AppPage";
import { UserInfoPanel } from "../pages/TerminalPanels";
import { liveConfigured } from "./env";
import { expect, test } from "./liveFixtures";

const TABS = [
  "trade-history",
  "order-history",
  "position-history",
  "funding-history",
  "account-history",
] as const;

test.describe("live: истории счёта", () => {
  test.beforeEach(() => {
    const gate = liveConfigured();
    test.skip(!gate.ok, gate.reason);
  });

  test("каждая вкладка истории отвечает без ошибки", async ({ page }) => {
    const failures: string[] = [];
    page.on("response", (r) => {
      const u = r.url();
      if (
        /position-history|settlement-ledger|\/orders|\/trades/.test(u) &&
        r.status() >= 400
      ) {
        failures.push(`${r.status()} ${u}`);
      }
    });

    const app = new AppPage(page);
    await app.goto();
    await app.signInToTerminal();
    const userInfo = new UserInfoPanel(page);

    for (const tab of TABS) {
      await userInfo.selectTab(tab);
      // Либо таблица, либо честное «пусто»/«источник молчит» — но не разрыв.
      await expect(
        page
          .locator(`[data-testid^="${tab}-table"]`)
          .or(page.getByTestId("position-history-unavailable")),
      ).toBeVisible({ timeout: 20_000 });
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });
});
```

- [ ] **Шаг 2: Прогнать живой ярус, если контур настроен**

Run: `pnpm test:e2e:live e2e/tier2/live-history.live.spec.ts`
Expected: PASS либо `skipped` с причиной из `liveConfigured()` — второе не провал
задачи, но в отчёте фазы это надо назвать словами, а не выдать за прогон.

- [ ] **Шаг 3: Финальный гейт фазы**

Run: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build && pnpm test:e2e`
Expected: всё зелёное.

- [ ] **Шаг 4: Коммит**

```bash
git add e2e/tier2/live-history.live.spec.ts
git commit -m "test(e2e): живое чтение историй на staging (Ф3b, задача 14)"
```

---

## Что уезжает вперёд

Записать в тело PR — это не забытое, а отложенное решением:

1. **`Close All` и построчное закрытие позиции** — подача reduce-only ордера из
   таблицы. Отдельная карточка: это торговля, а не механика таблицы.
2. **Правка TP/SL карандашом** — редактирование условного ордера, та же причина.
   Значения показываются, править нельзя.
3. **Свёртка нижней панели шевроном** — четвёртая кнопка тулбара макета; состояния
   `bottomCollapsed` в `useTerminalUiStore` нет.
4. **`useAccountMarginQuery` и `useAccountDebtQuery` в `@liq/react`** — пробел SDK,
   который панель Account закрыла локальным `useQuery`. Уходит в ближайший релиз SDK;
   тогда локальные ключи заменяются на срезы реестра и начинают сметаться при выходе.
5. **Три статуса ордера вне обеих вкладок** — `MATCHED`, `SETTLEMENT_SUBMITTED`,
   `FAILED_RETRYABLE` не видны ни в открытых, ни в истории. Закрывается расширением
   `useOpenOrdersQuery`, что меняет поведение существующих потребителей.
6. **Постраничность историй** — леджер, сделки и ордера читаются одной страницей.
   Курсор в SDK есть (`nextCursor`), кнопки «ещё» в макете нет.

## Самопроверка плана

- **Покрытие спеки.** «Ф3 · Семь историй и панель Account» просит семь таблиц на
  `@tanstack/react-table` с колонками, сортировкой, видимостью колонок, фильтром и
  фуллскрином (задачи 3–10, механики — в 3, фуллскрин — в 4) и панель Account
  (задача 11). «Тесты» просят юниты на мапперы и форматирование (задачи 3, 10, 11),
  расширение `mockGateway` (задача 12) и живое чтение историй (задача 14). Ручки
  `orderbook` и `trades`, которые спека тоже называет, мок получил ещё в Ф1 —
  проверено, они на месте.
- **Отступления от спеки, названные вслух:** `usePortfolioQuery` в панели не
  используется (обоснование — в «Панель Account: откуда шесть чисел»); четвёртая
  кнопка тулбара и действия закрытия позиции вынесены вперёд.
- **Согласованность типов.** `MARKET_COLUMN_ID` объявлен в задаче 3 и потреблён в
  задачах 5–10 одним именем; `marketFilterFn(rowMarketId, value)` везде получает
  строку (`marketId.toString()` для `bigint`-полей, голое поле для строковых);
  `toolbarExtra?: ReactNode` объявлен в задаче 3 и приходит из задачи 4 в семь
  таблиц; `DataTable` выводит `-loading`, `-empty` и `-row-{id}` из одного `testid`,
  и все спеки ходят по этой схеме.
- **Заглушек нет.** Каждый шаг несёт либо команду, либо готовый код. `Soon` из
  задачи 4 — не заглушка плана, а объявленное промежуточное состояние, которое
  задача 10 удаляет.
