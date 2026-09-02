# Действия над позицией в терминале (Ф6b) — план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** таблица позиций получает действия макета — закрытие строки, `Close All`
в шапке и правку TP/SL карандашом, — опираясь на SDK 0.47.0, а не на свои копии.

**Architecture:** сборка строк уезжает из `PositionsTable` в `usePositionRows`,
где скобки считает `positionBrackets` (с идентификаторами заявок), закрытие —
`useClosePositions`, отмена скобок — `useCancelOrdersMutation`. Таблица остаётся
разметкой. Два диалога — подтверждение закрытия и правка TP/SL — на том же
`ui/dialog`, что `WithdrawDialog`.

**Tech Stack:** React 19, TanStack Query/Table v9, radix `Dialog`, `@liq/*` 0.47.0.

**Spec:** `docs/superpowers/specs/2026-09-01-trade-core-design.md` (экран Trade),
макет `Trading_Flows/Frame-13.png`.

## Global Constraints

- Пакеты `@liq/*` — ровно `npm:@liqpro/liq-*@^0.47.0`, все восемь.
- Логику брать из `@liq/core` / `@liq/react`; своих копий закрытия, скобок и
  батчинга отмены не писать.
- Компоненты — `@/components/ui/*` (radix + shadcn), своих не заводить.
- Гейт: `pnpm typecheck && node_modules/.bin/eslint . && pnpm test && pnpm build
  && pnpm test:e2e`. `pnpm lint` **не** использовать (чужой глобальный ESLint 9).
- Сознательно вне охвата: частичное закрытие (в Liqu — слайдер доли) и иконка ⟳
  из макета, чей смысл по одному макету не определяется.

---

### Задача 1: пакеты 0.47.0 и строки позиций одним хуком

**Files:**
- Modify: `package.json`
- Create: `src/features/positions/usePositionRows.ts`
- Modify: `src/features/positions/PositionsTable.tsx`
- Test: `src/features/positions/__tests__/positionRows.test.ts`

**Interfaces:**
- Consumes: `positionBrackets`, `closingOrderFor` (`@liq/core`),
  `useClosePositions`, `useCancelOrdersMutation`, `useEnrichedPositions`,
  `usePricesQuery`, `useConditionalOrders` (`@liq/react`).
- Produces:
  ```ts
  export interface PositionRow {
    position: EnrichedPosition;
    symbol: string;
    markPrice: bigint | undefined;
    brackets: PositionBrackets; // takeProfit / stopLoss с orderId
  }
  export function usePositionRows(): {
    rows: PositionRow[];
    isLoading: boolean;
    isError: boolean;
    close: (rows: PositionRow[]) => Promise<CloseOutcome>;
    isClosing: boolean;
  };
  export interface CloseOutcome { closed: number; failed: number; cancelled: number }
  ```

Скобки сейчас считаются прямо в `PositionsTable` руками — `filter` по рынку,
`startsWith('TAKE_PROFIT')`, `BigInt(triggerPrice)` — и теряют идентификатор
заявки. Без него правка скобки не знает, что отменять.

Закрытие строки гасит и скобки этой позиции: reduce-only триггер осиротевшей
позиции исполниться не может, но в списке условных он остаётся и читается как
живой. Отдыхающие лимитки не трогаются — их закрытие позиции не просило.

- [ ] **Шаг 1:** в `package.json` восемь `@liq/*` → `npm:@liqpro/liq-*@^0.47.0`,
      `pnpm install`.
- [ ] **Шаг 2: тест** — `positionRows.test.ts` на чистой функции сборки строк:
      скобки приходят с `orderId`; рынок без условных даёт `null`-скобки;
      строка без цены оракула несёт `markPrice: undefined`.
- [ ] **Шаг 3:** прогнать — красный.
- [ ] **Шаг 4: реализация** хука; `PositionsTable` берёт строки из него.
- [ ] **Шаг 5:** `pnpm typecheck && node_modules/.bin/eslint . && pnpm test`.
- [ ] **Шаг 6: коммит** — `feat(positions): строки позиций одним хуком, скобки с идентификаторами`.

### Задача 2: колонка действий и подтверждение закрытия

**Files:**
- Create: `src/features/positions/ClosePositionsDialog.tsx`
- Modify: `src/features/positions/PositionsTable.tsx`

**Interfaces:**
- Consumes: `usePositionRows` из задачи 1.
- Produces: `ClosePositionsDialog({ rows, open, onClose, onConfirm, pending })`.

По макету: в шапке последней колонки — красный `Close All`, в строке — красный
✕. Обе кнопки открывают один диалог: закрытие рыночным ордером необратимо, и
промах мышью не должен стоить позиции.

- [ ] **Шаг 1:** диалог — перечисляет рынки, размеры и число скобок под отмену,
      прямо говорит, что отдыхающие лимитки не трогаются; кнопка `Close`
      красная, `pending` меняет её подпись.
- [ ] **Шаг 2:** колонка `actions` — `header: () => <CloseAllButton/>`,
      `cell` — ✕ строки; `data-testid`: `close-all-button`,
      `close-position-{marketId}`, `close-positions-dialog`,
      `close-positions-confirm`.
- [ ] **Шаг 3:** `Close All` выключен, когда позиций нет или проход идёт.
- [ ] **Шаг 4:** гейт пакета (typecheck, eslint, test, build).
- [ ] **Шаг 5: коммит** — `feat(positions): закрытие строки и Close All с подтверждением`.

### Задача 3: правка TP/SL карандашом

**Files:**
- Create: `src/features/positions/TpSlDialog.tsx`
- Modify: `src/features/positions/PositionsTable.tsx`, `usePositionRows.ts`

**Interfaces:**
- Consumes: `closingOrderFor`, `useOrderSubmission`, `useCancelOrdersMutation`.
- Produces: `TpSlDialog({ row, open, onClose })`.

Замена скобки — это отмена **конкретной** заявки по `bracket.orderId` и подача
новой; поэтому идентификатор и есть то, ради чего в задаче 1 заведён
`positionBrackets`. Пустое поле означает «снять», а не «оставить как было»:
иначе снять скобку нечем.

Направление триггера берётся от стороны позиции: у длинной TP выше, SL ниже, у
короткой зеркально. Размер и сторона закрывающего условного — из
`closingOrderFor`, а не пересчитываются здесь.

- [ ] **Шаг 1: тест** — `tpslPlan.test.ts` на чистой функции: что отменить и что
      подать при (а) пустых скобках и заполненных полях, (б) существующих
      скобках и изменённых ценах, (в) очищенном поле — только отмена,
      (г) неизменной цене — ни отмены, ни подачи.
- [ ] **Шаг 2:** прогнать — красный.
- [ ] **Шаг 3: реализация** — функция плана + диалог, зовущий её.
- [ ] **Шаг 4:** карандаш в ячейке TP/SL (`data-testid: edit-tpsl-{marketId}`).
- [ ] **Шаг 5:** гейт пакета.
- [ ] **Шаг 6: коммит** — `feat(positions): правка TP/SL из таблицы позиций`.

### Задача 4: e2e и мок, который умеет отменять пачкой

**Files:**
- Modify: `e2e/support/mockGateway.ts`, `e2e/pages/TerminalPanels.ts`
- Create: `e2e/tier1/28-position-actions.spec.ts`

Массовый `DELETE /orders` в моке сейчас отвечает `{results: []}` и ничего не
отменяет — заглушка, под которой любой тест закрытия зелен по построению.

- [ ] **Шаг 1:** мок — массовый `DELETE` отменяет перечисленные идентификаторы
      так же, как одиночный, и записывает их в `world.cancelledOrderIds`;
      сохраняет усечение шлюза до 50, чтобы поведение контура не расходилось.
- [ ] **Шаг 2: спека** — закрытие строки подаёт reduce-only рыночный ордер
      встречной стороны того же размера с границей проскальзывания; `Close All`
      на двух позициях подаёт два ордера; закрытие отменяет скобки позиции и не
      трогает отдыхающую лимитку; правка TP отменяет старую заявку и подаёт
      новую; очистка поля SL только отменяет.
- [ ] **Шаг 3:** `pnpm test:e2e` — зелено.
- [ ] **Шаг 4: коммит** — `test(e2e): действия над позицией`.

### Задача 5: PR

- [ ] **Шаг 1:** полный гейт: `pnpm typecheck && node_modules/.bin/eslint . &&
      pnpm test && pnpm build && pnpm test:e2e`.
- [ ] **Шаг 2:** draft-PR в `liqu-fi/terminal`, база `main`; в теле — что
      появилось, что осознанно отложено (частичное закрытие, ⟳) и чем
      `Close All` здесь отличается от Liqu (отдыхающие лимитки не трогаются).
